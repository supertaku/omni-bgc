const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');

const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (name) => {
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), name);
      if (fs.existsSync(target + '.ts')) return load(path.relative(path.resolve(__dirname, '..'), target + '.ts'));
    }
    return original(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}

(async () => {
  const { ModelManager } = load('src/ai/modelManager.ts');
  const { QWEN3_17B: model, QWEN3_06B, MODEL_CATALOG, LEGACY_GEMMA_4_E2B, reviewedModel } = load('src/ai/modelCatalog.ts');
  assert.equal(MODEL_CATALOG.length, 2);
  assert.equal(QWEN3_06B.bytes, 344671744);
  assert.throws(() => reviewedModel(LEGACY_GEMMA_4_E2B.id), /MODEL_NOT_REVIEWED/);
  assert.equal(QWEN3_06B.maxContextTokens, 4096);
  assert.equal(QWEN3_06B.testedDeviceProfile, null);
  const candidate = {
    id: model.id, sha256: model.sha256, bytes: model.bytes,
    absolutePath: '/private/model.litertlm', verified: true,
  };
  let pointers = { active: null, previous: null, staged: candidate };
  let partialBytes = 0;
  let finalBytes = model.bytes;
  const storage = {
    finalPath: () => candidate.absolutePath,
    partialPath: () => '/private/model.partial',
    size: async (file) => file.endsWith('.partial') ? partialBytes : finalBytes,
    hash: async () => model.sha256,
    readPointers: async () => pointers,
    writePointers: async (value) => { pointers = value; },
    remove: async (file) => { if (file.endsWith('.partial')) partialBytes = 0; else finalBytes = null; },
    freeBytes: async () => model.bytes * 2,
    download: async () => { throw new Error('MODEL_DOWNLOAD_DNS_FAILED'); },
    importFile: async () => {},
    finalize: async () => {},
  };
  const manager = new ModelManager(storage, { withModelMutation: (work) => work() });

  await manager.recover();
  assert.equal(manager.getStatus().artifactState, 'VERIFIED', 'verified staged artifact survives recovery');
  await assert.rejects(manager.activate({
    kind: 'native', load: async () => { throw new Error('OOM'); },
    generateText: async () => '', release: async () => {},
  }), /OOM/);
  assert.equal(manager.getStatus().artifactState, 'VERIFIED', 'native startup failure retains verified artifact');
  assert.equal(manager.getStatus().state, 'PENDING_NATIVE_SMOKE_TEST', 'runtime failure does not replace install state');
  assert.equal(manager.getStatus().runtimeError, 'OOM', 'native startup failure remains separately visible');
  assert.equal(pointers.staged.id, model.id, 'native startup failure retains staged pointer');

  pointers = { active: null, previous: null, staged: null };
  finalBytes = null;
  partialBytes = 8;
  await manager.recover();
  assert.equal(manager.getStatus().artifactState, 'PARTIAL', 'recovery detects retained partial bytes');
  await assert.rejects(manager.install(model.id, {
    kind: 'download', userInitiated: true, licenseAcknowledged: true,
  }), /MODEL_DOWNLOAD_DNS_FAILED/);
  assert.equal(manager.getStatus().artifactState, 'PARTIAL', 'transport failure retains resumable artifact');
  assert.equal(partialBytes, 8, 'transport failure does not delete partial bytes');

  await assert.rejects(manager.install(model.id, { kind: 'existing', userInitiated: true, licenseAcknowledged: true }), /MODEL_STAGED_MISSING/);
  await manager.inspect(model.id);
  assert.equal(manager.getStatus().modelId, model.id);
  assert.equal(manager.getStatus().artifactState, 'PARTIAL');

  const files = new Map([[model.id, model], [QWEN3_06B.id, QWEN3_06B]]);
  const previous = { ...candidate, absolutePath: model.id };
  let multiPointers = { active: previous, previous: null, staged: null };
  const multiStorage = {
    ...storage,
    finalPath: (entry) => entry.id,
    partialPath: (entry) => entry.id + '.partial',
    size: async (file) => files.get(file)?.bytes ?? null,
    hash: async (file) => files.get(file)?.sha256,
    readPointers: async () => multiPointers,
    writePointers: async (value) => { multiPointers = value; },
  };
  const multi = new ModelManager(multiStorage, { withModelMutation: (work) => work() });
  await multi.recover();
  await multi.inspect(QWEN3_06B.id);
  assert.equal(multi.getStatus().modelId, QWEN3_06B.id);
  assert.equal(multiPointers.active.id, model.id, 'selecting candidate preserves existing active pointer');
  await multi.install(QWEN3_06B.id, { kind: 'existing', userInitiated: true, licenseAcknowledged: true });
  await assert.rejects(multi.activate({kind:'native',load:async()=>{throw new Error('OOM');},generateText:async()=>'',release:async()=>{}}), /OOM/);
  assert.equal(multiPointers.active.id, model.id, 'candidate startup failure preserves previous Qwen active pointer');
  assert.equal(multiPointers.staged.id, QWEN3_06B.id, 'candidate remains staged after native failure');
  assert.equal(files.size, 2, 'both immutable downloads survive');

  const legacy = { ...LEGACY_GEMMA_4_E2B, absolutePath: '/private/legacy.litertlm', verified: true };
  let migrationPointers = { active: legacy, previous: legacy, staged: legacy };
  let removed = 0;
  const migration = new ModelManager({ ...storage,
    size: async () => null,
    readPointers: async () => migrationPointers,
    writePointers: async (value) => { migrationPointers = value; },
    remove: async () => { removed++; },
  }, { withModelMutation: (work) => work() });
  await migration.recover();
  assert.deepEqual(migrationPointers, { active:null, previous:null, staged:null }, 'withdrawn Gemma pointers retire safely');
  assert.equal(removed, 0, 'migration never deletes downloaded model files');
  await assert.rejects(migration.install(legacy.id, {kind:'download',userInitiated:true,licenseAcknowledged:true}), /MODEL_NOT_REVIEWED/);
  migrationPointers.staged = legacy;
  let legacyLoads = 0;
  await assert.rejects(migration.activate({kind:'native',load:async()=>legacyLoads++,generateText:async()=>'READY',release:async()=>{}}), /MODEL_NOT_REVIEWED/);
  assert.equal(legacyLoads, 0, 'withdrawn saved candidates never reach native initialization');
  multiPointers = {active:legacy,previous:null,staged:legacy};
  await multi.recover();
  assert.equal(multiPointers.active, null, 'withdrawn active model never becomes inference-ready');
  assert.equal(multiPointers.staged.id, QWEN3_06B.id, 'existing verified Qwen0.6 file recovers as staged after Gemma retirement');
  assert.equal(files.size, 2, 'supported files remain untouched during retirement');
  const { createProviderSmokeRunner } = load('src/ai/modelManager.ts');
  let generated = 0;
  const provider = {
    load: async () => {}, release: async () => {},
    generate: async (request) => {
      generated++;
      const base = { requestId: request.requestId, epoch: request.epoch, finishReason: 'complete', nativeQuiescent: true, toolProposals: [] };
      if (generated === 1) return { ...base, text: 'READY' };
      if (generated === 2) return { ...base, text: '', toolProposals: [{ version: 1, name: 'omni_model_smoke', arguments: {} }] };
      assert.equal(request.messages[2].role, 'tool');
      assert.deepEqual(Object.keys(JSON.parse(request.messages[2].text)), ['token'], 'startup tool result carries data, not completion instructions');
      assert.match(request.messages[0].text, /Then reply.*token/, 'the user message requests completion after the one tool call');
      return { ...base, text: JSON.parse(request.messages[2].text).token };
    },
  };
  assert.equal(await createProviderSmokeRunner(provider).generateText(), 'READY');
  assert.equal(generated, 3, 'activation checks text, parsed tool call and structured tool response');
  generated = 1;
  provider.generate = async () => ({ text: 'fake call', finishReason: 'complete', nativeQuiescent: true, toolProposals: [] });
  await assert.rejects(createProviderSmokeRunner(provider).generateText(), /MODEL_SMOKE_TOOL_INVALID/);
  console.log('PASS model selection, retained artifacts, existing-only staging and bounded native smoke protocol (mock provider)');

// Execute the real initialization callback with normal/staged/severe-report device states.
const runtimeFile = path.resolve(__dirname, '../src/ai/assistantRuntime.ts');
const runtimeTree = ts.createSourceFile(runtimeFile, fs.readFileSync(runtimeFile, 'utf8'), ts.ScriptTarget.Latest, true);
let initializationCallback;
function findInitialization(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(runtimeTree) === 'initialize') {
    function findOwner(child) {
      if (ts.isCallExpression(child) && child.expression.getText(runtimeTree) === 'own') initializationCallback = child.arguments[0].getText(runtimeTree);
      ts.forEachChild(child, findOwner);
    }
    findOwner(node);
  }
  ts.forEachChild(node, findInitialization);
}
findInitialization(runtimeTree);
assert.ok(initializationCallback);
for (const [blocked, active] of [[true, null], [true, {id: 'active'}], [false, null], [false, {id: 'active'}]]) {
  let loads = 0, runtimeError;
  const manager = { recover: async () => ({active, staged: {id: 'staged'}}), setRuntimeError: error => runtimeError = error };
  const bindings = {provider: {getCapabilities: async () => ({nativeModulePresent:true}), thermalBlocked: async () => blocked}, manager,
    createExpoModelManager: async () => manager, selectedModelId: 'initial', loadModel: async () => loads++};
  const source = ts.transpileModule('return (' + initializationCallback + ')();', {compilerOptions: {target:ts.ScriptTarget.ES2022}}).outputText;
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const ready = await new AsyncFunction(...Object.keys(bindings), source)(...Object.values(bindings));
  assert.equal(loads, !active ? 0 : 1);
  assert.equal(ready, !!active);
  assert.equal(runtimeError, undefined, 'a severe thermal report alone must not veto readiness');
}
const kotlinModule = fs.readFileSync(path.resolve(__dirname, '../modules/omni-local-ai/android/src/main/java/expo/modules/omnilocalai/OmniLocalAiModule.kt'), 'utf8');
assert.match(kotlinModule, /"thermalBlocked" to false/);
assert.match(kotlinModule, /"blocked" to false/);
assert.doesNotMatch(kotlinModule, /THERMAL_BLOCK|thermalCancellation|scheduleAtFixedRate/);
assert.match(kotlinModule, /ownership\.begin\(id, epoch\)/);
assert.match(kotlinModule, /synchronized\(conversationLock\)/);
console.log('PASS severe thermal telemetry has no native/JS veto; ownership/cancel-close fences retained');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
