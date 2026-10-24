const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);

const { planDeterministicRequest } = require('../src/ai/deterministicIntent.ts');
const { runHybridTurn } = require('../src/ai/hybridAssistant.ts');
const { createToolExecutor } = require('../src/ai/toolExecutor.ts');
const { previewPlaces } = require('../src/preview/directory.ts');
const { createUnifiedRetrieval } = require('../src/ai/retrieval.ts');
const { AgentOrchestrator } = require('../src/ai/AgentOrchestrator.ts');
const { renderedReferenceIds } = require('../src/features/assistant/mapResults.ts');

const retrieval = createUnifiedRetrieval({
  findPlaces: async () => [], getPlaceDetails: async () => null, findMenuItems: async () => [],
  loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }),
  searchOffices: async () => ({ items: [], total: 0 }), getOfficeDetails: async () => null,
});
const office = previewPlaces.find(p => p.category === 'office' && p.coordinate);
assert(office, 'bundled preview contains a mapped office');

(async () => {
  const scored = [];
  let modelCalls = 0, focused;
  const deps = {
    agent: { run: async () => { modelCalls++; throw Error('model should not run'); } },
    executor: createToolExecutor(retrieval, { focusMapPlace: p => { focused = p.id; return true; } }),
    canInfer: () => true, answerDirectory: () => [],
  };
  assert.equal(planDeterministicRequest('Find restaurants and show their details', previewPlaces)?.kind, 'places');
  const details = await runHybridTurn('Find restaurants and show their details', previewPlaces, deps);
  assert.equal(details.execution, 'deterministic');
  assert(details.payloads.some(p => p.kind === 'place'), 'compound lookup opens grounded details');
  assert.equal(details.status, 'partial', 'bounded details state when more records exist');
  assert.equal(modelCalls, 0);
  scored.push('compound search/details');
  const overlapPlace = previewPlaces.find(p => p.name === 'Formica Philippines');
  assert(overlapPlace);
  const approvedOverlap = { ...overlapPlace, status: 'approved', citations: [{
    sourceId: 'm14-fixture', label: 'Host regression fixture', license: 'test-only',
    factId: 'fact', snapshotId: 'snapshot', evidenceId: 'evidence', locator: 'fixture',
    verificationMethod: 'test', rawSha256: 'a'.repeat(64), status: 'approved',
    observedAt: '2026-10-01T00:00:00Z', verifiedAt: '2026-10-02T00:00:00Z',
  }] };
  const overlapRetrieval = createUnifiedRetrieval({
    findPlaces: async () => [approvedOverlap], getPlaceDetails: async id => id === approvedOverlap.id ? approvedOverlap : null,
    findMenuItems: async () => [], loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }),
    searchOffices: () => ({ items: [], total: 0 }), getOfficeDetails: () => null,
  });
  focused = undefined;
  const overlap = await runHybridTurn('Find Formica Philippines and show it on the map', [], {
    ...deps, executor: createToolExecutor(overlapRetrieval, { focusMapPlace: p => { focused = p.id; return true; } }),
  });
  assert.equal(focused, overlapPlace.id, 'one canonical record in approved and preview sources is unambiguous');
  assert.equal(overlap.status, 'completed');
  scored.push('overlapping approved and preview identity');
  assert.equal(planDeterministicRequest('Find ramen under PHP 300 and show their details', previewPlaces), null,
    'unsupported compound menu follow-up retains the model path rather than losing the objective');
  scored.push('compound menu objective preserved');
  const coffee = await runHybridTurn('Find coffee shops', previewPlaces, deps);
  assert.equal(coffee.execution, 'deterministic');
  assert(coffee.payloads.some(p => p.kind === 'places' && p.placeIds.length));
  scored.push('direct search');
  const budget = planDeterministicRequest('ramen between PHP 200 and PHP 300', previewPlaces);
  assert.equal(budget.kind, 'menus');
  assert.deepEqual(budget.bounds, { minPhp: '200.00', maxPhp: '300.00' });
  scored.push('exact PHP range');
  const ramenName = { ...office, name: 'Ramen House', aliases: [], status: 'approved' };
  assert.equal(planDeterministicRequest('Find Ramen House', [ramenName]).kind, 'places',
    'a restaurant name containing a dish word must not become a menu query');
  assert.equal(planDeterministicRequest('What floor is Ramen House on?', [ramenName]).kind, 'places');
  scored.push('restaurant name and floor');
  assert.equal(planDeterministicRequest('What floor is Duplicate Cafe on?', [
    { ...office, name: 'Duplicate Cafe', aliases: [] },
    { ...previewPlaces.find(p => p.id !== office.id), name: 'Duplicate Cafe', aliases: [] },
  ]), null);
  scored.push('ambiguous names');
  assert.equal(planDeterministicRequest('walking directions to the mall', previewPlaces).kind, 'message');
  scored.push('unsupported route');
  const noModel = await runHybridTurn('recommend somewhere quiet', previewPlaces, { ...deps, canInfer: () => false });
  assert.equal(noModel.execution, 'deterministic');
  assert(!noModel.payloads.some(p => p.kind === 'places'));
  scored.push('unsupported attribute with missing model');
  const failedModel = await runHybridTurn('recommend somewhere quiet', previewPlaces, {
    ...deps, agent: { run: async () => ({ status: 'failed', payloads: [], places: [], results: [] }) },
  });
  assert.equal(failedModel.execution, 'fallback');
  assert(!failedModel.payloads.some(p => p.kind === 'places'));
  scored.push('failed model fallback');
  const stopped = new AbortController(); stopped.abort();
  const canceled = await runHybridTurn('Find coffee shops', previewPlaces, deps, { signal: stopped.signal });
  assert.equal(canceled.status, 'canceled');
  scored.push('cancellation');
  let rounds = 0;
  const partialProvider = {
    getCapabilities: async () => ({ supportedContextTokens: 2048, backendRequested: 'cpu' }),
    cancel: async () => ({ nativeQuiescent: true }),
    stream: async input => {
      if (++rounds === 2) throw Error('native test failure');
      return { requestId: input.requestId, epoch: input.epoch, text: '',
        toolProposals: [{ name: 'search_preview_directory', arguments: { category: 'office', limit: 4 } }],
        finishReason: 'complete', nativeQuiescent: true };
    },
  };
  const partial = await new AgentOrchestrator(partialProvider, deps.executor).run('Find me an office and show its details');
  assert.equal(partial.status, 'partial', 'validated first-round results survive a failed follow-up');
  assert(partial.payloads.some(p => p.kind === 'places' && p.placeIds.length), 'partial answer retains source IDs');
  assert(partial.places.length, 'partial cards receive fresh source records');
  scored.push('partial model failure');
  const unfinishedProvider = { ...partialProvider, stream: async input => ({ requestId: input.requestId,
    epoch: input.epoch, text: '', toolProposals: input.messages.some(m => m.role === 'tool') ? []
      : [{ name: 'search_preview_directory', arguments: { category: 'office', limit: 4 } }],
    finishReason: 'complete', nativeQuiescent: true }) };
  const unfinished = await new AgentOrchestrator(unfinishedProvider, deps.executor).run('Find an office and show its details');
  assert.equal(unfinished.status, 'partial', 'a search-only model response cannot claim complete details');
  scored.push('incomplete model action');

  const map = await runHybridTurn(`Find ${office.name} and show it on the map`, previewPlaces, deps);
  assert.equal(map.execution, 'deterministic');
  assert.equal(focused, office.id, 'search and map action uses canonical retrieved ID');
  scored.push('compound search/map');
  focused = undefined;
  const ordinal = await runHybridTurn('Show the second result on the map', previewPlaces, deps, {
    resolvedPlaceIds: [previewPlaces[0].id, office.id],
  });
  assert.equal(ordinal.execution, 'deterministic');
  assert.equal(focused, office.id, 'ordinal resolves against displayed order');
  scored.push('ordinal follow-up');
  const repeatedRows = { kind: 'food-menus', items: [{ placeId: office.id }, { placeId: office.id }, { placeId: previewPlaces[0].id }] };
  assert.deepEqual(renderedReferenceIds([repeatedRows]), [office.id, office.id, previewPlaces[0].id],
    'ordinal inventory preserves every numbered menu row, including repeated establishments');
  focused = undefined;
  await runHybridTurn('Show the second result on the map', previewPlaces, deps, {
    resolvedPlaceIds: renderedReferenceIds([repeatedRows]),
  });
  assert.equal(focused, office.id, 'second menu row resolves to its establishment, not the second unique establishment');
  assert.deepEqual(renderedReferenceIds([{ kind: 'places', placeIds: ['expired', office.id] }, repeatedRows]), ['expired', office.id],
    'the first numbered collection retains unavailable positions instead of shifting later ordinals');
  scored.push('numbered menu rows retain duplicates');
  const referenceProvider = { ...partialProvider, stream: async input => {
    const inventory = input.messages.find(m => m.text.includes('"observationType":"HOST_REVALIDATED_RENDERED_REFERENCES"'));
    assert(inventory);
    assert.deepEqual(JSON.parse(inventory.text).references.map(r => [r.ordinal, r.placeId]), [[2, office.id]]);
    return { requestId: input.requestId, epoch: input.epoch, text: '', nativeQuiescent: true, finishReason: 'complete',
      toolProposals: input.messages.some(m => m.role === 'tool') ? [] : [{ name: 'get_preview_place_details', arguments: { placeId: office.id } }] };
  } };
  const repeatedReference = await new AgentOrchestrator(referenceProvider, deps.executor)
    .run('Show details of the second result', { resolvedPlaceIds: [office.id, office.id] });
  assert(['completed', 'partial'].includes(repeatedReference.status), 'model detail references preserve repeated row ordinals too');
  assert(repeatedReference.payloads.some(p => p.kind === 'place' && p.placeId === office.id));
  scored.push('model reference preserves repeated row');
  focused = undefined;
  const stale = await runHybridTurn('Show the second result on the map', previewPlaces, deps, {
    resolvedPlaceIds: [previewPlaces[0].id, '00000000-0000-4000-8000-000000000099'],
  });
  assert.equal(stale.status, 'unavailable');
  assert.equal(focused, undefined);
  scored.push('stale reference');
  assert.equal(modelCalls, 0);
  assert.equal(new Set(scored).size, scored.length);
  console.log(`M14 AI: ${scored.length}/${scored.length} focused host scenarios passed; native numeric bridge checked separately.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
