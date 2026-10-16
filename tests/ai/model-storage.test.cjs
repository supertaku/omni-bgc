const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const root = '/data/user/0/TEST/files/omni-ai-models';
const model = { id: 'TEST', sha256: 'a'.repeat(64), bytes: 6, url: 'https://huggingface.co/TEST/model/resolve/' + 'b'.repeat(40) + '/TEST.litertlm' };
function harness(response) {
  const files = new Map(); let networkCalls = 0, lastOptions, indexRow = null, failCommit = false;
  const db = { execAsync: async () => {}, closeAsync: async () => {}, async withExclusiveTransactionAsync(work) {
    const transaction = {}; await work(transaction); if (failCommit) throw Error('TEST durable commit failed'); indexRow = transaction.next;
  } };
  class File {
    constructor(uri) { this.uri = uri; }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.length ?? 0; }
    create() { files.set(this.uri, []); }
    delete() { files.delete(this.uri); }
    async move(target) { await new Promise(resolve => setTimeout(resolve, 0)); files.set(target.uri, files.get(this.uri)); files.delete(this.uri); }
    open(mode) {
      const uri = this.uri; let offset = 0;
      if (mode === 'truncate') files.set(uri, []);
      return { close() {}, readBytes(length) { const value = Uint8Array.from(files.get(uri).slice(offset, offset + length)); offset += value.length; return value; },
        writeBytes(value) { files.set(uri, [...(files.get(uri) ?? []), ...value]); } };
    }
  }
  class Directory { create() {} }
  const loaded = loadTs('apps/mobile/src/ai/modelStorage.ts', {
    'expo-file-system': { File, Directory, FileMode: { Append: 'append', ReadOnly: 'read', Truncate: 'truncate' }, Paths: { availableDiskSpace: 9999999999 } },
    'expo/fetch': { async fetch(url, options) { networkCalls++; lastOptions = options; return typeof response === 'function' ? response(url, options) : response; } },
    'expo-sqlite': { openDatabaseAsync: async name => { assert.equal(name, 'omni-ai-model-index.sqlite'); return db; } }, '../../modules/omni-local-ai': { nativeLocalAi: { privateModelsDirectory: async () => root, sha256File: async () => model.sha256 } },
    '../data/ownership': { OPEN_OPTIONS: {}, rows: async () => indexRow ? [indexRow] : [], run: async (transaction, sql, values) => { transaction.next = { version: 1, value: values[0] }; } }, './modelCatalog': { reviewedModel: id => { assert.equal(id === 'TEST' || id === 'gemma-4-e2b-it-litertlm-2026-08', true); return model; } },
    './coordinator': {}, './modelManager': {},
  }, { URL, Uint8Array });
  return { ...loaded, files, networkCalls: () => networkCalls, options: () => lastOptions, failCommit: value => { failCommit = value; } };
}
function result({ status = 200, url = model.url, headers = {}, chunks = [[1, 2, 3], [4, 5, 6]] } = {}) {
  let position = 0;
  return { status, url, headers: { get: name => headers[name] ?? null }, body: { cancel: async () => {}, getReader: () => ({
    async read() { return position < chunks.length ? { done: false, value: Uint8Array.from(chunks[position++]) } : { done: true }; }, async cancel() {}, releaseLock() {},
  }) } };
}
test('real adapter validates local user-selected import URIs', () => {
  const h = harness(); for (const uri of ['https://evil/model', 'file:///etc/../secret', 'file:///a/%2e%2e/secret', 'file:///a%00b', 'content://picker/a\\b', 'file://host/x']) assert.throws(() => h.validateModelImportUri(uri));
  h.validateModelImportUri('content://picker/document/TEST'); h.validateModelImportUri('file:///cache/TEST.litertlm');
});
test('real streaming adapter writes bounded chunks without arrayBuffer whole artifact', async () => {
  const h = harness(result({ headers: { 'content-length': '6' } })), storage = await h.createExpoModelStorage();
  const target = storage.partialPath(model), progress = [];
  await storage.download(model, target, value => progress.push(value));
  assert.deepEqual(h.files.get('file://' + target), [1, 2, 3, 4, 5, 6]); assert.deepEqual(progress, [3, 6]);
  assert.equal(await storage.hash(target), model.sha256);
});
test('real adapter resumes existing private partial only with exact Content-Range', async () => {
  const h = harness(result({ status: 206, headers: { 'content-range': 'bytes 3-5/6', 'content-length': '3' }, chunks: [[4, 5, 6]] }));
  const storage = await h.createExpoModelStorage(), target = storage.partialPath(model); h.files.set('file://' + target, [1, 2, 3]);
  await storage.download(model, target, () => {}); assert.equal(h.options().headers.Range, 'bytes=3-'); assert.equal(h.files.get('file://' + target).length, 6);
});
test('server ignoring Range safely restarts partial instead of duplicating weights', async () => {
  const h = harness(result()), storage = await h.createExpoModelStorage(), target = storage.partialPath(model); h.files.set('file://' + target, [1, 2, 3]);
  await storage.download(model, target, () => {}); assert.equal(h.files.get('file://' + target).length, 6);
});
test('invalid Range, unexpected final origin, overflow and truncated response are rejected', async () => {
  for (const response of [result({ status: 206, headers: { 'content-range': 'bytes 1-9/10' } }), result({ url: 'https://evil.example/file' }), result({ chunks: [[1,2,3,4,5,6,7]] }), result({ chunks: [[1]] })]) {
    const h = harness(response), storage = await h.createExpoModelStorage(); await assert.rejects(storage.download(model, storage.partialPath(model), () => {}));
  }
});
test('adapter rejects arbitrary remote URL before network and arbitrary filesystem path before hashing', async () => {
  const h = harness(result()), storage = await h.createExpoModelStorage();
  await assert.rejects(storage.download({ ...model, url: 'https://evil.example/model' }, storage.partialPath(model), () => {}));
  await assert.rejects(storage.hash('/etc/passwd')); assert.equal(h.networkCalls(), 0);
});
test('completed partial is locally verified by manager without network retry', async () => {
  const h = harness(result()), storage = await h.createExpoModelStorage(), target = storage.partialPath(model); h.files.set('file://' + target, [1,2,3,4,5,6]);
  await storage.download(model, target, () => {}); assert.equal(h.networkCalls(), 0);
});
test('local adapter import streams and rejects private self-import', async () => {
  const h = harness(), storage = await h.createExpoModelStorage(), target = storage.partialPath(model); h.files.set('content://picker/TEST', [1,2,3,4,5,6]);
  await storage.importFile('content://picker/TEST', target); assert.equal(h.files.get('file://' + target).length, 6); assert.equal(h.networkCalls(), 0);
  await assert.rejects(storage.importFile('file://' + target, target), /SOURCE_PRIVATE/);
});
test('aborted streaming transfer leaves partial for explicit resume', async () => {
  const controller = new AbortController(), h = harness(result()), storage = await h.createExpoModelStorage(), target = storage.partialPath(model);
  await assert.rejects(storage.download(model, target, () => controller.abort(), controller.signal), /CANCELLED/); assert.equal(h.files.get('file://' + target).length, 3);
});
test('SQLite adapter atomically persists pointers across storage instances and preserves old row on failed commit', async () => {
  const h = harness(), storage = await h.createExpoModelStorage();
  const artifact = { id: model.id, bytes: model.bytes, sha256: model.sha256, absolutePath: storage.finalPath(model), verified: true };
  const pointers = { active: null, previous: null, staged: artifact };
  await storage.writePointers(pointers); const restarted = await h.createExpoModelStorage();
  assert.equal((await restarted.readPointers()).staged.absolutePath, artifact.absolutePath);
  h.failCommit(true); await assert.rejects(storage.writePointers({ active: artifact, previous: null, staged: null }), /commit failed/);
  assert.equal((await restarted.readPointers()).active, null); assert.equal((await restarted.readPointers()).staged.id, model.id);
  await assert.rejects(storage.writePointers({ ...pointers, staged: { ...artifact, absolutePath: '/outside/file' } }), /PATH_INVALID/);
});
test('manual redirects validate every next origin before fetching and cap redirect loops', async () => {
  for (const location of ['https://evil.example/weights', 'http://huggingface.co/weights', 'https://user:password@huggingface.co/weights', 'https://huggingface.co:8443/weights']) {
    const h = harness(result({ status: 302, headers: { location } })), storage = await h.createExpoModelStorage();
    await assert.rejects(storage.download(model, storage.partialPath(model), () => {}), /ORIGIN_INVALID/); assert.equal(h.networkCalls(), 1); assert.equal(h.options().redirect, 'manual');
  }
  const loop = harness(result({ status: 302, headers: { location: '/loop' } })), storage = await loop.createExpoModelStorage();
  await assert.rejects(storage.download(model, storage.partialPath(model), () => {}), /REDIRECT_INVALID/); assert.equal(loop.networkCalls(), 5);
});
test('reviewed signed HF CDN redirect is followed manually without leaking unreviewed network requests', async () => {
  const signed = 'https://us.aws.cdn.hf.co/TEST/weights?signature=TEST_ONLY';
  const h = harness((url, options) => { assert.equal(options.redirect, 'manual'); return url === model.url ? result({ status: 302, headers: { location: signed } }) : result({ url: signed }); });
  const storage = await h.createExpoModelStorage(); await storage.download(model, storage.partialPath(model), () => {}); assert.equal(h.networkCalls(), 2);
});
test('finalization awaits Expo asynchronous move before caller can commit staged pointer', async () => {
  const h = harness(), storage = await h.createExpoModelStorage(), partial = storage.partialPath(model), target = storage.finalPath(model);
  h.files.set('file://' + partial, [1,2,3,4,5,6]);
  await storage.finalize(partial, target); assert.equal(await storage.size(target), 6); assert.equal(await storage.size(partial), null);
});
