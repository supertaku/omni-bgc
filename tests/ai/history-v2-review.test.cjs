const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { withSqlite } = require('./sqlite-helper.cjs');
const placeId = '00000000-0000-4000-8000-000000000001';

test('history v1 migrates non-destructively to v2 reference table; clear cascades stored canonical references', async () => withSqlite(async (db, sql) => {
  await db.execAsync('CREATE TABLE ai_message(sequence INTEGER PRIMARY KEY AUTOINCREMENT,message_id TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,created_at TEXT NOT NULL);PRAGMA user_version=1;');
  const statement = await db.prepareAsync('INSERT INTO ai_message(message_id,payload,created_at) VALUES(?,?,?)');
  try { await (await statement.executeAsync(['old-text', JSON.stringify({ kind: 'text', text: 'Historical synthetic response' }), '2026-10-01T00:00:00Z'])).getAllAsync(); }
  finally { await statement.finalizeAsync(); }
  const { ConversationStore } = loadTs('apps/mobile/src/ai/conversationStore.ts', { 'expo-sqlite': { openDatabaseAsync: async name => { assert.equal(name, 'omni-ai-conversations.sqlite'); return db; } } });
  const history = new ConversationStore();
  const old = await history.load(); assert.equal(old.length, 1); assert.equal(old[0].payload.text, 'Historical synthetic response');
  assert.equal((await sql('query', 'PRAGMA user_version'))[0].user_version, 2);
  await history.append([{ id: 'card', payload: { kind: 'places', title: 'TEST', placeIds: [placeId], total: 1 }, canonicalPlaceIds: [placeId], sourcePlaces: [{ name: 'SHOULD_NOT_PERSIST_RAW_PLACE_SNAPSHOT' }] }]);
  const records = await history.load(); assert.equal(records[1].payload.kind, 'status'); assert.match(records[1].payload.text, /Historical response/);
  assert.deepEqual(Array.from(records[1].canonicalPlaceIds), [placeId]); assert.ok(!JSON.stringify(records).includes('SHOULD_NOT_PERSIST'));
  assert.equal((await sql('query', 'SELECT COUNT(*) n FROM ai_message_reference'))[0].n, 1);
  await history.clear(); assert.equal((await sql('query', 'SELECT COUNT(*) n FROM ai_message_reference'))[0].n, 0);
}));

test('history summaries preserve bounded UUID references without executable previews or raw card evidence', () => {
  const { historyProjection } = loadTs('apps/mobile/src/ai/conversationStore.ts', { 'expo-sqlite': {} });
  const projected = historyProjection([
    { id: 'partial', payload: { kind: 'text', text: 'unfinished', partial: true }, canonicalPlaceIds: [placeId] },
    { id: 'evidence', payload: { kind: 'evidence', title: 'TEST', citations: [{ locator: 'DO_NOT_STORE_SOURCE_SECRET' }] }, canonicalPlaceIds: [placeId, placeId, '../invalid'] },
  ]);
  assert.equal(projected.length, 1); assert.equal(projected[0].payload.kind, 'status'); assert.match(projected[0].payload.text, /1 source citations/);
  assert.deepEqual(Array.from(projected[0].canonicalPlaceIds), [placeId]); assert.ok(!JSON.stringify(projected).includes('DO_NOT_STORE_SOURCE_SECRET'));
});
