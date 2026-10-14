const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'apps/mobile/node_modules/typescript'));
function load(file, mocks = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, require: name => mocks[name] ?? (name==='./queries'?load('apps/mobile/src/data/queries.ts'):{}), console, Date, Set, Promise, Map, Error };
  vm.runInNewContext(output, context); return context.exports;
}
const startup = load('apps/mobile/src/data/startup.ts');
const ownership = load('apps/mobile/src/data/ownership.ts');
const migrations = load('apps/mobile/src/data/migrations.ts');
const health = load('apps/mobile/src/data/localHealth.ts', { './ownership': ownership, './migrations': migrations });
const saved = { placeIds: ['00000000-0000-4000-8000-000000000001'], itinerary: [], startTime: '11:00' };
const deps = overrides => ({ openStore: async () => {}, loadPlaces: async () => [{ id: 'TEST' }], loadTransit: async () => [], loadSaved: async () => saved, refreshInstalledGraph: async () => {}, getPackStatus: async () => [], log: () => {}, ...overrides });

test('in-flight startup callers share one request per stage and retry explicitly', async () => {
  let calls = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const boot = startup.createStartupLoader(deps({ openStore: async () => { calls++; await gate; } }));
  const a = boot(), b = boot(); assert.equal(a, b); release();
  assert.equal((await a).saved, saved); assert.equal(calls, 1);
  await boot(); assert.equal(calls, 2);
});
test('graph/transit failures retain directory and original saved data with stage diagnostics', async () => {
  const result = await startup.createStartupLoader(deps({ refreshInstalledGraph: async () => { throw Error('graph failed'); }, loadTransit: async () => { throw Error('transit failed'); } }))();
  assert.equal(result.places.length, 1); assert.equal(result.saved, saved);
  assert.equal(result.stages.graph.state, 'failed'); assert.equal(result.stages.transit.state, 'failed');
  assert.equal(result.stages.store.state, 'ready'); assert.equal(result.errors.length, 2);
});
test('storage capability failure blocks only saved read; never fabricates writable empty saved state', async () => {
  let reads = 0;
  const result = await startup.createStartupLoader(deps({ openStore: async () => { throw new health.LocalStoreError('SQLITE_CAPABILITY_MISSING', 'RTree missing'); }, loadSaved: async () => { reads++; return saved; } }))();
  assert.equal(reads, 0); assert.equal(result.saved, null); assert.equal(result.places.length, 1);
  assert.equal(result.stages.saved.state, 'blocked'); assert.equal(result.errors[0].stage, 'store');
  assert.equal(result.errors[0].code, 'SQLITE_CAPABILITY_MISSING');
});
test('saved read and offline metadata failures stay independently visible even if logging throws', async () => {
  const result = await startup.createStartupLoader(deps({ loadSaved: async () => { throw Error('bad rows'); }, getPackStatus: async () => { throw Error('index unavailable'); }, log: () => { throw Error('logger offline'); } }))();
  assert.equal(result.saved, null); assert.equal(result.stages.saved.state, 'failed');
  assert.equal(result.stages.offlineMap.state, 'failed'); assert.equal(result.stages.places.state, 'ready');
});
test('a safely rejected walking pack is unavailable rather than reported ready', async () => {
  const graph = { installed: false, eligibleEdges: 0, reason: 'No reviewed walking pack is installed.' };
  const result = await startup.createStartupLoader(deps({ refreshInstalledGraph: async () => graph }))();
  assert.equal(result.graphStatus, graph); assert.equal(result.stages.graph.state, 'unavailable');
  assert.match(result.stages.graph.reason, /No reviewed/); assert.equal(result.errors.length, 0);
});
test('production content reads remain usable when saved SQLite cannot open', async () => {
  let opened = 0;
  const store = load('apps/mobile/src/data/store.ts', {
    'expo-sqlite': { openDatabaseAsync: async () => { opened++; throw Error('local unavailable'); } },
    './ownership': ownership, './localHealth': health,
    '../updates': { getActivePackPath: async () => null },
    './parser': { parsePlaces: () => [], lexicalQuery: () => null },
  });
  await assert.rejects(store.openStore()); assert.equal(opened, 1);
  assert.equal((await store.loadPlaces()).length, 0); assert.equal((await store.loadTransit()).length, 0);
  assert.equal(opened, 1);
});
test('failed saved connection cleanup does not poison unrelated content reads', async () => {
  const store = load('apps/mobile/src/data/store.ts', {
    'expo-sqlite': { openDatabaseAsync: async () => ({ closeAsync: async () => { throw Error('close failed'); } }) },
    './ownership': ownership, './localHealth': { prepareLocalDatabase: async () => ({ recoveredTables: [], restoredSettingsRow: false }) },
    '../updates': { getActivePackPath: async () => null }, './parser': { parsePlaces: () => [] },
  });
  await store.openStore(); await assert.rejects(store.disposeStore());
  await assert.rejects(store.loadSaved());
  assert.equal((await store.loadPlaces()).length, 0); assert.equal((await store.loadTransit()).length, 0);
});

// Real portable SQLite backs the unchanged production migrations/recovery logic.
// Python emits newline JSON; transactions stay on one connection until close.
const python = String.raw`
import json,sys,sqlite3
db=sqlite3.connect(sys.argv[1],isolation_level=None)
db.row_factory=sqlite3.Row
for line in sys.stdin:
 try:
  req=json.loads(line)
  if req['kind']=='reopen':
   db.close();db=sqlite3.connect(sys.argv[1],isolation_level=None);db.row_factory=sqlite3.Row;result=[]
  elif req['kind']=='script':
   statement=''
   for char in req['sql']:
    statement+=char
    if char==';' and sqlite3.complete_statement(statement):
     db.execute(statement);statement=''
   if statement.strip():db.execute(statement)
   result=[]
  else:result=[dict(row) for row in db.execute(req['sql'],req.get('params',[]))]
  print(json.dumps({'rows':result}),flush=True)
 except Exception as e:print(json.dumps({'error':str(e)}),flush=True)
db.close()
`;
async function withDatabase(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-startup-'));
  const child = spawn('python', ['-u', '-c', python, path.join(dir, 'state.sqlite')], { stdio: ['pipe', 'pipe', 'pipe'] });
  const waiting = [];
  createInterface({ input: child.stdout }).on('line', line => {
    const next = waiting.shift(), response = JSON.parse(line);
    response.error ? next.reject(Error(response.error)) : next.resolve(response.rows);
  });
  const send = (kind, sql, params) => new Promise((resolve, reject) => { waiting.push({ resolve, reject }); child.stdin.write(JSON.stringify({ kind, sql, params }) + '\n'); });
  const db = {
    execAsync: sql => send('script', sql),
    prepareAsync: async sql => ({ executeAsync: async (params = []) => ({ getAllAsync: () => send('query', sql, params) }), finalizeAsync: async () => {} }),
  };
  try { await fn(db, send); } finally {
    child.stdin.end(); await new Promise(resolve => child.on('close', resolve)); fs.rmSync(dir, { recursive: true, force: true });
  }
}
test('fresh local migrations are exact and persisted preferences survive reopen', async () => withDatabase(async (db, sql) => {
  const first = await health.prepareLocalDatabase(db); assert.equal(first.recoveredTables.length, 0);
  await sql('script', `INSERT INTO local_favorite VALUES('${saved.placeIds[0]}'); UPDATE local_settings SET start_time='11:00' WHERE singleton=1;`);
  await sql('reopen', '');
  await health.prepareLocalDatabase(db);
  assert.equal((await sql('query', 'SELECT place_id FROM local_favorite'))[0].place_id, saved.placeIds[0]);
  assert.equal((await sql('query', 'SELECT start_time FROM local_settings'))[0].start_time, '11:00');
}));
test('missing local table/settings row recover without clearing surviving favorites', async () => withDatabase(async (db, sql) => {
  await health.prepareLocalDatabase(db);
  await sql('script', `INSERT INTO local_favorite VALUES('${saved.placeIds[0]}'); DROP TABLE local_itinerary; DELETE FROM local_settings;`);
  const result = await health.prepareLocalDatabase(db);
  assert.equal(result.recoveredTables.join(','), 'local_itinerary'); assert.equal(result.restoredSettingsRow, true);
  assert.equal((await sql('query', 'SELECT place_id FROM local_favorite'))[0].place_id, saved.placeIds[0]);
  assert.equal((await sql('query', 'SELECT start_time FROM local_settings'))[0].start_time, null);
}));
test('unsupported version/malformed table preserve all existing saved rows', async () => withDatabase(async (db, sql) => {
  await health.prepareLocalDatabase(db);
  await sql('script', `INSERT INTO local_favorite VALUES('${saved.placeIds[0]}'); INSERT INTO schema_migration VALUES(99,'TEST');`);
  await assert.rejects(health.prepareLocalDatabase(db), e => e.code === 'LOCAL_SCHEMA_UNSUPPORTED');
  await sql('script', 'DELETE FROM schema_migration WHERE version=99; ALTER TABLE local_itinerary ADD COLUMN unexpected TEXT;');
  await assert.rejects(health.prepareLocalDatabase(db), e => e.code === 'LOCAL_SCHEMA_UNSUPPORTED');
  assert.equal((await sql('query', 'SELECT place_id FROM local_favorite'))[0].place_id, saved.placeIds[0]);
}));
test('missing native RTree capability fails before any migration/write', async () => {
  let writes = 0;
  const db = { execAsync: async sql => { if (sql !== 'PRAGMA foreign_keys=ON') writes++; }, prepareAsync: async () => ({ executeAsync: async () => ({ getAllAsync: async () => [{ rtree: 0, fts5: 1 }] }), finalizeAsync: async () => {} }) };
  await assert.rejects(health.prepareLocalDatabase(db), e => e.code === 'SQLITE_CAPABILITY_MISSING'); assert.equal(writes, 0);
});
test('Expo native plugin includes both accepted database compile capabilities', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'apps/mobile/app.json'), 'utf8'));
  const sqlite = config.expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-sqlite')[1];
  assert.equal(sqlite.enableFTS, true);
  assert.match(sqlite.customBuildFlags, /-DSQLITE_ENABLE_RTREE=1/);
});
test('integrity failure preserves file and skips migrations/repair', async () => {
  let writes = 0;
  const db = { execAsync: async sql => { if (sql !== 'PRAGMA foreign_keys=ON') writes++; }, prepareAsync: async sql => ({ executeAsync: async () => ({ getAllAsync: async () => sql.includes('compileoption') ? [{ rtree: 1, fts5: 1 }] : [{ integrity_check: 'corrupt' }] }), finalizeAsync: async () => {} }) };
  await assert.rejects(health.prepareLocalDatabase(db), e => e.code === 'LOCAL_INTEGRITY_FAILED'); assert.equal(writes, 0);
});
