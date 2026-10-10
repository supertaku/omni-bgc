import type { SQLiteDatabase } from 'expo-sqlite';
import { LOCAL_V2, MOBILE_V1 } from './migrations';
import { rows } from './ownership';

export class LocalStoreError extends Error {
  constructor(readonly code: 'SQLITE_CAPABILITY_MISSING' | 'LOCAL_SCHEMA_UNSUPPORTED' | 'LOCAL_INTEGRITY_FAILED', message: string) {
    super(message); this.name = 'LocalStoreError';
  }
}
const requiredColumns: Record<string, string[]> = {
  local_favorite: ['place_id'], local_itinerary: ['sequence', 'place_id', 'duration_minutes'],
  local_settings: ['singleton', 'start_time'], local_recent_place: ['place_id', 'viewed_at'],
};
export type LocalHealth = { integrity: 'ok'; compileOptions: { rtree: true; fts5: true }; recoveredTables: string[]; restoredSettingsRow: boolean };

export async function prepareLocalDatabase(db: SQLiteDatabase): Promise<LocalHealth> {
  await db.execAsync('PRAGMA foreign_keys=ON');
  const capabilities = await rows<{ rtree: number; fts5: number }>(db, "SELECT sqlite_compileoption_used('ENABLE_RTREE') rtree, sqlite_compileoption_used('ENABLE_FTS5') fts5");
  if (!capabilities[0]?.rtree || !capabilities[0]?.fts5) {
    throw new LocalStoreError('SQLITE_CAPABILITY_MISSING', 'This app build lacks SQLite RTree or FTS5 support required by its accepted schema. Install a compatible build; saved data has not been cleared.');
  }
  await checkIntegrity(db);
  const tables = await rows<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  if (!tables.some(table => table.name === 'schema_migration')) {
    if (tables.length) throw new LocalStoreError('LOCAL_SCHEMA_UNSUPPORTED', 'Unversioned existing local database retained for recovery.');
    await db.execAsync(MOBILE_V1);
  }
  const versions = (await rows<{ version: number }>(db, 'SELECT version FROM schema_migration ORDER BY version')).map(row => row.version).join(',');
  if (versions === '1') await db.execAsync(LOCAL_V2);
  else if (versions !== '1,2') throw new LocalStoreError('LOCAL_SCHEMA_UNSUPPORTED', 'Unsupported local state version. Existing data was retained.');

  // Repair only missing structures with the exact accepted migration definitions.
  // Existing rows/tables are never dropped, replaced or rewritten.
  const present = new Set((await rows<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type='table'")).map(row => row.name));
  const recoveredTables: string[] = [];
  for (const [table, columns] of Object.entries(requiredColumns)) {
    if (!present.has(table)) { recoveredTables.push(table); continue; }
    const actual = (await rows<{ name: string }>(db, `PRAGMA table_info(${table})`)).map(column => column.name);
    if (actual.join(',') !== columns.join(',')) throw new LocalStoreError('LOCAL_SCHEMA_UNSUPPORTED', `Local table ${table} has incompatible columns. Existing data was retained.`);
  }
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    for (const table of recoveredTables) {
      const definition = LOCAL_V2.split('\n').find(line => line.startsWith(`CREATE TABLE ${table}(`));
      if (!definition) throw new LocalStoreError('LOCAL_SCHEMA_UNSUPPORTED', `No accepted recovery definition for ${table}.`);
      await db.execAsync(definition);
    }
    const settings = await rows<{ singleton: number }>(db, 'SELECT singleton FROM local_settings WHERE singleton=1');
    const restoredSettingsRow = settings.length === 0;
    if (restoredSettingsRow) await db.execAsync('INSERT INTO local_settings(singleton,start_time) VALUES(1,NULL)');
    await checkIntegrity(db);
    await db.execAsync('COMMIT');
    return { integrity: 'ok', compileOptions: { rtree: true, fts5: true }, recoveredTables, restoredSettingsRow };
  } catch (cause) { await db.execAsync('ROLLBACK'); throw cause; }
}
async function checkIntegrity(db: SQLiteDatabase): Promise<void> {
  const results = await rows<{ integrity_check: string }>(db, 'PRAGMA integrity_check');
  if (results.length !== 1 || results[0].integrity_check !== 'ok' || (await rows(db, 'PRAGMA foreign_key_check')).length) {
    throw new LocalStoreError('LOCAL_INTEGRITY_FAILED', 'Local database integrity failed. Existing files were retained; automatic destructive recovery is disabled.');
  }
}
