const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { withSqlite } = require('./sqlite-helper.cjs');

test('foreign-key corruption disables history without deleting or repairing original rows', async () => withSqlite(async (db, sql) => {
  const { ConversationStore } = loadTs('apps/mobile/src/ai/conversationStore.ts', { 'expo-sqlite': { openDatabaseAsync: async () => db } });
  const first = new ConversationStore();
  await first.append([{ id: 'retained', payload: { kind: 'text', text: 'SYNTHETIC retained message' } }]);
  await first.close();
  await sql('script', "PRAGMA foreign_keys=OFF; INSERT INTO ai_message_reference VALUES('missing-parent',0,'00000000-0000-4000-8000-000000000001'); PRAGMA foreign_keys=ON");
  assert.equal((await sql('query', 'PRAGMA integrity_check'))[0].integrity_check, 'ok');
  assert.equal((await sql('query', 'PRAGMA foreign_key_check')).length, 1);
  const history = new ConversationStore();
  await assert.rejects(history.load(), /integrity/i);
  assert.equal((await sql('query', 'SELECT * FROM ai_message')).length, 1);
  assert.equal((await sql('query', 'SELECT * FROM ai_message_reference')).length, 1);
}));
