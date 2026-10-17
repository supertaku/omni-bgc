const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');

function fixture(options = {}) {
  const cache = new Map(), files = new Map(); let manager, pointers = { active: null, previous: null, staged: null };
  let listener, idle = true, fetched = 0, imports = 0, initialized = [], generated = [], released = 0, historyClosed = 0, sequence = 0, savedReads = 0, savedWrites = 0;
  const native = {
    async getCapabilities() { return { android: true, abi: ['arm64-v8a'], backends: ['cpu'] }; },
    async initialize(input) { initialized.push(input.contextTokens); },
    async generate(input) {
      generated.push(input);
      idle = false;
      setTimeout(() => {
        listener({ requestId: input.requestId, epoch: input.epoch, sequence: 0, type: 'delta', mode: 'delta', text: 'Hello!' });
        if (!input.requestId.startsWith('model-smoke-') || input.maxOutputTokens !== 256) { idle = true; listener({ requestId: input.requestId, epoch: input.epoch, sequence: 1, type: 'terminal', reason: 'complete' }); }
      }, 0);
    },
    async cancel() { idle = true; return { accepted: true, nativeQuiescent: false }; },
    async awaitNativeIdle() { return { idle }; }, async release() { released++; },
    addListener(_, callback) { listener = callback; return { remove() {} }; },
  };
  const mocks = {
    'expo-crypto': { randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` },
    'expo-file-system': { File: { pickFileAsync: async () => { await options.onPicker?.(); return options.pickerCanceled ? { canceled: true } : { canceled: false, result: { uri: 'content://picker/SYNTHETIC-MODEL' } }; } } },
    '../../modules/omni-local-ai': { nativeLocalAi: native },
    '../data/store': { applySavedPatch: async () => { savedWrites++; throw Error('No writes authorized by this test'); }, loadSaved: async () => { savedReads++; throw Error('No saved reads authorized by this runtime'); } },
    '../data/retrieval': { getPlaceDetails: async () => null },
    './retrieval': { createAppRetrieval: async () => ({ getPlaceDetails: async id => ({data: options.place?.id === id ? options.place : null}) }) },
    './conversationStore': { ConversationStore: class { async load() { return []; } async append() {} async clear() {} async close() { historyClosed++; if (options.historyCloseFailure) throw Error('TEST history close failed'); } } },
    './modelStorage': { createExpoModelManager: async () => manager },
  };
  const { modelResourceCoordinator } = loadTs('apps/mobile/src/ai/coordinator.ts', mocks, {}, cache);
  const { ModelManager } = loadTs('apps/mobile/src/ai/modelManager.ts', mocks, {}, cache);
  const { GEMMA_4_E2B: model } = loadTs('apps/mobile/src/ai/modelCatalog.ts', mocks, {}, cache);
  const storage = {
    partialPath: entry => '/private/' + entry.sha256 + '.partial', finalPath: entry => '/private/' + entry.sha256 + '.litertlm',
    size: async path => files.get(path)?.bytes ?? null, freeBytes: async () => model.bytes * 3,
    hash: async path => files.get(path)?.sha256,
    download: async (entry, destination) => { fetched++; files.set(destination, { bytes: entry.bytes, sha256: entry.sha256 }); },
    importFile: async (uri, destination, signal) => { imports++; assert.equal(uri, 'content://picker/SYNTHETIC-MODEL'); await options.onImport?.(signal); if (signal?.aborted) throw Error('MODEL_SETUP_CANCELLED'); files.set(destination, { bytes: model.bytes, sha256: model.sha256 }); },
    finalize: async (source, destination) => { files.set(destination, files.get(source)); files.delete(source); },
    remove: async path => files.delete(path), readPointers: async () => JSON.parse(JSON.stringify(pointers)),
    writePointers: async value => { pointers = JSON.parse(JSON.stringify(value)); },
  };
  manager = new ModelManager(storage, modelResourceCoordinator);
  const { createAssistantRuntime } = loadTs('apps/mobile/src/ai/assistantRuntime.ts', mocks, {}, cache);
  return { createAssistantRuntime, manager, modelResourceCoordinator, model, files, initialized, generated, mocks, cache,
    pointers: () => pointers, networkCalls: () => fetched, imports: () => imports, releases: () => released, historyClosed: () => historyClosed, savedReads: () => savedReads, savedWrites: () => savedWrites };
}

test('actual Assistant runtime composes actual manager/provider/shared lease for setup, smoke, ready, uninstall and close', async () => {
  const h = fixture(), runtime = await h.createAssistantRuntime(() => { throw Error('Unexpected map mutation'); });
  assert.equal(await runtime.initialize(), false); assert.equal(h.networkCalls(), 0);
  const signal = new AbortController().signal;
  await runtime.setup(signal); assert.equal(h.networkCalls(), 1); assert.equal(h.pointers().active, null); assert.equal(h.manager.getStatus().state, 'PENDING_NATIVE_SMOKE_TEST');
  await runtime.activate(signal); assert.equal(h.pointers().active.id, h.model.id); assert.equal(runtime.provider.state, 'READY');
  assert.deepEqual(h.initialized, [2048, 2048, 4096]);
  assert.equal(h.modelResourceCoordinator.isLeased(h.pointers().active.absolutePath), true);
  await assert.rejects(h.manager.removeInstalled(h.model.id, { userInitiated: true }), { code: 'SESSION_POISONED' });
  await runtime.removeModel(); assert.equal(h.pointers().active, null); assert.equal(h.files.size, 0); assert.equal(runtime.provider.state, 'RELEASED');
  await runtime.close(); assert.equal(h.historyClosed(), 1); assert.equal(h.releases(), 3);
});

test('runtime always releases native ownership when independent history database close fails', async () => {
  const h = fixture({ historyCloseFailure: true }), runtime = await h.createAssistantRuntime(() => false);
  await runtime.setup(new AbortController().signal); await runtime.activate(new AbortController().signal);
  const activePath = h.pointers().active.absolutePath;
  await assert.rejects(runtime.close(), /history close failed/);
  assert.equal(h.modelResourceCoordinator.isLeased(activePath), false); assert.equal(runtime.provider.state, 'RELEASED');
});

function actualHook(h) {
  const { hookHarness } = require('../helpers/hooks.cjs');
  const hooks = hookHarness(), events = {}; let runtime, fallbackCalls = 0;
  const { useAssistantConversation } = loadTs('apps/mobile/src/features/assistant/useAssistantConversation.ts', {
    ...h.mocks, react: hooks.React,
    'react-native': { AppState: { addEventListener: (name, callback) => { events[name] = callback; return { remove: () => delete events[name] }; } } },
    './directory': { answerDirectoryQuery: () => { fallbackCalls++; return []; } }, '../food/assistant': { createFoodResearchAnswer: () => () => [] }, '../food/directory': { foodResearch: {} },
    '../../ai/assistantRuntime': { createAssistantRuntime: async (...args) => { runtime = await h.createAssistantRuntime(...args); return runtime; } },
  }, {}, h.cache);
  const render = () => hooks.render(() => useAssistantConversation([], () => false));
  render(); return { render, hooks, events, runtime: () => runtime, fallbackCalls: () => fallbackCalls, ready: async () => { await new Promise(resolve => setImmediate(resolve)); return render(); } };
}

async function activeHook(options) {
  const h = fixture(options), seed = await h.createAssistantRuntime(() => false);
  await seed.setup(new AbortController().signal);
  await seed.activate(new AbortController().signal);
  await seed.close();
  const ui = actualHook(h);
  await ui.ready();
  assert.equal(ui.runtime().provider.state, 'READY');
  return { h, ui };
}
async function settleChat(ui) {
  for (let i = 0; i < 40 && ui.render().busy; i++)
    await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(ui.render().busy, false);
}

test('active model picker cancellation preserves actual readiness and next chat uses native agent', async () => {
  const { h, ui } = await activeHook({ pickerCanceled: true });
  const before = h.generated.length, releases = h.releases();
  await ui.render().modelOperation('import');
  assert.equal(h.imports(), 0); assert.equal(h.releases(), releases);
  assert.equal(ui.runtime().provider.state, 'READY'); assert.equal(ui.render().modelReady, true);
  assert.equal(ui.render().setupStatus.state, 'ACTIVE');
  assert.equal(ui.render().send('hello'), true); await settleChat(ui);
  assert.equal(h.generated.length, before + 1); assert.equal(ui.fallbackCalls(), 0);
  ui.hooks.dispose();
});

test('failed import after release falls back, then explicit Use rechecks retained active model and restores chat', async () => {
  const { h, ui } = await activeHook({ onImport: () => { throw Error('TEST_IMPORT_FAILED'); } });
  const before = h.generated.length;
  await ui.render().modelOperation('import');
  assert.equal(ui.runtime().provider.state, 'RELEASED'); assert.equal(ui.render().modelReady, false);
  assert.equal(ui.render().setupStatus.state, 'ACTIVE'); assert.ok(h.pointers().active);
  assert.equal(ui.render().send('hello'), true); await settleChat(ui);
  assert.equal(h.generated.length, before); assert.equal(ui.fallbackCalls(), 1);
  const loads = h.initialized.length;
  await ui.render().modelOperation('activate');
  assert.equal(h.initialized.length, loads + 1); assert.equal(ui.runtime().provider.state, 'READY');
  assert.equal(ui.render().modelReady, true);
  assert.equal(ui.render().send('hello'), true); await settleChat(ui);
  assert.equal(h.generated.length, before + 1); assert.equal(ui.fallbackCalls(), 1);
  ui.hooks.dispose();
});

test('explicit retained-model recovery rejects changed bytes before native reload', async () => {
  const { h, ui } = await activeHook({ onImport: () => { throw Error('TEST_IMPORT_FAILED'); } });
  await ui.render().modelOperation('import');
  const loads = h.initialized.length, before = h.generated.length;
  h.files.get(h.pointers().active.absolutePath).sha256 = '0'.repeat(64);
  await ui.render().modelOperation('activate');
  assert.equal(h.initialized.length, loads); assert.equal(ui.render().modelReady, false);
  assert.equal(h.pointers().active, null); assert.equal(ui.render().setupStatus.state, 'NOT_INSTALLED');
  ui.render().send('hello'); await settleChat(ui);
  assert.equal(h.generated.length, before); assert.equal(ui.fallbackCalls(), 1);
  ui.hooks.dispose();
});

test('actual hook+runtime keep selected file import alive across expected system-picker background', async () => {
  let ui;
  const h = fixture({ onPicker: () => { ui.events.change('background'); } }); ui = actualHook(h);
  const state = await ui.ready(); await state.modelOperation('import');
  assert.equal(h.imports(), 1); assert.ok(h.pointers().staged); assert.equal(h.pointers().active, null); assert.equal(ui.render().busy, false);
  ui.hooks.dispose();
});

test('actual hook+runtime still cancel local model import copy on real background after picker closes', async () => {
  let ui, observedSignal;
  const h = fixture({ onImport: signal => { observedSignal = signal; ui.events.change('background'); } }); ui = actualHook(h);
  const state = await ui.ready(); await state.modelOperation('import');
  assert.equal(h.imports(), 1); assert.equal(observedSignal.aborted, true); assert.equal(h.pointers().staged, null); assert.equal(ui.render().busy, false);
  ui.hooks.dispose();
});

test('actual runtime file-picker import stages without online setup or implicit activation', async () => {
  const h = fixture(), runtime = await h.createAssistantRuntime(() => false);
  await runtime.importModel(new AbortController().signal);
  assert.equal(h.networkCalls(), 0); assert.equal(h.imports(), 1); assert.equal(h.pointers().active, null); assert.ok(h.pointers().staged);
  await runtime.close(); assert.equal(h.initialized.length, 0);
});

test('actual runtime canceled activation never commits ACTIVE', async () => {
  const h = fixture(), runtime = await h.createAssistantRuntime(() => false);
  await runtime.setup(new AbortController().signal); const abort = new AbortController(); abort.abort();
  await assert.rejects(runtime.activate(abort.signal), /CANCELLED/);
  assert.equal(h.pointers().active, null); assert.equal(h.initialized.length, 0); await runtime.close();
});


test('runtime composes only session itinerary memory and never reads or writes retained saved state',async()=>{
 const place={id:'00000000-0000-4000-8000-000000000001',name:'Synthetic runtime preview stop',status:'approved',citations:[{status:'approved',sourceId:'TEST',label:'Synthetic source',license:'CC0-1.0',factId:'TEST',snapshotId:'TEST',evidenceId:'TEST',locator:'fixture://test',verificationMethod:'synthetic',rawSha256:'a'.repeat(64),observedAt:'2026-01-01T00:00:00Z',verifiedAt:'2026-01-02T00:00:00Z'}]};
 const h=fixture({place});const runtime=await h.createAssistantRuntime(()=>false);
 assert.equal(runtime.mutations,undefined);const draft=await runtime.itineraryPreview.preview([{placeId:place.id,durationMinutes:25}],'HOST');assert.equal(draft.stops[0].name,place.name);
 assert.equal((await runtime.itineraryPreview.read()).totalVisitMinutes,25);assert.equal(h.savedReads(),0);assert.equal(h.savedWrites(),0);
 await runtime.close();assert.equal((await runtime.itineraryPreview.read()).stops.length,0);
 const next=await h.createAssistantRuntime(()=>false);assert.equal((await next.itineraryPreview.read()).stops.length,0);await next.close();assert.equal(h.savedReads(),0);assert.equal(h.savedWrites(),0);
});
