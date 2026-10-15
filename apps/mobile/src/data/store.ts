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
  parseTransit,
  TransitLink,
  validateSaved,
} from './parser';
import { parseDirectoryEntities } from './directory-entities';
import { parseOfficeDetails } from './offices';
import { loadOfficeProjection } from './office-store';
import { replaceOfficeDirectory, currentOfficePlaces } from '../features/offices/service';
import { reviewedScope, pilotScope, coversCoordinate, type MapScope } from '../map/scope';

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
async function contentScope(db: SQLite.SQLiteDatabase): Promise<MapScope> {
  const metadata = await rows<{ key: string; value: string }>(
    db,
    "SELECT key,value FROM pack_metadata WHERE key IN ('service_area_id','service_area_sha256')",
  );
  if (!metadata.length) return pilotScope; // Existing approved v1 projection format.
  const id = metadata.find((m) => m.key === 'service_area_id')?.value;
  const hash = metadata.find((m) => m.key === 'service_area_sha256')?.value;
  if (!id || !hash) throw new Error('Content pack geographic binding incomplete');
  return reviewedScope(id, hash);
}
async function allPlaces(): Promise<Place[]> {
  const base = await content(
    'places',
    async (db) => ({
      facts: await factRows(db),
      scope: await contentScope(db),
      links: (await rows(db, "SELECT name FROM sqlite_master WHERE name='read_place_entrance'"))
        .length
        ? await rows<EntranceLink>(db, 'SELECT * FROM read_place_entrance')
        : [],
    }),
    { facts: [] as FactRow[], links: [] as EntranceLink[], scope: pilotScope },
  );
  const menu = await content(
    'menus',
    async (db) => ({ facts: await factRows(db), scope: await contentScope(db) }),
    { facts: [] as FactRow[], scope: base.scope },
  );
  const compatibleMenus =
    menu.scope.id === base.scope.id && menu.scope.manifestSha256 === base.scope.manifestSha256
      ? menu.facts
      : [];
  const parsed = parseDirectoryEntities([...base.facts, ...compatibleMenus], base.links);
  // Text-only offices use a separate approved projection; GEX filtering stays intact.
  const office = await loadOfficeProjection().catch(() => ({
    facts: [] as FactRow[],
    available: false,
    validUntil: null,
  }));
  const officeFacts = office.available ? office.facts : base.facts;
  const officePlaces = office.available ? parseDirectoryEntities(officeFacts) : parsed;
  replaceOfficeDirectory(
    office.validUntil ? parseOfficeDetails(officeFacts, officePlaces, office.validUntil) : [],
    office.available,
  );
  const current = currentOfficePlaces(parsed);
  // V2 destinations require explicit supported coordinates. Context never admits search.
  return base.scope.id === pilotScope.id
    ? current
    : current.filter((p) => p.coordinate && coversCoordinate(base.scope.geometry, p.coordinate));
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
    const tokens =
      query
        .normalize('NFC')
        .match(/[\p{L}\p{N}]+/gu)
        ?.slice(0, 8)
        .map((t) => t.slice(0, 48).toLocaleLowerCase()) ?? [];
    const find = async (db: SQLite.SQLiteDatabase, token: string) =>
      rows<{ id: string }>(
        db,
        `WITH matched AS (SELECT e.id,e.kind,e.parent_id,parent.parent_id grandparent_id FROM search_fts JOIN search_document d ON d.id=search_fts.rowid JOIN entity e ON e.id=d.entity_id LEFT JOIN entity parent ON parent.id=e.parent_id WHERE search_fts MATCH ?)
        SELECT DISTINCT CASE WHEN kind IN ('place','building','public_facility') THEN id WHEN kind='menu' THEN parent_id WHEN kind='menu_item' THEN grandparent_id ELSE NULL END id FROM matched
        UNION SELECT e.id FROM entity e JOIN matched b ON b.id=e.parent_id AND b.kind='building' WHERE e.kind='place'`,
        [lexicalQuery(token)!],
      );
    let ids = new Set(places.map((p) => p.id));
    for (const token of tokens) {
      const matches = new Set(
        [
          ...(await content('places', (db) => find(db, token), [])),
          ...(await content('menus', (db) => find(db, token), [])),
        ].map((r) => r.id),
      );
      // Legacy packs did not index floor/category; only currently supported fields add matches.
      for (const p of places)
        if (
          [p.floor ?? '', p.building ?? '', p.category].some((s) =>
            s.normalize('NFC').toLocaleLowerCase().includes(token),
          )
        )
          matches.add(p.id);
      ids = new Set([...ids].filter((id) => matches.has(id)));
    }
    // FTS may contain expired alias/menu text. Final match must occur in current supported fields.
    return places.filter(
      (p) =>
        ids.has(p.id) &&
        (!category || p.category === category) &&
        tokens.every((t) =>
          [
            p.name,
            ...p.aliases,
            p.building ?? '',
            p.floor ?? '',
            p.category,
            ...p.menus.map((m) => m.name),
          ].some((s) => s.normalize('NFC').toLocaleLowerCase().includes(t)),
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
  return work(async () => readSaved(await ensure()));
}
async function readSaved(db: SQLite.SQLiteDatabase): Promise<SavedState> {
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
}
/** Toggle one reviewed UUID without replacing concurrent itinerary/settings edits. */
export function toggleSavedPlace(id: string): Promise<SavedState> {
  validateSaved({ placeIds: [id], itinerary: [], startTime: null });
  return work(async () => {
    const db = await ensure();
    await db.execAsync('BEGIN IMMEDIATE');
    try {
      const found = await rows(db, 'SELECT place_id FROM local_favorite WHERE place_id=?', [id]);
      await run(
        db,
        found.length
          ? 'DELETE FROM local_favorite WHERE place_id=?'
          : 'INSERT INTO local_favorite VALUES(?)',
        [id],
      );
      const saved = await readSaved(db);
      await db.execAsync('COMMIT');
      return saved;
    } catch (cause) {
      await db.execAsync('ROLLBACK');
      throw cause;
    }
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
