const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
function compile(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.require = (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  };
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
  return mod.exports;
}
const catalog = compile('src/ai/modelCatalog.ts');
const root = '/private/omni-ai-models';
const files = new Map();
class File {
  constructor(uri) {
    this.uri = uri;
  }
  get exists() {
    return files.has(this.uri);
  }
  get size() {
    return files.get(this.uri)?.size ?? 0;
  }
  create() {
    files.set(this.uri, { size: 0 });
  }
  delete() {
    files.delete(this.uri);
  }
  async move(target) {
    files.set(target.uri, files.get(this.uri));
    this.delete();
  }
  open() {
    return {
      readBytes: (length) => ({ length }),
      writeBytes: (chunk) => {
        files.get(this.uri).size += chunk.length;
      },
      close() {},
    };
  }
}
let savedPointers;
const db = {
  execAsync: async () => {},
  closeAsync: async () => {},
  withExclusiveTransactionAsync: async (work) => work(db),
};
const { createExpoModelStorage } = compile('src/ai/modelStorage.ts', {
  'expo-file-system': {
    File,
    Directory: class {
      create() {}
    },
    FileMode: {},
    Paths: {},
  },
  'expo/fetch': {
    fetch: () => {
      throw new Error('Unexpected network');
    },
  },
  'expo-sqlite': { openDatabaseAsync: async () => db },
  '../../modules/omni-local-ai': {
    nativeLocalAi: {
      privateModelsDirectory: async () => root,
      sha256File: async (file) => files.get(`file://${file}`)?.sha256,
    },
  },
  '../data/ownership': {
    OPEN_OPTIONS: {},
    rows: async () => [{ version: 1, value: JSON.stringify(savedPointers) }],
    run: async (_db, _sql, args) => {
      savedPointers = JSON.parse(args[0]);
    },
  },
  './modelCatalog': catalog,
  './modelManager': {},
  './coordinator': {},
});
(async () => {
  const storage = await createExpoModelStorage();
  for (const model of catalog.MODEL_CATALOG) {
    const source = `file:///external/${model.id}.litertlm`;
    files.set(source, { size: model.bytes });
    const partial = storage.partialPath(model),
      final = storage.finalPath(model);
    await storage.importFile(source, partial);
    assert.equal(
      await storage.size(partial),
      model.bytes,
      'import uses the selected Qwen byte limit',
    );
    files.set(`file://${final}`, { size: model.bytes, sha256: model.sha256 });
    await storage.finalize(partial, final);
    assert.equal(
      await storage.size(partial),
      null,
      'matching existing Qwen final discards only its duplicate',
    );
    assert.equal(await storage.size(final), model.bytes);
    files.set(`file://${partial}`, { size: 8 });
    files.set(`file://${final}`, { size: model.bytes, sha256: 'bad' });
    await assert.rejects(storage.finalize(partial, final), /MODEL_EXISTING_ARTIFACT_CORRUPT/);
    assert.equal(await storage.size(partial), 8, 'failed final verification preserves partial');
    files.set(source, { size: model.bytes + 1 });
    await assert.rejects(storage.importFile(source, partial), /MODEL_IMPORT_SIZE_MISMATCH/);
    assert.equal(
      await storage.size(partial),
      8,
      'wrong-size import leaves saved partial untouched',
    );
  }
  await assert.rejects(
    storage.finalize(storage.partialPath(catalog.QWEN3_06B), storage.finalPath(catalog.QWEN3_17B)),
    /MODEL_PATH_INVALID/,
  );
  const legacy = {
    ...catalog.LEGACY_GEMMA_4_E2B,
    verified: true,
    absolutePath: `${root}/${catalog.LEGACY_GEMMA_4_E2B.sha256}.litertlm`,
  };
  savedPointers = { active: legacy, previous: null, staged: legacy };
  assert.deepEqual(
    await storage.readPointers(),
    savedPointers,
    'legacy metadata decodes for pointer retirement without catalog eligibility',
  );
  console.log(
    'PASS Qwen-specific import/finalize limits, duplicate verification, path ownership and legacy pointer decoding (host file/index fakes)',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
