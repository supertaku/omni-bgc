const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { withSqlite } = require('./sqlite-helper.cjs');
const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const place = { id, name: 'TEST ONLY', category: 'test', coordinate: null, status: 'approved', aliases: [], entrances: [], menus: [], citations: [{ status:'approved',sourceId:'TEST',label:'TEST',license:'TEST',factId:'TEST',snapshotId:'TEST',evidenceId:'TEST',locator:'TEST',verificationMethod:'TEST',rawSha256:'a'.repeat(64),observedAt:'2026-01-01T00:00:00Z',verifiedAt:'2026-01-02T00:00:00Z' }] };
test('real SQLite saved CAS preserves preferences, detects concurrent edits/source revocation, rolls back failures', async () => withSqlite(async (db, sql) => {
  await db.execAsync('CREATE TABLE local_favorite(place_id TEXT PRIMARY KEY); CREATE TABLE local_itinerary(sequence INTEGER PRIMARY KEY,place_id TEXT,duration_minutes INTEGER CHECK(duration_minutes BETWEEN 0 AND 1440)); CREATE TABLE local_settings(singleton INTEGER PRIMARY KEY,start_time TEXT); INSERT INTO local_settings VALUES(1,\'09:30\')');
  let approved = true;
  const mocks = {
    'expo-sqlite': { openDatabaseAsync: async () => db },
    'expo-file-system': { File: class {} },
    '../updates': { getActivePackPath: async () => null },
    './localHealth': { prepareLocalDatabase: async () => ({ recoveredTables: [] }) },
    './office-store': { loadOfficeProjection: async () => ({ facts: [], available: false }) },
    './offices': { parseOfficeDetails: () => [] },
    './directory-entities': { parseDirectoryEntities: () => approved ? [place] : [] },
    '../features/offices/service': { replaceOfficeDirectory() {}, currentOfficePlaces: p => p },
  };
  const store = loadTs('apps/mobile/src/data/store.ts', mocks);
  const { savedFingerprint, approvedPlaceFingerprint } = loadTs('apps/mobile/src/data/savedPatch.ts');
  const source = [{ placeId: id, fingerprint: approvedPlaceFingerprint(place) }];
  await store.saveSaved({ placeIds: [other], itinerary: [{ placeId: other, durationMinutes: 25 }], startTime: '09:30' });
  const before = await store.loadSaved();
  const after = await store.applySavedPatch(savedFingerprint(before), { kind:'favorite', placeId:id, saved:true }, Date.now() + 60000, source);
  assert.equal(after.placeIds.length, 2); assert.equal(after.itinerary[0].placeId, other); assert.equal(after.startTime,'09:30');
  await assert.rejects(store.applySavedPatch(savedFingerprint(before), { kind:'favorite', placeId:id, saved:false }, Date.now()+60000,source));
  approved = false;
  await assert.rejects(store.applySavedPatch(savedFingerprint(after),{kind:'favorite',placeId:id,saved:false},Date.now()+60000,source));
  approved = true;
  await assert.rejects(store.applySavedPatch(savedFingerprint(after),{kind:'itinerary',stops:[{placeId:id,durationMinutes:1441}]},Date.now()+60000,source));
  await sql('reopen','');
  assert.equal(savedFingerprint(await store.loadSaved()),savedFingerprint(after));
  const visits = await store.applySavedPatch(savedFingerprint(after), {kind:'itinerary',stops:[{placeId:id,durationMinutes:60}]},Date.now()+60000,source);
  assert.equal(visits.itinerary[0].durationMinutes,60); assert.equal(visits.placeIds.length,2); assert.equal(visits.startTime,'09:30');
  // Local unknown visits may be retained/reordered/removed, but cannot be newly introduced.
  await store.saveSaved({...visits,itinerary:[{placeId:other,durationMinutes:25}]});
  const local=await store.loadSaved();
  await assert.rejects(store.applySavedPatch(savedFingerprint(local),{kind:'itinerary',operation:'append',stops:[...local.itinerary,{placeId:other,durationMinutes:40}]},Date.now()+60000,[]));
  const appended=await store.applySavedPatch(savedFingerprint(local),{kind:'itinerary',operation:'append',stops:[...local.itinerary,{placeId:id,durationMinutes:60}]},Date.now()+60000,source);
  assert.equal(appended.itinerary[0].placeId,other);
  const reordered=await store.applySavedPatch(savedFingerprint(appended),{kind:'itinerary',operation:'reorder',stops:[...appended.itinerary].reverse()},Date.now()+60000,[]);
  const removed=await store.applySavedPatch(savedFingerprint(reordered),{kind:'itinerary',operation:'remove',stops:[reordered.itinerary[0]]},Date.now()+60000,[]);
  assert.equal(removed.itinerary[0].placeId,id);assert.equal(removed.startTime,'09:30');assert.equal(removed.placeIds.length,2);
  await assert.rejects(store.applySavedPatch(savedFingerprint(removed),{kind:'itinerary',operation:'reorder',stops:[]},Date.now()+60000,[]));
  assert.equal(savedFingerprint(await store.loadSaved()),savedFingerprint(removed));
}));

test('separate real SQLite AI history finalization, duplicate stream IDs, bounded retention/restart/clear', async () => withSqlite(async (db, sql) => {
  const names=[];
  const { ConversationStore } = loadTs('apps/mobile/src/ai/conversationStore.ts', { 'expo-sqlite': { openDatabaseAsync: async name => { names.push(name); return db; } } });
  const history = new ConversationStore();
  await history.append([{id:'partial',payload:{kind:'text',text:'TEST unfinished',partial:true}}]);
  assert.equal((await history.load()).length,0);
  await history.append([{id:'historical-card',payload:{kind:'places',title:'TEST',placeIds:[id],total:1},canonicalPlaceIds:[id]}]);
  const historical=(await history.load())[0]; assert.equal(historical.payload.kind,'status');
  assert.match(historical.payload.text,/Historical response: 1 recorded place results/);
  assert.equal(historical.canonicalPlaceIds[0],id); await history.clear();
  const first={id:'one',payload:{kind:'user',text:'TEST greeting'}};
  await Promise.all([history.append([first]),history.append([first])]);
  assert.equal((await history.load()).length,1);
  await history.close(); await sql('reopen','');
  assert.equal((await history.load())[0].payload.text,'TEST greeting');
  await history.append(Array.from({length:220},(_,i)=>({id:`msg-${i}`,payload:{kind:'text',text:'x'.repeat(4000)}})));
  assert.ok((await history.load()).length<=200);
  const count=(await sql('query','SELECT sum(length(CAST(payload AS BLOB))) bytes FROM ai_message'))[0].bytes;
  assert.ok(count<=262144);
  await history.clear(); assert.equal((await history.load()).length,0);
  assert.deepEqual([...new Set(names)],['omni-ai-conversations.sqlite']);
}));

test('unsupported/corrupt AI history is preserved and cannot open user-state DB', async () => withSqlite(async (db,sql) => {
  await sql('script','PRAGMA user_version=99;CREATE TABLE preserve(value TEXT);INSERT INTO preserve VALUES(\'TEST original\')');
  const { ConversationStore }=loadTs('apps/mobile/src/ai/conversationStore.ts',{'expo-sqlite':{openDatabaseAsync:async name=>{assert.equal(name,'omni-ai-conversations.sqlite');return db;}}});
  await assert.rejects(new ConversationStore().load(),/Unsupported/);
  assert.equal((await sql('query','SELECT value FROM preserve'))[0].value,'TEST original');
}));
