const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const nativeEntry = require.resolve('../modules/omni-local-ai/index.ts');
require.cache[nativeEntry] = { id: nativeEntry, filename: nativeEntry, loaded: true, exports: { nativeLocalAi: null } };
const { NativeLiteRtProvider } = require('../src/ai/NativeLiteRtProvider.ts');
const { ModelResourceCoordinator } = require('../src/ai/coordinator.ts');

(async () => {
  const resources = new ModelResourceCoordinator();
  const model = { id: 'test-model', absolutePath: '/private/verified.litertlm', sha256: 'a'.repeat(64),
    bytes: 1024, verified: true, contextTokens: 2048 };
  let backends = ['cpu', 'gpu'], loaded, releases = 0, failGpu = true;
  const bridge = {
    getCapabilities: async () => ({ android: true, abi: ['arm64-v8a'], backends }),
    initialize: async input => {
      loaded = input.backend;
      if (input.backend === 'gpu' && failGpu) throw Object.assign(Error('GPU failed'), { code: 'RUNTIME_UNSUPPORTED' });
    },
    awaitNativeIdle: async () => ({ idle: true }),
    release: async () => { releases++; },
    addListener: () => ({ remove() {} }),
  };
  const provider = new NativeLiteRtProvider(bridge, resources);
  backends = ['cpu'];
  assert.equal(await provider.supportsBackend('gpu'), false, 'unsupported GPU rejected before release');
  backends = ['cpu', 'gpu'];
  await provider.load(model, 'cpu');
  assert.equal(loaded, 'cpu');
  await assert.rejects(provider.load(model, 'gpu'), e => e.code === 'SESSION_POISONED',
    'an active model cannot switch backend silently');
  await provider.release();
  await assert.rejects(provider.load(model, 'gpu'), e => e.code === 'RUNTIME_UNSUPPORTED');
  assert.equal(resources.isLeased(model.absolutePath), false, 'failed GPU startup releases only after native idle');
  await provider.release();
  failGpu = false;
  await provider.load(model, 'cpu');
  assert.equal(provider.state, 'READY', 'explicit CPU reload recovers after GPU initialization failure');
  assert.equal((await provider.getCapabilities()).backendRequested, 'cpu');
  await provider.release();
  assert(releases >= 3);
  console.log('M14 backend: explicit support check, active lease fence, failed GPU cleanup and CPU recovery passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
