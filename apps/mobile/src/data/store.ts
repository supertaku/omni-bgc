import { CURRENT_FACTS } from './queries';
import * as SQLite from 'expo-sqlite';
import { File } from 'expo-file-system';
import { Place, SavedState, TransitRoute } from '../contracts';
import { getActivePackPath } from '../updates';
import { LocalHealth, prepareLocalDatabase } from './localHealth';
import { OPEN_OPTIONS, rows, run, serialOwner } from './ownership';
import {
  EntranceLink,
  FactRow,
  lexicalQuery,
  parsePlaces,
  parseTransit,
  TransitLink,
  validateSaved,
} from './parser';

const own = serialOwner();
let local: SQLite.SQLiteDatabase | null = null;
let closing = false;
let poisoned = false;
let health: LocalHealth | null = null;
export function getLocalStoreHealth(): LocalHealth | null {
  return health;
}
async function ensure(): Promise<SQLite.SQLiteDatabase> {
  if (local) return local;
  const db = await SQLite.openDatabaseAsync('omni-local-state.sqlite', OPEN_OPTIONS);
  try {
    health = await prepareLocalDatabase(db);
    if (health.recoveredTables.length || health.restoredSettingsRow)
      console.warn(
        '[Omni-BGC storage] Missing local structures recovered; existing rows retained.',
        health,
      );
    local = db;
    return db;
  } catch (e) {
    if (await db.isInTransactionAsync()) await db.execAsync('ROLLBACK');
    await db.closeAsync();
    throw e;
  }
}
function work<T>(task: () => Promise<T>, needsLocal = true): Promise<T> {
  if (needsLocal && (closing || poisoned))
    return Promise.reject(new Error('Store is closing or cleanup failed'));
  return own(async () => {
    if (needsLocal) {
      if (poisoned) throw new Error('Store cleanup failed');
      await ensure();
    }
    return task();
  });
}
export function openStore(): Promise<void> {
  return work(async () => undefined);
}

async function content<T>(
  kind: 'places' | 'menus' | 'transit',
  task: (db: SQLite.SQLiteDatabase) => Promise<T>,
  empty: T,
): Promise<T> {
  const directory = await getActivePackPath(kind);
  if (!directory) return empty;
  const file = new File(directory, 'main.sqlite');
  const db = await SQLite.openDatabaseAsync(file.name, OPEN_OPTIONS, file.parentDirectory.uri);
  try {
    await db.execAsync('PRAGMA query_only=ON;PRAGMA foreign_keys=ON');
    return await task(db);
  } finally {
    await db.closeAsync();
  }
}
async function factRows(db: SQLite.SQLiteDatabase): Promise<FactRow[]> {
  const now = new Date().toISOString();
  return rows<FactRow>(db, CURRENT_FACTS, Array(9).fill(now));
}
async function allPlaces(): Promise<Place[]> {
  const base = await content(
    'places',
    async (db) => ({
      facts: await factRows(db),
      links: (await rows(db, "SELECT name FROM sqlite_master WHERE name='read_place_entrance'"))
        .length
        ? await rows<EntranceLink>(db, 'SELECT * FROM read_place_entrance')
        : [],
    }),
    { facts: [] as FactRow[], links: [] as EntranceLink[] },
  );
  const menu = await content('menus', factRows, [] as FactRow[]);
  return parsePlaces([...base.facts, ...menu], base.links);
}
export function loadPlaces(): Promise<Place[]> {
  return work(allPlaces, false);
}
export function searchPlaces(query: string, category?: string): Promise<Place[]> {
  const lexical = lexicalQuery(query);
  if (category !== undefined && (typeof category !== 'string' || category.length > 80))
    return Promise.reject(new Error('Invalid category'));
  return work(async () => {
    const places = await allPlaces();
    if (!lexical) return places.filter((p) => !category || p.category === category);
    const find = async (db: SQLite.SQLiteDatabase) =>
      rows<{ id: string }>(
        db,
        `SELECT DISTINCT CASE WHEN e.kind='place' THEN e.id WHEN e.kind='menu' THEN e.parent_id WHEN e.kind='menu_item' THEN parent.parent_id ELSE NULL END id FROM search_fts JOIN search_document d ON d.id=search_fts.rowid JOIN entity e ON e.id=d.entity_id LEFT JOIN entity parent ON parent.id=e.parent_id WHERE search_fts MATCH ?`,
        [lexical],
      );
    const ids = new Set(
      [...(await content('places', find, [])), ...(await content('menus', find, []))].map(
        (r) => r.id,
      ),
    );
    // FTS may contain expired alias/menu text. Final match must occur in current supported fields.
    const tokens =
      query
        .normalize('NFC')
        .match(/[\p{L}\p{N}]+/gu)
        ?.slice(0, 8)
        .map((t) => t.slice(0, 48).toLocaleLowerCase()) ?? [];
    return places.filter(
      (p) =>
        ids.has(p.id) &&
        (!category || p.category === category) &&
        tokens.every((t) =>
          [p.name, ...p.aliases, ...p.menus.map((m) => m.name)].some((s) =>
            s.normalize('NFC').toLocaleLowerCase().includes(t),
          ),
        ),
    );
  }, false);
}
export function loadTransit(): Promise<TransitRoute[]> {
  return work(async () => {
    return content(
      'transit',
      async (db) => {
        if (
          !(await rows(db, "SELECT name FROM sqlite_master WHERE name='read_transit_route'")).length
        )
          return [];
        const links = await rows<TransitLink>(
          db,
          'SELECT r.route_id,r.shape_fact_id,r.calendar_fact_id,s.sequence,s.stop_id,s.sequence_fact_id FROM read_transit_route r JOIN read_transit_stop s ON s.route_id=r.route_id ORDER BY r.route_id,s.sequence',
        );
        return parseTransit(await factRows(db), links);
      },
      [],
    );
  }, false);
}
export function loadSaved(): Promise<SavedState> {
  return work(async () => {
    const db = await ensure();
    const ids = await rows<{ place_id: string }>(
      db,
      'SELECT place_id FROM local_favorite ORDER BY place_id',
    );
    const stops = await rows<{ place_id: string; duration_minutes: number }>(
      db,
      'SELECT place_id,duration_minutes FROM local_itinerary ORDER BY sequence',
    );
    const settings = await rows<{ start_time: string | null }>(
      db,
      'SELECT start_time FROM local_settings WHERE singleton=1',
    );
    return validateSaved({
      placeIds: ids.map((r) => r.place_id),
      itinerary: stops.map((r) => ({ placeId: r.place_id, durationMinutes: r.duration_minutes })),
      startTime: settings[0]?.start_time ?? null,
    });
  });
}
export function saveSaved(state: SavedState): Promise<void> {
  const saved = validateSaved(state);
  return work(async () => {
    const db = await ensure();
    await db.execAsync('BEGIN IMMEDIATE');
    try {
      await run(db, 'DELETE FROM local_favorite');
      await run(db, 'DELETE FROM local_itinerary');
      for (const id of saved.placeIds) await run(db, 'INSERT INTO local_favorite VALUES(?)', [id]);
      for (let i = 0; i < saved.itinerary.length; i++)
        await run(db, 'INSERT INTO local_itinerary VALUES(?,?,?)', [
          i,
          saved.itinerary[i].placeId,
          saved.itinerary[i].durationMinutes,
        ]);
      await run(db, 'UPDATE local_settings SET start_time=? WHERE singleton=1', [saved.startTime]);
      await db.execAsync('COMMIT');
    } catch (e) {
      await db.execAsync('ROLLBACK');
      throw e;
    }
  });
}
export function clearLocalHistory(): Promise<void> {
  return work(async () => {
    await run(await ensure(), 'DELETE FROM local_recent_place');
  });
}
export function disposeStore(): Promise<void> {
  closing = true;
  return own(async () => {
    try {
      if (local) {
        await local.closeAsync();
        local = null;
      }
      health = null;
      poisoned = false;
    } catch (e) {
      poisoned = true;
      throw e;
    } finally {
      closing = false;
    }
  });
}
