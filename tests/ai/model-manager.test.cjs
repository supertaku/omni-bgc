const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { ModelManager, createProviderSmokeRunner } = loadTs('apps/mobile/src/ai/modelManager.ts');
const { GEMMA_4_E2B: model } = loadTs('apps/mobile/src/ai/modelCatalog.ts');
const clone = value => JSON.parse(JSON.stringify(value));
const setup = { kind: 'download', userInitiated: true, licenseAcknowledged: true };
function harness() {
  const files = new Map(); let pointers = { active: null, previous: null, staged: null }, leased = false, mutation = false;
  let writeFailure = false, badHash = false, networkCalls = 0, free = model.bytes * 4;
  const storage = {
    partialPath: entry => '/private/' + entry.sha256 + '.partial', finalPath: entry => '/private/' + entry.sha256 + '.litertlm',
    size: async path => files.get(path)?.bytes ?? null, freeBytes: async () => free,
    hash: async path => badHash ? 'bad' : files.get(path)?.sha256,
    async download(entry, target, progress, signal) { networkCalls++; if (signal?.aborted) throw Error('cancel'); files.set(target, { bytes: entry.bytes, sha256: entry.sha256 }); progress(entry.bytes); },
    async importFile(uri, target) { files.set(target, { bytes: model.bytes, sha256: model.sha256 }); },
    async finalize(partial, target) { files.set(target, files.get(partial)); files.delete(partial); },
    async remove(path) { files.delete(path); },
    async readPointers() { return clone(pointers); },
    async writePointers(value) { if (writeFailure) throw Error('TEST commit failed'); pointers = clone(value); },
  };
  const guard = { async withModelMutation(work) { if (leased || mutation) throw Error('TEST leased'); mutation = true; try { return await work(); } finally { mutation = false; } } };
  return { manager: new ModelManager(storage, guard), storage, files, pointers: () => clone(pointers), setPointers: value => { pointers = clone(value); },
    setLeased: value => { leased = value; }, failWrite: value => { writeFailure = value; }, badHash: value => { badHash = value; },
    setFree: value => { free = value; }, networkCalls: () => networkCalls };
}
function smoke(overrides = {}) {
  const order = [];
  return { kind: 'native', order, async load() { order.push('load'); }, async generateText() { order.push('generate'); return 'TEST generated tokens'; },
    async cancelGenerationAndWait() { order.push('cancel'); return { cancelled: true, nativeIdle: true }; }, async release() { order.push('release'); }, ...overrides };
}
test('catalog pins reviewed public artifact without claiming device support', () => {
  assert.match(model.sourceRevision, /^[a-f0-9]{40}$/); assert.match(model.sha256, /^[a-f0-9]{64}$/);
  assert.equal(model.bytes, 2588147712); assert.equal(model.gated, false); assert.equal(model.license, 'Apache-2.0');
  assert.equal(model.approvalStatus, 'PROVISIONAL_PENDING_M10'); assert.equal(model.testedDeviceProfile, null); assert.equal(model.testedBackends.length, 0);
  assert.ok(model.url.includes(model.sourceRevision));
});
test('setup requires explicit user action and license acknowledgment; recover never networks', async () => {
  const h = harness(); await h.manager.recover(); assert.equal(h.networkCalls(), 0);
  await assert.rejects(h.manager.install(model.id, { ...setup, userInitiated: false }), /CONSENT/);
  await assert.rejects(h.manager.install(model.id, { ...setup, licenseAcknowledged: false }), /CONSENT/);
  await assert.rejects(h.manager.install('arbitrary-model', setup), /NOT_REVIEWED/); assert.equal(h.networkCalls(), 0);
});
test('download stages verified immutable artifact and does not activate before real smoke', async () => {
  const h = harness(), states = []; h.manager.subscribe(status => states.push(status.state));
  const result = await h.manager.install(model.id, setup);
  assert.equal(result.verified, true); assert.equal(h.pointers().active, null); assert.equal(h.pointers().staged.sha256, model.sha256);
  assert.equal(h.manager.getStatus().state, 'PENDING_NATIVE_SMOKE_TEST');
  assert.ok(states.includes('VERIFYING')); assert.ok(states.includes('STAGED')); assert.equal(h.files.has(h.storage.partialPath(model)), false);
});
test('local import never invokes network', async () => {
  const h = harness(); await h.manager.install(model.id, { kind: 'import', sourceUri: 'content://picker/TEST', userInitiated: true, licenseAcknowledged: true });
  assert.equal(h.networkCalls(), 0);
});
test('bad size/hash clears corrupt partial and preserves old pointer', async () => {
  const h = harness(); h.badHash(true); await assert.rejects(h.manager.install(model.id, setup), /HASH_MISMATCH/);
  assert.equal(h.files.size, 0); assert.equal(h.pointers().active, null); assert.equal(h.manager.getStatus().state, 'FAILED');
});
test('preflight disk prevents download', async () => {
  const h = harness(); h.setFree(0); await assert.rejects(h.manager.install(model.id, setup), /STORAGE_INSUFFICIENT/); assert.equal(h.networkCalls(), 0);
});
test('pre-cancelled setup does not access network', async () => {
  const h = harness(), controller = new AbortController(); controller.abort();
  await assert.rejects(h.manager.install(model.id, setup, controller.signal), /CANCELLED/); assert.equal(h.networkCalls(), 0);
});
test('cancelled transfer retains partial for explicit retry', async () => {
  const h = harness(), controller = new AbortController();
  h.storage.download = async (entry, target) => { h.files.set(target, { bytes: 123, sha256: entry.sha256 }); controller.abort(); throw Error('TEST aborted'); };
  await assert.rejects(h.manager.install(model.id, setup, controller.signal));
  assert.equal(h.files.get(h.storage.partialPath(model)).bytes, 123); assert.equal(h.manager.getStatus().state, 'PAUSED'); assert.equal(h.pointers().active, null);
});
test('CONTROLLED FAKE ENGINE: activation actually performs generate, cancel, release, reload, regenerate', async () => {
  const h = harness(), runner = smoke(); await h.manager.install(model.id, setup); await h.manager.activate(runner);
  assert.deepEqual(runner.order, ['load', 'generate', 'cancel', 'release', 'load', 'generate', 'release']);
  assert.equal(h.manager.getStatus().state, 'ACTIVE'); assert.equal(h.pointers().staged, null); assert.equal(h.pointers().active.sha256, model.sha256);
});
test('CONTROLLED FAKE ENGINE: empty generation or incomplete cancellation cannot activate', async () => {
  for (const overrides of [{ generateText: async () => ' ' }, { cancelGenerationAndWait: async () => ({ cancelled: true, nativeIdle: false }) }]) {
    const h = harness(); await h.manager.install(model.id, setup); await assert.rejects(h.manager.activate(smoke(overrides)));
    assert.equal(h.pointers().active, null); assert.ok(h.pointers().staged);
  }
});
test('CONTROLLED FAKE ENGINE: reload failure preserves previous active pointer', async () => {
  const h = harness(); await h.manager.install(model.id, setup); const candidate = h.pointers().staged;
  h.setPointers({ active: candidate, previous: null, staged: candidate }); let calls = 0;
  await assert.rejects(h.manager.activate(smoke({ async load() { if (++calls === 2) throw Error('TEST reload'); } })), /reload/);
  assert.deepEqual(h.pointers().active, candidate);
});
test('failed atomic commit keeps prior pointer and staged artifact', async () => {
  const h = harness(); await h.manager.install(model.id, setup); const before = h.pointers(); h.failWrite(true);
  await assert.rejects(h.manager.activate(smoke()), /commit/); assert.deepEqual(h.pointers(), before);
});
test('native lease prevents deletion and pointer activation even when smoke returns', async () => {
  const h = harness(); h.setLeased(true); await assert.rejects(h.manager.install(model.id, setup), /leased/);
  assert.equal(h.pointers().staged, null); h.setLeased(false); await h.manager.install(model.id, setup); h.setLeased(true);
  await assert.rejects(h.manager.remove(model.id), /leased/); await assert.rejects(h.manager.activate(smoke()), /leased/); assert.equal(h.pointers().active, null);
});
test('restart verifies active artifact; corrupt path is never returned as verified', async () => {
  const h = harness(); await h.manager.install(model.id, setup); await h.manager.activate(smoke());
  await h.manager.recover(); assert.equal(h.networkCalls(), 1); h.badHash(true);
  const pointers = await h.manager.recover(); assert.equal(pointers.active, null); assert.equal(h.manager.getStatus().state, 'FAILED');
});
test('referenced active artifact cannot be deleted and queued operations recover after failure', async () => {
  const h = harness(); await h.manager.install(model.id, setup); await h.manager.activate(smoke());
  await assert.rejects(h.manager.remove(model.id), /REFERENCED/); assert.equal(h.files.size, 1);
  await h.manager.recover(); assert.equal(h.manager.getStatus().state, 'ACTIVE');
});
test('pointer path tampering is rejected on restart', async () => {
  const h = harness(); await h.manager.install(model.id, setup); const pointers = h.pointers(); pointers.staged.absolutePath = '/etc/arbitrary'; h.setPointers(pointers);
  assert.equal((await h.manager.recover()).staged, null); assert.equal(h.manager.getStatus().state, 'FAILED');
});
test('explicit uninstall atomically clears pointers before deleting weights and native lease rejects it', async () => {
  const h = harness(); await h.manager.install(model.id, setup); await h.manager.activate(smoke());
  h.setLeased(true); await assert.rejects(h.manager.removeInstalled(model.id, { userInitiated: true }), /leased/); assert.equal(h.files.size, 1);
  h.setLeased(false); h.failWrite(true); await assert.rejects(h.manager.removeInstalled(model.id, { userInitiated: true }), /commit/); assert.equal(h.files.size, 1);
  h.failWrite(false); await h.manager.removeInstalled(model.id, { userInitiated: true }); assert.equal(h.files.size, 0); assert.equal(h.pointers().active, null);
});
test('real provider smoke adapter cancels only after real streamed delta and checks native-idle acknowledgment', async () => {
  let activeRequest, cancelled = false, loads = 0, releases = 0;
  const provider = {
    async load() { loads++; }, async release() { releases++; },
    async generate(request) { return { text: 'READY', finishReason: 'complete', nativeQuiescent: true, toolProposals: [] }; },
    async stream(request, event) { activeRequest = request.requestId; event({ type: 'delta', text: 'One' }); return { finishReason: 'cancelled', nativeQuiescent: false }; },
    async cancel(requestId) { assert.equal(requestId, activeRequest); cancelled = true; return { accepted: true, nativeQuiescent: true }; },
  };
  const runner = createProviderSmokeRunner(provider); await runner.load({}); assert.equal(await runner.generateText(), 'READY');
  const ack = await runner.cancelGenerationAndWait(); assert.equal(ack.cancelled, true); assert.equal(ack.nativeIdle, true); assert.equal(cancelled, true);
  await runner.release(); assert.equal(loads, 1); assert.equal(releases, 1);
});
test('CONTROLLED NATIVE BRIDGE: actual manager + actual provider + smoke adapter complete cancellation/reload activation', async () => {
  const { NativeLiteRtProvider } = loadTs('apps/mobile/src/ai/NativeLiteRtProvider.ts', { '../../modules/omni-local-ai': { nativeLocalAi: null } });
  const { ModelResourceCoordinator } = loadTs('apps/mobile/src/ai/coordinator.ts');
  let listener, idle = true, initializations = 0, releases = 0, cancellations = 0;
  const native = {
    async getCapabilities() { return { android: true, abi: ['arm64-v8a'], backends: ['cpu'] }; },
    async initialize() { initializations++; },
    async generate(request) {
      idle = false;
      setTimeout(() => {
        const emit = (sequence, details) => listener({ ...details, sequence, requestId: request.requestId, epoch: request.epoch });
        emit(0, { type: 'delta', mode: 'delta', text: 'READY' });
        if (request.maxOutputTokens === 32) { idle = true; emit(1, { type: 'terminal', reason: 'complete' }); }
      }, 0);
    },
    async cancel() { cancellations++; idle = true; return { accepted: true, nativeQuiescent: false }; },
    async awaitNativeIdle() { return { idle }; }, async release() { releases++; },
    addListener(_, handler) { listener = handler; return { remove() {} }; },
  };
  const h = harness(), resource = new ModelResourceCoordinator(), manager = new ModelManager(h.storage, resource);
  const provider = new NativeLiteRtProvider(native, resource, 100, 1000);
  await manager.install(model.id, setup); await manager.activate(createProviderSmokeRunner(provider));
  assert.equal(initializations, 2); assert.equal(cancellations, 1); assert.equal(releases, 2);
  assert.equal(manager.getStatus().state, 'ACTIVE'); assert.equal(resource.isLeased(h.storage.finalPath(model)), false);
});
test('Stop during native smoke load prevents generation and ACTIVE commit while releasing runner', async () => {
  const h = harness(), abort = new AbortController(); let generated = 0, released = 0;
  await h.manager.install(model.id, setup);
  const runner = smoke({ async load() { abort.abort(); }, async generateText() { generated++; return 'TEST'; }, async release() { released++; } });
  await assert.rejects(h.manager.activate(runner, abort.signal), /CANCELLED/);
  assert.equal(generated, 0); assert.equal(released, 1); assert.equal(h.pointers().active, null); assert.ok(h.pointers().staged); assert.equal(h.manager.getStatus().state, 'PAUSED');
});
