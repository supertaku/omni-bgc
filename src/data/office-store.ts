import * as SQLite from 'expo-sqlite';
import { File } from 'expo-file-system';
import { getActivePack } from '../updates';
import { OPEN_OPTIONS, rows } from './ownership';
import { CURRENT_FACTS } from './queries';
import type { FactRow } from './parser';
import { validateOfficeProjection } from './office-projection';

/** Optional approved text projection inside the places pack; never a map-pack scope exception. */
export async function loadOfficeProjection(): Promise<{
  facts: FactRow[];
  available: boolean;
  validUntil: string | null;
}> {
  const pack = await getActivePack('places');
  if (!pack?.manifest.files.some((file) => file.path === 'office-directory.sqlite'))
    return { facts: [], available: false, validUntil: pack?.manifest.validUntil ?? null };
  const file = new File(pack.directory, 'office-directory.sqlite');
  const db = await SQLite.openDatabaseAsync(file.name, OPEN_OPTIONS, file.parentDirectory.uri);
  try {
    await db.execAsync('PRAGMA query_only=ON;PRAGMA foreign_keys=ON');
    await validateOfficeProjection(db, pack.manifest);
    const now = new Date().toISOString();
    return {
      facts: await rows<FactRow>(db, CURRENT_FACTS, Array(9).fill(now)),
      available: true,
      validUntil: pack.manifest.validUntil,
    };
  } finally {
    await db.closeAsync();
  }
}
