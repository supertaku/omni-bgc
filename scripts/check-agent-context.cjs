const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { AgentOrchestrator } = require('../src/ai/AgentOrchestrator.ts');
const { createUnifiedRetrieval } = require('../src/ai/retrieval.ts');
const { createToolExecutor } = require('../src/ai/toolExecutor.ts');
const retrieval = createUnifiedRetrieval({ findPlaces: async () => [], getPlaceDetails: async () => null, findMenuItems: async () => [], loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }), searchOffices: () => ({ items: [], total: 0 }), getOfficeDetails: () => null });
(async () => {
  const { toolObservation } = require('../src/ai/prompt.ts');
  const offices = await retrieval.searchPreviewDirectory({ category: 'office', limit: 12 });
  const compact = JSON.parse(toolObservation({ ...offices, name: 'search_preview_directory', callId: 'host-context-check' }, 600));
  assert.ok(compact.data.length > 0 && compact.data[0].id, 'small observations must retain a usable identity for the next tool');
  let rounds = 0, selected;
  const provider = {
    getCapabilities: async () => ({ supportedContextTokens: 2048 }),
    cancel: async () => ({ nativeQuiescent: true }),
    stream: async input => {
      rounds++;
      assert.equal(input.tools[0].name, 'search_preview_directory', 'preview searches start with the populated preview directory');
      assert.ok(Buffer.byteLength(JSON.stringify({ messages: input.messages, tools: input.tools })) <= 5376);
      if (rounds === 2) {
        const observation = JSON.parse(input.messages.find(m => m.role === 'tool').text);
        assert.ok(observation.data.length > 0, 'continuation keeps usable search records');
        selected = observation.data[0].id;
      }
      assert.ok(!input.messages.some(m => m.text === 'find restaurants'), 'a fresh search excludes unrelated earlier conversation');
      return { requestId: input.requestId, epoch: input.epoch, text: '', toolProposals: rounds === 1
        ? [{ name: 'search_preview_directory', arguments: { category: 'cafe', limit: 12 } }]
        : [{ name: 'get_preview_place_details', arguments: { placeId: selected } }], finishReason: 'complete', nativeQuiescent: true };
    },
  };
  const turn = await new AgentOrchestrator(provider, createToolExecutor(retrieval)).run('Find a coffee place and show its details');
  assert.equal(rounds, 2, 'a bounded search observation must leave room for the requested detail tool');
  assert.ok(turn.results.some(r => r.name === 'get_preview_place_details' && r.status === 'ok'));
  assert.ok(turn.places.some(p => p.id === selected), 'details remain grounded in current records');
  rounds = 0;
  const { previewPlaces } = require('../src/preview/directory.ts');
  const followup = await new AgentOrchestrator(provider, createToolExecutor(retrieval)).run('Find a coffee place and show its details', {
    resolvedPlaceIds: previewPlaces.slice(0, 12).map(p => p.id),
    recentMessages: [{ role: 'user', text: 'find restaurants' }],
  });
  assert.equal(rounds, 2, JSON.stringify({ status: followup.status, errorCode: followup.errorCode }));
  assert.ok(followup.results.some(r => r.name === 'get_preview_place_details' && r.status === 'ok'), 'unrelated old cards must not prevent a new search/detail request');
  let focused;
  const ids = previewPlaces.slice(0, 12).map(p => p.id);
  const ordinalProvider = { ...provider, stream: async input => {
    const mapping = JSON.parse(input.messages.find(m => m.text.includes('"observationType":"HOST_REVALIDATED_RENDERED_REFERENCES"')).text);
    assert.deepEqual(mapping.references.map(r => [r.ordinal, r.placeId]), [[2, ids[1]]], 'ordinal follow-up retains the exact original second card');
    return { requestId: input.requestId, epoch: input.epoch, text: '', toolProposals: input.messages.some(m => m.role === 'tool') ? [] : [{ name: 'focus_map_place', arguments: { placeId: ids[1] } }], finishReason: 'complete', nativeQuiescent: true };
  } };
  const ordinal = await new AgentOrchestrator(ordinalProvider, createToolExecutor(retrieval, { focusMapPlace: p => { focused = p.id; return true; } })).run('Show the second one on the map', { resolvedPlaceIds: ids });
  assert.equal(ordinal.status, 'completed', JSON.stringify(ordinal));
  assert.equal(focused, ids[1]);
  const strictProvider = { ...provider, stream: async input => {
    assert.ok(!input.tools.some(t => /preview/.test(t.name)), 'verified-only requests never gain preview capabilities');
    return { requestId: input.requestId, epoch: input.epoch, text: '', toolProposals: [], finishReason: 'complete', nativeQuiescent: true };
  } };
  const strict = await new AgentOrchestrator(strictProvider, createToolExecutor(retrieval)).run('Find a coffee place and show its details verified only');
  assert.equal(strict.status, 'completed');
  console.log('Agent context: actual bundled search records fit a two-round search/detail request at 2048 tokens.');
})().catch(error => { console.error(error); process.exitCode = 1; });
