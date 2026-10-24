const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const id = 'b9446af3-dab7-5c92-afec-cb48b8195425';
const itemId = 'b9446af3-dab7-5c92-afec-cb48b8195426';
const unlocatedId = 'b9446af3-dab7-5c92-afec-cb48b8195427';
const place = { id, name: 'Preview Coffee', category: 'cafe', description: 'A generated café description.', coordinate: [121.05, 14.55], aliases: ['Coffee House'], entrances: [], citations: [], status: 'candidate', menus: [], preview: true };
const unlocated = { ...place, id: unlocatedId, name: 'Preview Office', category: 'office', coordinate: null, aliases: [] };
const preview = {
  INTERNAL_PREVIEW_ENABLED: true, previewVersion: 'preview-fixture-v1', previewPlaces: [place, unlocated],
  canonicalPreviewId: value => value === itemId ? id : value,
  resolvePreviewPlace: value => value === id || value === itemId ? { ...place } : value === unlocatedId ? { ...unlocated } : null,
  previewDetails: () => ({ sourceIds: [id], fields: { description: { classification: 'generated' } } }),
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  return request.endsWith('/preview/directory') ? preview : originalLoad.call(this, request, parent, isMain);
};
const { createUnifiedRetrieval } = require('../src/ai/retrieval.ts');
const { createToolExecutor } = require('../src/ai/toolExecutor.ts');
const { decodeToolProposal, toolDefinitions } = require('../src/ai/tools.ts');
const { revalidateToolResult, composeGroundedAnswer } = require('../src/ai/answerComposer.ts');
const { toolObservation } = require('../src/ai/prompt.ts');
const { runHybridTurn } = require('../src/ai/hybridAssistant.ts');
const { AgentOrchestrator } = require('../src/ai/AgentOrchestrator.ts');
const retrieval = createUnifiedRetrieval({ findPlaces: async () => [], getPlaceDetails: async () => null, findMenuItems: async () => [], loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }), searchOffices: () => ({ items: [], total: 0 }), getOfficeDetails: () => null });
const context = () => ({ requestId: 'preview-check', researchEnabled: true, resolvedPlaceIds: new Set() });
(async () => {
  assert.equal(decodeToolProposal({ name: 'search_preview_directory', arguments: { query: 'coffee', limit: 12 } }, 'host').name, 'search_preview_directory');
  assert.throws(() => decodeToolProposal({ name: 'search_preview_directory', arguments: { query: 'coffee', limit: 21 } }, 'host'));
  assert.equal(toolDefinitions().filter(t => /preview_directory|preview_place_details/.test(t.name)).length, 2);
  const found = await retrieval.searchPreviewDirectory({ query: 'coffee' });
  assert.equal(found.authority, 'research');
  assert.deepEqual(found.data.map(p => p.id), [id]);
  assert.equal((await retrieval.searchPreviewDirectory({ category: 'office' })).data[0].id, unlocatedId);
  assert.ok(found.sourceFingerprint.includes('preview-fixture-v1'));
  assert.equal((await retrieval.getPlaceDetails(id)).data, null, 'preview records never satisfy approved API');
  assert.equal((await retrieval.getVerifiedEntrances(id)).data.entrances.length, 0);
  let opened;
  const executor = createToolExecutor(retrieval, { focusMapPlace: p => { opened = p; return true; } });
  const ctx = context();
  const search = await executor.execute({ name: 'search_preview_directory', arguments: { query: 'coffee' } }, 'search', ctx);
  assert.ok(ctx.resolvedPlaceIds.has(id));
  const focused = await executor.execute({ name: 'focus_map_place', arguments: { placeId: id } }, 'focus', ctx);
  assert.equal(focused.status, 'ok');
  assert.equal(opened.id, id);
  assert.equal((await executor.execute({ name: 'focus_map_place', arguments: { placeId: unlocatedId } }, 'unresolved', ctx)).status, 'denied');
  await executor.execute({ name: 'get_preview_place_details', arguments: { placeId: unlocatedId } }, 'read-office', ctx);
  assert.equal((await executor.execute({ name: 'focus_map_place', arguments: { placeId: unlocatedId } }, 'office-focus', ctx)).status, 'ok');
  assert.equal(opened.coordinate, null, 'unlocated place opens details without synthetic coordinates');
  assert.equal((await executor.execute({ name: 'search_preview_directory', arguments: {} }, 'excluded', { ...context(), researchEnabled: false })).status, 'denied');
  const refreshed = await revalidateToolResult(search, retrieval);
  assert.equal(refreshed.data[0].name, place.name);
  assert.equal(composeGroundedAnswer([refreshed])[0].kind, 'places');
  assert.ok(toolObservation(refreshed).includes('generated'));
  const turn = await runHybridTurn('find offices', [], { executor, canInfer: () => false, agent: { run: () => { throw Error('must remain deterministic'); } }, answerDirectory: () => [] });
  assert.ok(turn.payloads.some(p => p.kind === 'places' && p.placeIds.includes(unlocatedId)), 'AI-disabled office discovery includes preview');
  const strict = await runHybridTurn('find offices verified only', [], { executor, canInfer: () => false, agent: { run: () => { throw Error('must remain deterministic'); } }, answerDirectory: () => [] });
  assert.ok(!strict.places.some(p => p.preview), 'verified-only request excludes preview');
  let rounds = 0;
  const provider = { state: 'READY', getCapabilities: async () => ({ supportedContextTokens: 2048 }), cancel: async () => ({ nativeQuiescent: true }), stream: async input => {
    assert.ok(input.tools.some(t => t.name === 'search_preview_directory'));
    const toolProposals = rounds++ === 0
      ? [{ name: 'search_preview_directory', arguments: { category: 'office' } }]
      : [{ name: 'focus_map_place', arguments: { placeId: unlocatedId } }];
    return { requestId: input.requestId, epoch: input.epoch, text: '', toolProposals, finishReason: 'complete', nativeQuiescent: true };
  } };
  const modelTurn = await new AgentOrchestrator(provider, executor).run('Find an office and show it on the map');
  assert.ok(['completed', 'partial'].includes(modelTurn.status), JSON.stringify(modelTurn));
  assert.ok(modelTurn.places.some(p => p.id === unlocatedId), 'model results keep freshly resolved preview cards');
  assert.ok(modelTurn.results.some(r => r.name === 'focus_map_place' && r.status === 'ok'));
  assert.equal(opened.id, unlocatedId);
  assert.equal((await executor.execute({ name: 'preview_itinerary_change', arguments: { stops: [{ placeId: id, durationMinutes: 15 }] } }, 'itinerary', ctx)).status, 'unavailable', 'preview content cannot enter approved itinerary pipeline');
  const combined = composeGroundedAnswer([{ ...search, name: 'find_places', authority: 'approved' }, search]);
  assert.equal(combined.filter(p => p.kind === 'places').length, 1);
  assert.deepEqual(combined.find(p => p.kind === 'places').placeIds, [id], 'approved and preview collections share one canonical identity');
  Module._load = originalLoad;
  for (const file of ['retrieval', 'toolExecutor']) delete require.cache[require.resolve(`../src/ai/${file}.ts`)];
  const actualPreview = require('../src/preview/directory.ts');
  const { createUnifiedRetrieval: createActualRetrieval } = require('../src/ai/retrieval.ts');
  const { createToolExecutor: createActualExecutor } = require('../src/ai/toolExecutor.ts');
  const { foodResearch } = require('../src/features/food/directory.ts');
  const actualRetrieval = createActualRetrieval({ findPlaces: async () => [], getPlaceDetails: async () => null, findMenuItems: async () => [], loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }), searchOffices: () => ({ items: [], total: 0 }), getOfficeDetails: () => null, foodResearch });
  const actualExecutor = createActualExecutor(actualRetrieval, { focusMapPlace: p => { opened = p; return true; } });
  const actualContext = context();
  const actualMenus = await actualExecutor.execute({ name: 'search_food_research', arguments: { category: 'ramen', maxPhp: '300', limit: 12 } }, 'real-menu', actualContext);
  assert.equal(actualMenus.status, 'ok', 'enriched bundled menus participate in numeric retrieval');
  assert.ok(actualMenus.sourceFingerprint.includes(actualPreview.previewVersion), 'menu receipts bind the current enrichment version');
  for (const row of actualMenus.data) {
    const canonicalId = actualPreview.canonicalPreviewId(row.restaurant.id);
    assert.ok(actualPreview.resolvePreviewPlace(canonicalId), 'every menu result has a place target');
    assert.ok(row.items.every(i => Number(i.amount) <= 300));
    assert.ok(actualContext.resolvedPlaceIds.has(canonicalId));
  }
  const canonicalId = actualPreview.canonicalPreviewId(actualMenus.data[0].restaurant.id);
  assert.equal((await actualExecutor.execute({ name: 'focus_map_place', arguments: { placeId: canonicalId } }, 'real-focus', actualContext)).status, 'ok');
  assert.equal(opened.id, canonicalId);
  console.log('Preview AI: bounded tools, research authority, fresh focus, unlocated details, exclusions and deterministic office fallback passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
