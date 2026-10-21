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
  const { GEMMA_4_E2B: model } = load('src/ai/modelCatalog.ts');
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
  console.log('PASS model artifact lifecycle survives native and transport failures');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
