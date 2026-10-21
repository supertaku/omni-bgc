const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
// Host-only transpilation; native/Expo boundaries are controlled fakes, never device evidence.
const cache = new Map();
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  if (mocks[filename]) return mocks[filename];
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), name);
      if (fs.existsSync(target + '.ts')) return load(target + '.ts', mocks);
    }
    return original(name);
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return mod.exports;
}
(async () => {
  const { ModelManager } = load('src/ai/modelManager.ts');
  const { GEMMA_4_E2B: model } = load('src/ai/modelCatalog.ts');
  const candidate = {
    id: model.id,
    sha256: model.sha256,
    bytes: model.bytes,
    absolutePath: '/private/model.litertlm',
    verified: true,
  };
  let pointers = { active: null, previous: null, staged: candidate };
  const storage = {
    finalPath: () => candidate.absolutePath,
    partialPath: () => '/private/model.partial',
    size: async () => model.bytes,
    hash: async () => model.sha256,
    readPointers: async () => pointers,
    writePointers: async (value) => {
      pointers = value;
    },
    remove: async () => {},
  };
  const manager = new ModelManager(storage, { withModelMutation: (work) => work() });
  let loads = 0,
    releases = 0;
  await manager.activate({
    kind: 'native',
    load: async () => {
      loads++;
    },
    generateText: async () => 'READY',
    cancelGenerationAndWait: async () => ({ cancelled: false, nativeIdle: true }),
    release: async () => {
      releases++;
    },
  });
  assert.equal(
    pointers.active.id,
    model.id,
    'successful generation must activate even when a fast engine finishes before a cancellation probe',
  );
  assert.equal(loads, 1, 'activation must not run repeated engine initialization trials');
  assert.equal(releases, 1);
  await manager.recover();
  assert.equal(manager.getStatus().state, 'ACTIVE');
  pointers = { active: null, previous: null, staged: candidate };
  await assert.rejects(
    manager.activate({
      kind: 'native',
      load: async () => {
        throw new Error('OOM');
      },
      generateText: async () => '',
      release: async () => {},
    }),
    /OOM/,
  );
  assert.equal(manager.getStatus().error, 'OOM', 'preserve actionable native failure');
  await manager.recover();
  assert.equal(manager.getStatus().state, 'PENDING_NATIVE_SMOKE_TEST');
  pointers = { active: null, previous: null, staged: null };
  await manager.recover();
  assert.equal(
    pointers.staged.id,
    model.id,
    'recover verified final file after interrupted pointer commit',
  );
  let downloads = 0;
  storage.download = async () => {
    downloads++;
  };
  storage.freeBytes = async () => 0;
  await manager.install(model.id, {
    kind: 'download',
    userInitiated: true,
    licenseAcknowledged: true,
  });
  assert.equal(
    downloads,
    0,
    'existing verified final model must not download again or require duplicate disk space',
  );
  storage.hash = async () => 'bad';
  await manager.recover();
  assert.equal(pointers.staged, null);
  await assert.rejects(manager.install(model.id,{kind:'download',userInitiated:true,licenseAcknowledged:true}),/MODEL_EXISTING_ARTIFACT_CORRUPT/);
  assert.equal(manager.getStatus().state,'FAILED');
  const { prefersDirectoryQuery } = load('src/ai/deterministicIntent.ts');
  assert.equal(prefersDirectoryQuery('restaurants under PHP 300', []), true);
  assert.equal(prefersDirectoryQuery('find coffee in BGC', []), true);
  assert.equal(prefersDirectoryQuery('show the second one on the map', []), false);
  assert.equal(prefersDirectoryQuery('compare these under PHP 300', []), false);
  const { decodeToolProposal, TOOL_NAMES } = load('src/ai/tools.ts');
  assert.equal(TOOL_NAMES.includes('confirm_saved_change'), false);
  assert.throws(
    () =>
      decodeToolProposal({ version: 1, name: 'shell', arguments: { command: 'anything' } }, 'host'),
    /./,
  );
  assert.throws(
    () =>
      decodeToolProposal(
        { version: 1, name: 'find_places', arguments: { query: 'coffee', sql: 'DROP TABLE' } },
        'host',
      ),
    /./,
  );
  assert.throws(
    () =>
      decodeToolProposal(
        { version: 1, name: 'find_menu_items', arguments: { maxPricePhp: 300 } },
        'host',
      ),
    /./,
  );
  const accepted = decodeToolProposal(
    { version: 1, name: 'find_menu_items', arguments: { maxPricePhp: '299.99' } },
    'host',
  );
  assert.equal(accepted.arguments.maxPricePhp, '299.99');
  const { createToolExecutor } = load('src/ai/toolExecutor.ts');
  const place = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Host fixture only',
    category: 'coffee',
    coordinate: null,
    status: 'approved',
    aliases: [],
    entrances: [],
    citations: [],
    menus: [],
  };
  const envelope = (data, appliedFilters) => ({
    status: 'ok',
    authority: 'approved',
    sourceRecordIds: [place.id],
    citations: [],
    appliedFilters,
    warnings: [],
    sourceFingerprint: 'fixture',
    data,
  });
  let reads = 0;
  const retrieval = {
    findPlaces: async (filters) => {
      reads++;
      return envelope([place], filters);
    },
    getPlaceDetails: async (id) => envelope(place, { placeId: id }),
  };
  const executor = createToolExecutor(retrieval);
  const { AgentOrchestrator } = load('src/ai/AgentOrchestrator.ts');
  let rounds = 0;
  const agentProvider = {
    getCapabilities: async () => ({ supportedContextTokens: 4096 }),
    stream: async (input) => {
      rounds++;
      if (rounds === 2)
        assert(
          input.messages.some((message) => message.role === 'tool'),
          'second round must include validated tool observation',
        );
      return {
        requestId: input.requestId,
        epoch: input.epoch,
        text: '',
        toolProposals:
          rounds === 1
            ? [{ version: 1, name: 'find_places', arguments: { query: 'coffee', limit: 3 } }]
            : [],
        finishReason: 'complete',
        nativeQuiescent: true,
      };
    },
    cancel: async () => ({ accepted: true, nativeQuiescent: true }),
  };
  const turn = await new AgentOrchestrator(agentProvider, executor).run(
    'Find a quiet coffee place',
  );
  assert.equal(turn.status, 'completed');
  assert.equal(rounds, 2);
  assert.equal(reads, 2, 'tool results must be revalidated before final display');
  assert(
    turn.payloads.some(
      (payload) => payload.kind === 'places' && payload.placeIds.includes(place.id),
    ),
  );
  const denied = await executor.execute(
    { name: 'search_food_research', arguments: { query: 'coffee' } },
    'host',
    { requestId: 'host', researchEnabled: false, resolvedPlaceIds: new Set() },
  );
  assert.equal(denied.status, 'denied');
  // Public hybrid boundary: exact reads bypass inference; contextual work uses one bounded turn.
  const { runHybridTurn } = load('src/ai/hybridAssistant.ts');
  const hybridCalls = [];
  const currentPlace = { ...place, coordinate: [121.05, 14.55], citations: [{ evidenceId: 'current' }] };
  let sourceAvailable = true;
  const hybridEnvelope = (data, appliedFilters, authority = 'approved') => ({
    status: data && (Array.isArray(data) ? data.length : true) ? 'ok' : 'empty',
    authority,
    sourceRecordIds: data ? (Array.isArray(data) ? data.map((x) => x.id || x.placeId || place.id) : [data.id || place.id]) : [],
    citations: currentPlace.citations,
    appliedFilters,
    warnings: [],
    sourceFingerprint: 'current-fixture',
    data,
  });
  const hybridRetrieval = {
    findPlaces: async (filters) => { hybridCalls.push(['places', filters]); return hybridEnvelope([currentPlace], filters); },
    getPlaceDetails: async (id) => { hybridCalls.push(['details', id]); return hybridEnvelope(sourceAvailable && id === place.id ? currentPlace : null, { placeId: id }); },
    findMenuItems: async (filters) => { hybridCalls.push(['menus', filters]); return hybridEnvelope([], filters); },
    findApprovedOffices: async (filters) => { hybridCalls.push(['offices', filters]); return hybridEnvelope([], filters); },
    getOfficeDetails: async (id) => { hybridCalls.push(['officeDetails', id]); return hybridEnvelope(null, { placeId: id }); },
    getFoodResearchDetails: async (id, offset, limit, bounds) => { hybridCalls.push(['hours', id, bounds]); return hybridEnvelope([], { restaurantId: id, offset, limit, ...bounds }, 'research'); },
    getVerifiedEntrances: async (id) => hybridEnvelope([], { placeId: id }),
    searchFoodResearch: async (filters) => { hybridCalls.push(['research', filters]); return hybridEnvelope([], filters, 'research'); },
  };
  const hybridExecutor = createToolExecutor(hybridRetrieval, { focusMapPlace: async () => true });
  let hybridRuns = 0;
  const fakeAgent = { run: async (query) => { hybridRuns++; return { status: 'completed', payloads: [{ kind: 'text', text: 'bounded turn' }], places: [], results: [] }; } };
  const hybridDeps = { agent: fakeAgent, executor: hybridExecutor, canInfer: () => true, answerDirectory: async () => [] };
  for (const query of ['find coffee', 'ramen under PHP 300', 'menu of Host fixture only', 'find offices', 'recorded hours for Host fixture only']) {
    const before = hybridRuns;
    const out = await runHybridTurn(query, [place], hybridDeps);
    assert.equal(out.execution, 'deterministic', `${query} must use a direct deterministic path`);
    assert.equal(hybridRuns, before, `${query} must not call the agent`);
  }
  assert(hybridCalls.some(([kind]) => kind === 'menus'));
  assert(hybridCalls.some(([kind, filters]) => kind === 'menus' && filters.maxPricePhp === '299.99'), 'explicit PHP ceiling must survive direct routing');
  assert(hybridCalls.some(([kind]) => kind === 'offices'));
  const beforeMap = hybridCalls.length;
  const mapped = await runHybridTurn('show Host fixture only on the map', [place], hybridDeps);
  assert.equal(mapped.execution, 'deterministic');
  assert.equal(hybridRuns, 0, 'map action must not call inference');
  assert(hybridCalls.slice(beforeMap).filter(([kind]) => kind === 'details').length >= 2, 'map target and focus action must re-read current source');
  assert(mapped.places.some((p) => p.name === currentPlace.name), 'display uses current approved place');
  sourceAvailable = false;
  const vanished = await runHybridTurn('show Host fixture only on the map', [place], hybridDeps);
  assert(!vanished.places.some((p) => p.id === place.id), 'a vanished current source must never promote the startup snapshot');
  sourceAvailable = true;
  const contextual = await runHybridTurn('compare these options', [place], hybridDeps);
  assert.equal(contextual.execution, 'llm');
  assert.equal(hybridRuns, 1, 'contextual query gets one agent turn');
  const off = await runHybridTurn('compare these options', [place], { ...hybridDeps, canInfer: () => false });
  assert.notEqual(off.execution, 'llm');
  assert.equal(hybridRuns, 1, 'model-off fallback cannot invoke the agent');
  let failedRuns = 0;
  const failed = await runHybridTurn('find a quiet coffee place', [place], { ...hybridDeps, agent: { run: async () => { failedRuns++; return { status: 'failed', payloads: [], places: [], results: [] }; } } });
  assert.equal(failed.execution, 'fallback');
  assert.equal(failedRuns, 1, 'failed generation receives one direct fallback, with no retry');
  const beforeCanceled = hybridCalls.length;
  const canceled = await runHybridTurn('compare these options', [place], { ...hybridDeps, agent: { run: async () => ({ status: 'canceled', payloads: [], places: [], results: [] }) } });
  assert.equal(canceled.execution, 'fallback');
  assert.equal(hybridCalls.length, beforeCanceled, 'canceled turn must not start a fallback command');
  const deniedByAgent = await runHybridTurn('compare these options', [place], { ...hybridDeps, agent: { run: async () => ({ status: 'denied', payloads: [], places: [], results: [] }) } });
  assert.equal(deniedByAgent.execution, 'fallback');
  const abortController = new AbortController(); abortController.abort();
  const beforeAbort = hybridCalls.length;
  const aborted = await runHybridTurn('find coffee', [place], hybridDeps, { signal: abortController.signal });
  assert.equal(aborted.status, 'canceled');
  assert.equal(hybridCalls.length, beforeAbort, 'aborted request cannot execute retrieval tools');
  const { toolObservation } = load('src/ai/prompt.ts');
  const approvedObservation = JSON.parse(toolObservation({
    name: 'find_menu_items', callId: 'approved-price', status: 'ok', authority: 'approved',
    warnings: [], data: [{ branchId: place.id, coordinate: [121, 14], item: {
      id: 'approved-item', name: 'Ramen', price: '₱250', priceValue: { amount: '250.00', currency: 'PHP' },
    } }],
  }));
  assert.equal(approvedObservation.data[0].branchId, place.id);
  assert.deepEqual(approvedObservation.data[0].item.priceValue, { amount: '250.00', currency: 'PHP' });
  assert(!JSON.stringify(approvedObservation).includes('coordinate'), 'model observation must not include coordinates');
  const researchObservation = JSON.parse(toolObservation({
    name: 'search_food_research', callId: 'research-price', status: 'ok', authority: 'research',
    warnings: [], data: [{ restaurant: { id: place.id, name: 'Research fixture', coordinate: [121, 14] }, items: [
      { id: 'research-item', name: 'Ramen', amount: '275.00', currency: 'PHP', priceEvidence: 'estimated', branch: 'Fixture branch', coordinate: [121, 14] },
    ] }],
  }));
  assert.equal(researchObservation.data[0].items[0].amount, '275.00');
  assert.equal(researchObservation.data[0].items[0].currency, 'PHP');
  assert.equal(researchObservation.data[0].items[0].priceEvidence, 'estimated');
  assert.equal(researchObservation.data[0].items[0].branch, 'Fixture branch');
  assert(!JSON.stringify(researchObservation).includes('coordinate'), 'research observation must not include coordinates');

  // Exercise the bundled research asset and production retrieval adapter without native storage.
  const { foodResearch, foodPlaces } = load('src/features/food/directory.ts');
  const { createUnifiedRetrieval } = load('src/ai/retrieval.ts');
  const researchReads = [];
  const bundledRetrieval = createUnifiedRetrieval({
    findPlaces: async () => [], getPlaceDetails: async () => null, findMenuItems: async (filters) => {
      researchReads.push(['approvedMenu', filters]); return [];
    }, loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }),
    searchOffices: async () => ({ items: [], total: 0 }), getOfficeDetails: async () => null,
    foodResearch,
  });
  let bundledResearchSearches = 0;
  const searchBundledResearch = bundledRetrieval.searchFoodResearch.bind(bundledRetrieval);
  bundledRetrieval.searchFoodResearch = (...args) => { bundledResearchSearches++; return searchBundledResearch(...args); };
  const bundledExecutor = createToolExecutor(bundledRetrieval);
  const wooshi = foodPlaces.find((p) => p.name === 'Wooshi');
  assert(wooshi && foodResearch.available, 'bundled research fixture must be available');
  let modelOffCalls = 0;
  const bundledDeps = { agent: { run: async () => { modelOffCalls++; throw new Error('must remain off'); } },
    executor: bundledExecutor, canInfer: () => false, answerDirectory: async () => [] };
  const researchMenu = await runHybridTurn('menu of Wooshi', foodPlaces, bundledDeps);
  assert.equal(researchMenu.execution, 'deterministic');
  assert.equal(modelOffCalls, 0);
  assert(researchReads.some(([kind]) => kind === 'approvedMenu'), 'ordinary menu lookup checks approved records first');
  const researchMenus = researchMenu.payloads.find((p) => p.kind === 'food-menus');
  assert(researchMenus?.items.length, 'bundled restaurant name resolves to its recorded menu items');
  assert(researchMenus.items.every((entry) => entry.restaurantName === 'Wooshi' && entry.evidence?.origin === 'research'));
  assert(!researchMenu.payloads.some((p) => p.kind === 'text' && /matching menu items yet/i.test(p.text)), 'a successful research match must suppress the empty approved-menu message');
  assert(bundledResearchSearches >= 2, 'research search is repeated to revalidate before display');
  const researchHours = await runHybridTurn('recorded hours for Wooshi', foodPlaces, bundledDeps);
  assert.equal(researchHours.execution, 'deterministic');
  assert.equal(modelOffCalls, 0);
  assert(researchHours.payloads.some((p) => p.kind === 'food-hours' && p.restaurantName === 'Wooshi'), 'bundled restaurant name resolves to recorded hours');
  const searchesBeforeExclusion = bundledResearchSearches;
  const excluded = await runHybridTurn('menu of Wooshi approved only', foodPlaces, bundledDeps);
  assert(!excluded.payloads.some((p) => p.kind === 'food-menus'), 'approved-only request must exclude research menus');
  assert.equal(bundledResearchSearches, searchesBeforeExclusion, 'approved-only request must not search the research corpus');
  assert.equal(modelOffCalls, 0);
  let fallbackCalls = 0;
  const strictOnly = await runHybridTurn('verified only chicken under PHP 300', foodPlaces, {
    ...bundledDeps,
    answerDirectory: async () => { fallbackCalls++; return [{ kind: 'food-menus', title: 'sample', items: [], total: 0 }]; },
  });
  assert.equal(fallbackCalls, 0, 'verified-only empty results cannot fall through to fictional sample menu rendering');
  assert(!strictOnly.payloads.some((p) => p.kind === 'food-menus'));

  // A global approved menu match must not suppress a branch-specific research lookup.
  const globalBranch = '22222222-2222-4222-8222-222222222222';
  const scopedReads = [];
  let scopedResearchSearches = 0;
  const scopedRetrieval = {
    findMenuItems: async (filters) => {
      scopedReads.push(filters);
      return filters.branchId ? hybridEnvelope([], filters) : hybridEnvelope([{ branchId: globalBranch, item: { id: 'elsewhere' } }], filters);
    },
    searchFoodResearch: async (filters) => { scopedResearchSearches++; return hybridEnvelope([], filters, 'research'); },
    getPlaceDetails: async (id) => hybridEnvelope(null, { placeId: id }),
    findPlaces: async (filters) => hybridEnvelope([], filters),
    getVerifiedEntrances: async (id) => hybridEnvelope([], { placeId: id }),
    getOfficeDetails: async (id) => hybridEnvelope(null, { placeId: id }),
    findApprovedOffices: async (filters) => hybridEnvelope([], filters),
    getFoodResearchDetails: async (id, offset, limit, bounds) => hybridEnvelope([], { restaurantId: id, offset, limit, ...bounds }, 'research'),
  };
  const scopedExecutor = createToolExecutor(scopedRetrieval);
  const scopedResult = await scopedExecutor.execute(
    { name: 'search_food_research', arguments: { query: 'ramen' } },
    'branch-recheck',
    { requestId: 'branch-recheck', researchEnabled: true, ordinaryMenuResearch: true, ordinaryMenuBranchId: wooshi.id, resolvedPlaceIds: new Set() },
  );
  assert.equal(scopedResult.status, 'empty');
  assert.equal(scopedResearchSearches, 1, 'branch-specific empty result must proceed to research lookup');
  assert(scopedReads.some((filters) => filters.branchId === wooshi.id), 'approved-first recheck retains the selected branch ID');
  console.log(
    'PASS bounded agent tool selection, dispatch, result revalidation, follow-up transcript and grounded display (host fixtures)',
  );
  const { ModelResourceCoordinator } = load('src/ai/coordinator.ts');
  const coordinator = new ModelResourceCoordinator();
  let finishInitialize;
  let idleChecks = 0;
  let released;
  const cleanup = new Promise((resolve) => {
    released = resolve;
  });
  const bridge = {
    getCapabilities: async () => ({ android: true, backends: ['cpu'] }),
    initialize: () =>
      new Promise((resolve) => {
        finishInitialize = resolve;
      }),
    awaitNativeIdle: async () => {
      idleChecks++;
      return { idle: true };
    },
    release: async () => {
      released();
    },
  };
  const { NativeLiteRtProvider } = load('src/ai/NativeLiteRtProvider.ts', {
    '../../modules/omni-local-ai': { nativeLocalAi: null },
  });
  const provider = new NativeLiteRtProvider(bridge, coordinator, 100, 100, 5);
  await assert.rejects(provider.load({ ...candidate, contextTokens: 2048 }, 'cpu'));
  assert.equal(
    idleChecks,
    0,
    'initialization deadline must not poison a still-loading native engine by polling idle',
  );
  assert.equal(
    coordinator.isLeased(candidate.absolutePath),
    true,
    'keep lease while JNI initialize is pending',
  );
  finishInitialize();
  await cleanup;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    coordinator.isLeased(candidate.absolutePath),
    false,
    'release lease only after late initialization finishes and native cleanup succeeds',
  );
  console.log(
    'PASS exact query routing, strict tool schemas and late native initialization cleanup',
  );
  console.log(
    'PASS model activation, retry, restart verification and corrupt-file rejection (controlled native fake)',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
