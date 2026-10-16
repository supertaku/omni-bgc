const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');

function fixture(options = {}) {
  const cache = new Map(), files = new Map(); let manager, pointers = { active: null, previous: null, staged: null };
  let listener, idle = true, fetched = 0, imports = 0, initialized = [], released = 0, historyClosed = 0, sequence = 0;
  const native = {
    async getCapabilities() { return { android: true, abi: ['arm64-v8a'], backends: ['cpu'] }; },
    async initialize(input) { initialized.push(input.contextTokens); },
    async generate(input) {
      idle = false;
      setTimeout(() => {
        listener({ requestId: input.requestId, epoch: input.epoch, sequence: 0, type: 'delta', mode: 'delta', text: 'Hello!' });
        if (input.maxOutputTokens !== 256) { idle = true; listener({ requestId: input.requestId, epoch: input.epoch, sequence: 1, type: 'terminal', reason: 'complete' }); }
      }, 0);
    },
    async cancel() { idle = true; return { accepted: true, nativeQuiescent: false }; },
    async awaitNativeIdle() { return { idle }; }, async release() { released++; },
    addListener(_, callback) { listener = callback; return { remove() {} }; },
  };
  const mocks = {
    'expo-crypto': { randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` },
    'expo-file-system': { File: { pickFileAsync: async () => { await options.onPicker?.(); return { canceled: false, result: { uri: 'content://picker/SYNTHETIC-MODEL' } }; } } },
    '../../modules/omni-local-ai': { nativeLocalAi: native },
    '../data/store': { applySavedPatch: async () => { throw Error('No writes authorized by this test'); }, loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }) },
    '../data/retrieval': { getPlaceDetails: async () => null },
    './retrieval': { createAppRetrieval: async () => ({}) },
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
  return { createAssistantRuntime, manager, modelResourceCoordinator, model, files, initialized, mocks, cache,
    pointers: () => pointers, networkCalls: () => fetched, imports: () => imports, releases: () => released, historyClosed: () => historyClosed };
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
  const hooks = hookHarness(), events = {};
  const { useAssistantConversation } = loadTs('apps/mobile/src/features/assistant/useAssistantConversation.ts', {
    ...h.mocks, react: hooks.React,
    'react-native': { AppState: { addEventListener: (name, callback) => { events[name] = callback; return { remove: () => delete events[name] }; } } },
    './directory': { answerDirectoryQuery: () => [] }, '../food/assistant': { createFoodResearchAnswer: () => () => [] }, '../food/directory': { foodResearch: {} },
    '../../ai/assistantRuntime': { createAssistantRuntime: h.createAssistantRuntime },
  }, {}, h.cache);
  const render = () => hooks.render(() => useAssistantConversation([], { placeIds: [], itinerary: [], startTime: null }, () => false));
  render(); return { render, hooks, events, ready: async () => { await new Promise(resolve => setImmediate(resolve)); return render(); } };
}

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
