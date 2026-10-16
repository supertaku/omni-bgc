const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { NativeLiteRtProvider } = loadTs('apps/mobile/src/ai/NativeLiteRtProvider.ts', { '../../modules/omni-local-ai': { nativeLocalAi: null } });
const { ModelResourceCoordinator } = loadTs('apps/mobile/src/ai/coordinator.ts');
const model = { id: 'TEST_ONLY_MODEL', absolutePath: '/private/TEST_ONLY.litertlm', sha256: 'a'.repeat(64), bytes: 32, verified: true };
const input = (epoch = 1) => ({ requestId: `test_${epoch}`, epoch, messages: [{ role: 'user', text: 'Hello' }], contextTokens: 2048, maxOutputTokens: 128, toolContractRevision: '1', allowedCapabilities: [] });
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function harness(options = {}) {
  let listener, removed = 0, released = 0, cancelled = 0, idle = true;
  const bridge = {
    async getCapabilities() { return { android: true, abi: ['arm64-v8a'], backends: ['cpu', 'gpu'], thermalBlocked: !!options.thermal }; },
    async initialize() { if (options.loadFailure) throw options.loadFailure; },
    async generate() { idle = false; if (options.generateFailure) { idle = true; throw options.generateFailure; } },
    async cancel() { cancelled++; if (options.cancelReject) throw Error('TEST cancellation failure'); if (options.cancelHang) return new Promise(() => {}); idle = !options.idleHang; return { accepted: true, nativeQuiescent: false }; },
    async awaitNativeIdle() { return { idle }; },
    async release() { released++; if (options.releaseFailure) throw Error('TEST cleanup failure'); },
    addListener(_event, callback) { listener = callback; return { remove() { removed++; } }; },
  };
  const resources = new ModelResourceCoordinator();
  const provider = new NativeLiteRtProvider(bridge, resources, 15, 1000);
  return { provider, resources, bridge, emit(event) { listener(event); }, idle() { idle = true; }, removed: () => removed, released: () => released, cancelled: () => cancelled };
}
test('unavailable bridge reports unknown observed backend and fails safely', async () => {
  const provider = new NativeLiteRtProvider(null); const caps = await provider.getCapabilities();
  assert.equal(caps.nativeModulePresent, false); assert.equal(caps.backendObserved, 'unknown');
  await assert.rejects(provider.load(model, 'cpu'), { code: 'RUNTIME_UNSUPPORTED' });
});
test('delta/cumulative semantics, stale epochs, duplicate terminal and unsubscribe', async () => {
  const h = harness(); await h.provider.load(model, 'cpu'); const events = []; const result = h.provider.stream(input(), event => events.push(event));
  const event = (sequence, fields) => ({ requestId: 'test_1', epoch: 1, sequence, ...fields });
  h.emit({ ...event(0, { type: 'delta', text: 'INVALID', mode: 'delta' }), epoch: 0 });
  h.emit(event(1, { type: 'delta', text: 'Hello', mode: 'delta' }));
  h.emit(event(1, { type: 'delta', text: 'DUPLICATE', mode: 'delta' }));
  h.emit(event(2, { type: 'delta', text: 'Hello there', mode: 'cumulative' }));
  h.idle(); h.emit(event(3, { type: 'terminal', reason: 'complete' })); h.emit(event(4, { type: 'terminal', reason: 'complete' }));
  assert.equal((await result).text, 'Hello there'); await flush();
  assert.deepEqual(events.filter(event => event.type === 'delta').map(event => event.text), ['Hello', ' there']);
  assert.equal(events.filter(event => event.type === 'terminal').length, 1); assert.equal(h.removed(), 1);
  await h.provider.release(); assert.equal(h.resources.isLeased(model.absolutePath), false);
});
test('concurrent request and model mutation denied throughout engine lease', async () => {
  const h = harness(); await h.provider.load(model, 'cpu');
  const active = h.provider.generate(input()); await assert.rejects(h.provider.generate(input(2)), { code: 'SESSION_POISONED' });
  await assert.rejects(h.resources.withModelMutation(async () => 1));
  const ack = await h.provider.cancel('test_1'); assert.equal(ack.nativeQuiescent, true); assert.equal((await active).finishReason, 'cancelled');
  assert.equal(h.resources.isLeased(model.absolutePath), true); await h.provider.release(); await h.provider.release(); assert.equal(h.released(), 1);
});
test('Stop settles caller before native ack; duplicate Stop sends one request', async () => {
  const h = harness({ cancelHang: true }); await h.provider.load(model, 'cpu'); const result = h.provider.generate(input());
  const first = h.provider.cancel('test_1'), second = h.provider.cancel('test_1');
  assert.equal((await result).finishReason, 'cancelled');
  await assert.rejects(first, { code: 'CANCEL_TIMEOUT' }); await assert.rejects(second, { code: 'CANCEL_TIMEOUT' });
  assert.equal(h.cancelled(), 1); assert.equal(h.resources.isLeased(model.absolutePath), true);
  await assert.rejects(h.provider.generate(input(2)), { code: 'SESSION_POISONED' }); await assert.rejects(h.provider.release(), { code: 'CANCEL_TIMEOUT' });
});
test('false native idle poisons and retains file lease, including late terminal', async () => {
  const h = harness({ idleHang: true }); await h.provider.load(model, 'cpu'); const result = h.provider.generate(input());
  assert.equal((await h.provider.cancel('test_1')).nativeQuiescent, false); await result;
  h.idle(); h.emit({ type: 'terminal', reason: 'cancelled', requestId: 'test_1', epoch: 1, sequence: 100 }); await flush();
  assert.equal(h.provider.state, 'FAILED'); assert.equal(h.resources.isLeased(model.absolutePath), true);
  await assert.rejects(h.provider.release(), { code: 'SESSION_POISONED' });
});
test('abort listener, stale epoch replay, output budget and hash metadata validated', async () => {
  const h = harness(); await assert.rejects(h.provider.load({ ...model, sha256: 'bad' }, 'cpu'), { code: 'MODEL_HASH_MISMATCH' });
  await h.provider.load(model, 'cpu'); await assert.rejects(h.provider.generate({ ...input(), maxOutputTokens: 900 }), { code: 'CONTEXT_OVERFLOW' });
  const abort = new AbortController(); const result = h.provider.generate({ ...input(), signal: abort.signal }); abort.abort(); assert.equal((await result).finishReason, 'cancelled'); await flush();
  await assert.rejects(h.provider.generate(input()), { code: 'TOOL_PROTOCOL_INVALID' }); await h.provider.release();
});
test('native errors map to safe codes and cleanup failure never frees model', async () => {
  const h = harness({ loadFailure: { code: 'MODEL_HASH_MISMATCH' } }); await assert.rejects(h.provider.load(model, 'cpu'), { code: 'MODEL_HASH_MISMATCH' }); assert.equal(h.resources.isLeased(model.absolutePath), false);
  const h2 = harness({ releaseFailure: true }); await h2.provider.load(model, 'cpu'); await assert.rejects(h2.provider.release(), { code: 'UNEXPECTED_NATIVE_FAILURE' }); assert.equal(h2.resources.isLeased(model.absolutePath), true);
});
test('thermal block and lifecycle mutation reservation stop unsafe native entry', async () => {
  const h = harness({ thermal: true }); await assert.rejects(h.provider.load(model, 'cpu'), { code: 'THERMAL_BLOCK' });
  const resource = new ModelResourceCoordinator(); let resolve; const mutation = resource.withModelMutation(() => new Promise(r => { resolve = r; }));
  assert.throws(() => resource.acquire('TEST')); resolve(); await mutation; const lease = resource.acquire('TEST'); lease.release(); lease.release(); assert.equal(resource.isLeased('TEST'), false);
});
test('malformed cumulative output is rejected and cancelled; consumer errors cannot block cleanup', async () => {
  const h = harness(); await h.provider.load(model, 'cpu'); const result = h.provider.stream(input(), () => { throw Error('TEST UI failure'); });
  h.emit({ type: 'delta', requestId: 'test_1', epoch: 1, sequence: 0, mode: 'delta', text: 'Hello' });
  h.emit({ type: 'delta', requestId: 'test_1', epoch: 1, sequence: 1, mode: 'cumulative', text: 'different' });
  await assert.rejects(result, { code: 'TOOL_PROTOCOL_INVALID' }); await flush(); assert.equal(h.cancelled(), 1); await h.provider.release();
});
test('successful completion proves native idle before an immediate second tool round', async () => {
  const h = harness(); await h.provider.load(model, 'cpu');
  const first = h.provider.generate(input()); h.idle(); h.emit({ type: 'terminal', reason: 'complete', requestId: 'test_1', epoch: 1, sequence: 1 });
  assert.equal((await first).nativeQuiescent, true);
  const second = h.provider.generate(input(2)); h.idle(); h.emit({ type: 'terminal', reason: 'complete', requestId: 'test_2', epoch: 2, sequence: 1 });
  assert.equal((await second).nativeQuiescent, true); await h.provider.release();
});
test('initialization watchdog retains ownership until process restart when native loading stalls', async () => {
  const h = harness(); h.bridge.initialize = () => new Promise(() => {}); h.bridge.awaitNativeIdle = () => new Promise(() => {});
  const provider = new NativeLiteRtProvider(h.bridge, h.resources, 10, 100, 10);
  await assert.rejects(provider.load(model, 'cpu'), { code: 'CANCEL_TIMEOUT' });
  assert.equal(h.resources.isLeased(model.absolutePath), true); await assert.rejects(provider.release(), { code: 'SESSION_POISONED' });
});
