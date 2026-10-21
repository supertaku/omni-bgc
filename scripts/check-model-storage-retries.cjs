const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sha256 = 'a'.repeat(64);
const url = 'https://huggingface.co/example/model/resolve/revision/model.litertlm';
const model = { id: 'test-model', sha256, bytes: 5, url };
const files = new Map();
const fetchQueue = [];
const requests = [];

function filePath(uri) { return uri.replace(/^file:\/\//, ''); }
class FakeFile {
  constructor(uri) { this.path = filePath(uri); }
  get exists() { return files.has(this.path); }
  get size() { return files.get(this.path)?.length ?? 0; }
  create({ overwrite = false } = {}) {
    if (overwrite || !files.has(this.path)) files.set(this.path, new Uint8Array());
  }
  delete() { files.delete(this.path); }
  open(mode) {
    if (!this.exists) this.create();
    return {
      writeBytes: (chunk) => {
        const old = files.get(this.path);
        const combined = new Uint8Array(old.length + chunk.length);
        combined.set(old);
        combined.set(chunk, old.length);
        files.set(this.path, combined);
      },
      close() {},
    };
  }
  move(target) {
    files.set(target.path, files.get(this.path));
    files.delete(this.path);
  }
}
class FakeDirectory { constructor(uri) { this.path = filePath(uri); } create() {} }
function response(status, { chunks = [], headers = {}, bodyCancel } = {}) {
  let cursor = 0;
  const body = {
    getReader: () => ({
      read: async () => cursor < chunks.length
        ? { done: false, value: Uint8Array.from(chunks[cursor++]) }
        : { done: true, value: undefined },
      cancel: async () => {},
      releaseLock() {},
    }),
    cancel: async () => bodyCancel?.(),
  };
  return {
    status,
    url,
    body,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  };
}

const mocks = {
  'expo-file-system': {
    Directory: FakeDirectory,
    File: FakeFile,
    FileMode: { Append: 'append', ReadOnly: 'read', Truncate: 'truncate' },
    Paths: { availableDiskSpace: 100 },
  },
  'expo/fetch': {
    fetch: async (requestedUrl, options) => {
      requests.push({ url: requestedUrl, options });
      const next = fetchQueue.shift();
      if (!next) throw new Error('unexpected fetch');
      return typeof next === 'function' ? next(requestedUrl, options) : next;
    },
  },
  'expo-sqlite': {},
  '../../modules/omni-local-ai': {
    nativeLocalAi: { privateModelsDirectory: async () => '/private/omni-ai-models', sha256File: async () => sha256 },
  },
  '../data/ownership': { OPEN_OPTIONS: {}, rows: async () => [], run: async () => {} },
  './modelCatalog': { ReviewedModel: {}, reviewedModel: () => model },
  './modelManager': { ModelManager: class {} },
  './coordinator': { modelResourceCoordinator: {} },
};
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), name);
      if (fs.existsSync(`${target}.ts`)) return load(path.relative(root, `${target}.ts`));
    }
    return original(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}
function clearScenario() { files.clear(); fetchQueue.length = 0; requests.length = 0; }
async function makeStorage() { return load('src/ai/modelStorage.ts').createExpoModelStorage(); }

(async () => {
  const storage = await makeStorage();
  const partial = storage.partialPath(model);
  fetchQueue.push(
    response(200, { headers: { 'content-length': '5' }, chunks: [[1, 2]] }),
    (requestedUrl, options) => {
      assert.equal(options.headers.Range, 'bytes=2-', 'retry resumes from bytes already flushed');
      return response(206, {
        headers: { 'content-range': 'bytes 2-4/5', 'content-length': '3' },
        chunks: [[3, 4, 5]],
      });
    },
  );
  await storage.download(model, partial, () => {}, new AbortController().signal);
  assert.equal(requests.length, 2, 'truncated clean stream gets one retry');
  assert.equal(files.get(partial).length, 5, 'resumed stream completes the partial artifact');

  clearScenario();
  const aborter = new AbortController();
  fetchQueue.push(response(503, { bodyCancel: () => {} }));
  setTimeout(() => aborter.abort(), 25);
  await assert.rejects(storage.download(model, partial, () => {}, aborter.signal), /MODEL_SETUP_CANCELLED/);
  assert.equal(requests.length, 1, 'cancellation during backoff prevents another request');

  clearScenario();
  files.set(partial, Uint8Array.from([1, 2]));
  fetchQueue.push(response(206, {
    headers: { 'content-range': 'bytes 0-4/5', 'content-length': '5' },
    chunks: [[1, 2, 3, 4, 5]],
  }));
  await assert.rejects(storage.download(model, partial, () => {}, new AbortController().signal), /MODEL_DOWNLOAD_RANGE_INVALID/);
  assert.equal(requests.length, 1, 'invalid range fails without retrying');
  assert.deepEqual(Array.from(files.get(partial)), [1, 2], 'invalid range retains the saved partial file');
  console.log('PASS model storage retries truncated streams, resumes bytes, and fences cancellation/integrity failures');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
