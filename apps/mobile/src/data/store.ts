import * as SQLite from 'expo-sqlite';
import { File } from 'expo-file-system';
import { Place, SavedState, TransitRoute } from '../contracts';
import { getActivePackPath } from '../updates';
import { MOBILE_V1, LOCAL_V2 } from './migrations';
import { OPEN_OPTIONS, rows, run, serialOwner } from './ownership';
import { EntranceLink, FactRow, lexicalQuery, parsePlaces, parseTransit, TransitLink, validateSaved } from './parser';

const own=serialOwner();
let local:SQLite.SQLiteDatabase|null=null;
let closing=false;
let poisoned=false;
async function ensure():Promise<SQLite.SQLiteDatabase>{
  if(local)return local;
  const db=await SQLite.openDatabaseAsync('omni-local-state.sqlite',OPEN_OPTIONS);
  try {
    await db.execAsync('PRAGMA foreign_keys=ON');
    const tables=await rows<{name:string}>(db,"SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migration'");
    if(!tables.length)await db.execAsync(MOBILE_V1);
    const versions=(await rows<{version:number}>(db,'SELECT version FROM schema_migration ORDER BY version')).map(r=>r.version);
    if(versions.join(',')==='1')await db.execAsync(LOCAL_V2);else if(versions.join(',')!=='1,2')throw new Error('Unsupported local state version');
    if((await rows<{integrity_check:string}>(db,'PRAGMA integrity_check'))[0]?.integrity_check!=='ok'||(await rows(db,'PRAGMA foreign_key_check')).length)throw new Error('Local database integrity failed');
    local=db;return db;
  }catch(e){if(await db.isInTransactionAsync())await db.execAsync('ROLLBACK');await db.closeAsync();throw e;}
}
function work<T>(task:()=>Promise<T>):Promise<T>{if(closing||poisoned)return Promise.reject(new Error('Store is closing or cleanup failed'));return own(async()=>{if(poisoned)throw new Error('Store cleanup failed');await ensure();return task();});}
export function openStore():Promise<void>{return work(async()=>undefined);}

// Mobile projection has only exporter-approved facts. Recheck temporal lineage and conflicts
// on every read so an installed formerly-current pack cannot turn stale facts into current UI.
const CURRENT_FACTS=`SELECT f.id fact_id,e.id entity_id,e.kind,e.parent_id,f.property,f.value_json,f.knowledge,
 s.source_id,s.license,s.attribution,s.id snapshot_id,s.raw_sha256,l.evidence_id,l.observed_at,l.verified_at,l.locator,l.verification_method
 FROM entity e JOIN fact f ON f.subject_id=e.id JOIN fact_lineage l ON l.fact_id=f.id JOIN source_snapshot s ON s.id=l.snapshot_id
 WHERE julianday(f.valid_from)<=julianday(?) AND julianday(f.valid_until)>julianday(?)
 AND julianday(l.observed_at)<=julianday(?) AND julianday(l.verified_at)<=julianday(?) AND julianday(l.valid_until)>julianday(?)
 AND julianday(s.fetched_at_utc)<=julianday(?) AND julianday(s.valid_until)>julianday(?)
 AND lower(trim(l.reviewer)) NOT IN ('','unknown','unassigned')
 AND lower(trim(s.license)) NOT IN ('','unknown','unassigned')
 AND NOT EXISTS(SELECT 1 FROM fact other WHERE other.subject_id=f.subject_id AND other.property=f.property AND other.id!=f.id
 AND f.property!='alias' AND julianday(other.valid_from)<=julianday(?) AND julianday(other.valid_until)>julianday(?)
 AND (other.knowledge!=f.knowledge OR other.value_json IS NOT f.value_json)) ORDER BY e.id,f.property,l.evidence_id`;
async function content<T>(kind:'places'|'menus'|'transit',task:(db:SQLite.SQLiteDatabase)=>Promise<T>,empty:T):Promise<T>{
  const directory=await getActivePackPath(kind);if(!directory)return empty;
  const file=new File(directory,'main.sqlite');
  const db=await SQLite.openDatabaseAsync(file.name,OPEN_OPTIONS,file.parentDirectory.uri);
  try {await db.execAsync('PRAGMA query_only=ON;PRAGMA foreign_keys=ON');return await task(db);}finally{await db.closeAsync();}
}
async function factRows(db:SQLite.SQLiteDatabase):Promise<FactRow[]>{const now=new Date().toISOString();return rows<FactRow>(db,CURRENT_FACTS,Array(9).fill(now));}
async function allPlaces():Promise<Place[]>{
  const base=await content('places',factRows,[] as FactRow[]);
  const menu=await content('menus',factRows,[] as FactRow[]);
  const links=await content('places',async db=>(await rows(db,"SELECT name FROM sqlite_master WHERE name='read_place_entrance'")).length?rows<EntranceLink>(db,'SELECT * FROM read_place_entrance'):[],[]);
  return parsePlaces([...base,...menu],links);
}
export function loadPlaces():Promise<Place[]>{return work(allPlaces);}
export function searchPlaces(query:string,category?:string):Promise<Place[]>{
  const lexical=lexicalQuery(query);
  if(category!==undefined && (typeof category!=='string'||category.length>80))return Promise.reject(new Error('Invalid category'));
  return work(async()=>{
    const places=await allPlaces();
    if(!lexical)return places.filter(p=>!category||p.category===category);
    const find=async(db:SQLite.SQLiteDatabase)=>rows<{id:string}>(db,`SELECT DISTINCT CASE WHEN e.kind='place' THEN e.id WHEN e.kind='menu' THEN e.parent_id WHEN e.kind='menu_item' THEN parent.parent_id ELSE NULL END id FROM search_fts JOIN search_document d ON d.id=search_fts.rowid JOIN entity e ON e.id=d.entity_id LEFT JOIN entity parent ON parent.id=e.parent_id WHERE search_fts MATCH ?`,[lexical]);
    const ids=new Set([...(await content('places',find,[])),...(await content('menus',find,[]))].map(r=>r.id));
    // FTS may contain expired alias/menu text. Final match must occur in current supported fields.
    const tokens=query.normalize('NFC').match(/[\p{L}\p{N}]+/gu)?.slice(0,8).map(t=>t.slice(0,48).toLocaleLowerCase())??[];
    return places.filter(p=>ids.has(p.id)&&(!category||p.category===category)&&tokens.every(t=>[p.name,...p.aliases,...p.menus.map(m=>m.name)].some(s=>s.normalize('NFC').toLocaleLowerCase().includes(t))));
  });
}
export function loadTransit():Promise<TransitRoute[]>{return work(async()=>{
  return content('transit',async db=>{
    if(!(await rows(db,"SELECT name FROM sqlite_master WHERE name='read_transit_route'")).length)return [];
    const links=await rows<TransitLink>(db,'SELECT r.route_id,r.shape_fact_id,r.calendar_fact_id,s.sequence,s.stop_id,s.sequence_fact_id FROM read_transit_route r JOIN read_transit_stop s ON s.route_id=r.route_id ORDER BY r.route_id,s.sequence');
    return parseTransit(await factRows(db),links);
  },[]);
});}
export function loadSaved():Promise<SavedState>{return work(async()=>{
  const db=await ensure();const ids=await rows<{place_id:string}>(db,'SELECT place_id FROM local_favorite ORDER BY place_id');
  const stops=await rows<{place_id:string;duration_minutes:number}>(db,'SELECT place_id,duration_minutes FROM local_itinerary ORDER BY sequence');
  const settings=await rows<{start_time:string|null}>(db,'SELECT start_time FROM local_settings WHERE singleton=1');
  return validateSaved({placeIds:ids.map(r=>r.place_id),itinerary:stops.map(r=>({placeId:r.place_id,durationMinutes:r.duration_minutes})),startTime:settings[0]?.start_time??null});
});}
export function saveSaved(state:SavedState):Promise<void>{
  const saved=validateSaved(state);
  return work(async()=>{const db=await ensure();await db.execAsync('BEGIN IMMEDIATE');try{await run(db,'DELETE FROM local_favorite');await run(db,'DELETE FROM local_itinerary');for(const id of saved.placeIds)await run(db,'INSERT INTO local_favorite VALUES(?)',[id]);for(let i=0;i<saved.itinerary.length;i++)await run(db,'INSERT INTO local_itinerary VALUES(?,?,?)',[i,saved.itinerary[i].placeId,saved.itinerary[i].durationMinutes]);await run(db,'UPDATE local_settings SET start_time=? WHERE singleton=1',[saved.startTime]);await db.execAsync('COMMIT');}catch(e){await db.execAsync('ROLLBACK');throw e;}});
}
export function clearLocalHistory():Promise<void>{return work(async()=>{await run(await ensure(),'DELETE FROM local_recent_place');});}
export function disposeStore():Promise<void>{
  closing=true;
  return own(async()=>{try{if(local){await local.closeAsync();local=null;}poisoned=false;}catch(e){poisoned=true;throw e;}finally{closing=false;}});
}
