import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { OPEN_OPTIONS, rows, run, serialOwner } from '../data/ownership';
import { canonical, InstalledPack, PACK_KINDS, PackKind, PackManifest, PackStatus, validateDependencies, validateManifest, validateVersionReuse } from './contracts';
import { downloadResumable } from './resumable-download';
import { validateOfflineStyle } from './style';
import { REVIEWED_MANIFEST_SHA256 } from './reviewed-catalog';

const own=serialOwner();
const root=()=>new Directory(Paths.document,'offline-packs');
let failure: Partial<Record<PackKind,string>>={};
type Pointer={kind:PackKind;active_slot:number;slot:number;manifest_json:string;manifest_sha256:string;directory:string};
async function withIndex<T>(work:(db:SQLite.SQLiteDatabase)=>Promise<T>):Promise<T> {
  const db=await SQLite.openDatabaseAsync('pack-index.sqlite',OPEN_OPTIONS);
  try { await db.execAsync('PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS pack_slot(kind TEXT NOT NULL,slot INTEGER NOT NULL CHECK(slot IN (0,1)),manifest_json TEXT NOT NULL,manifest_sha256 TEXT NOT NULL,directory TEXT NOT NULL,PRIMARY KEY(kind,slot)); CREATE TABLE IF NOT EXISTS pack_active(kind TEXT PRIMARY KEY,active_slot INTEGER NOT NULL CHECK(active_slot IN (0,1)));'); return await work(db); }
  finally { await db.closeAsync(); }
}
async function pointers(db:SQLite.SQLiteDatabase):Promise<Pointer[]> { return rows<Pointer>(db,'SELECT s.*,a.active_slot FROM pack_slot s JOIN pack_active a ON a.kind=s.kind ORDER BY s.kind,s.slot'); }
function installed(p:Pointer):InstalledPack { return {manifest:JSON.parse(p.manifest_json) as PackManifest,manifestSha256:p.manifest_sha256,directory:p.directory}; }
async function sha(bytes:Uint8Array<ArrayBuffer>):Promise<string> { return [...new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256,bytes))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
async function manifestHash(m:PackManifest):Promise<string> { return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,canonical(m)); }
async function verifyArtifact(pack:InstalledPack, now:string):Promise<void> {
  validateManifest(pack.manifest,now);
  const prefix=root().uri.replace(/\/+$/,'')+'/';
  if (!REVIEWED_MANIFEST_SHA256.includes(pack.manifestSha256) || await manifestHash(pack.manifest)!==pack.manifestSha256 || !pack.directory.startsWith(prefix) || !/^(?:[0-9a-f]{64}|pending-[0-9a-f-]{36})\/?$/.test(pack.directory.slice(prefix.length))) throw new Error('Pack is not in locally reviewed trust registry');
  for (const entry of pack.manifest.files) { const file=new File(pack.directory,entry.path); if (!file.exists || file.size!==entry.sizeBytes || await sha(await file.bytes())!==entry.sha256) throw new Error('Stored pack checksum/size failed'); }
  if (['places','menus','transit'].includes(pack.manifest.kind)) {
    const file=new File(pack.directory,'main.sqlite');
    const db=await SQLite.openDatabaseAsync(file.name,OPEN_OPTIONS,file.parentDirectory.uri);
    try {
      await db.execAsync('PRAGMA query_only=ON; PRAGMA foreign_keys=ON;');
      const versions=await rows<{version:number}>(db,'SELECT version FROM schema_migration ORDER BY version');
      if (versions.map(v=>v.version).join(',')!==(pack.manifest.schemaVersion===3?'1,3':'1') || (await rows<{integrity_check:string}>(db,'PRAGMA integrity_check'))[0]?.integrity_check!=='ok' || (await rows(db,'PRAGMA foreign_key_check')).length) throw new Error('Pack database integrity/schema failed');
      const snapshotRows=await rows<{id:string;raw_sha256:string;license:string;attribution:string}>(db,'SELECT id,raw_sha256,license,attribution FROM source_snapshot');
      if (snapshotRows.some(s=>!pack.manifest.snapshots.some(e=>e.id===s.id&&e.rawSha256===s.raw_sha256&&e.license===s.license&&e.attribution===s.attribution))) throw new Error('Database snapshot not bound to reviewed manifest');
    } finally { await db.closeAsync(); }
  }
  if (pack.manifest.kind==='stylepack') {
    const style=await new File(pack.directory,'style.json').json() as Record<string,unknown>;
    validateOfflineStyle(style,pack.manifest.files.map(f=>f.path));
  }
}
async function activeUnchecked(db:SQLite.SQLiteDatabase):Promise<InstalledPack[]> { return (await pointers(db)).filter(p=>p.slot===p.active_slot).map(installed); }
async function recover(db:SQLite.SQLiteDatabase,kind:PackKind,now:string):Promise<InstalledPack|null> {
  const choices=(await pointers(db)).filter(p=>p.kind===kind).sort((a,b)=>Number(b.slot===b.active_slot)-Number(a.slot===a.active_slot));
  for (const p of choices) { const pack=installed(p); try { await verifyArtifact(pack,now); const others=(await activeUnchecked(db)).filter(x=>x.manifest.kind!==kind); validateDependencies(pack.manifest,others,pack.manifestSha256); for(const dep of pack.manifest.dependencies){const required=others.find(x=>x.manifest.kind===dep.kind&&x.manifestSha256===dep.manifestSha256);if(!required)throw new Error('Dependency unavailable');await verifyArtifact(required,now);} if(p.slot!==p.active_slot)await run(db,'UPDATE pack_active SET active_slot=? WHERE kind=?',[p.slot,kind]); return pack; } catch(e) {failure[kind]=String(e);} }
  return null;
}
export async function getActivePackPath(kind:PackKind):Promise<string|null> {
  return (await getActivePack(kind))?.directory ?? null;
}
export async function getActivePack(kind:PackKind):Promise<InstalledPack|null>{
  return own(()=>withIndex(db=>recover(db,kind,new Date().toISOString())));
}
export async function getPackStatus():Promise<PackStatus[]> {
  return own(()=>withIndex(async db=>{const result:PackStatus[]=[]; for(const kind of PACK_KINDS){const pack=await recover(db,kind,new Date().toISOString());const all=(await pointers(db)).filter(p=>p.kind===kind);result.push({kind,state:pack?'ready':all.length?'failed':'empty',version:pack?.manifest.version,error:failure[kind],rollbackAvailable:all.length>1});}return result;}));
}
export async function installPack(manifest:PackManifest,options:{userInitiated:true;retries?:number;signal?:AbortSignal}):Promise<void> {
  return own(async()=>{
    if(options?.userInitiated!==true)throw new Error('Download requires explicit user initiation');
    const canceled=()=>{if(options.signal?.aborted)throw new Error('Download canceled');};canceled();
    const now=new Date().toISOString();validateManifest(manifest,now);
    const checksum=await manifestHash(manifest);
    if(!REVIEWED_MANIFEST_SHA256.includes(checksum))throw new Error('Manifest lacks local parent-reviewed approval');
    const retries=options.retries ?? 1;if(!Number.isInteger(retries)||retries<0||retries>2)throw new Error('Invalid retry limit');
    await withIndex(async db=>{
      validateVersionReuse(manifest,checksum,(await pointers(db)).map(installed));
      // Recover a sole valid prior slot before choosing the inactive destination.
      // Expired/corrupt records are excluded so a reviewed replacement can repair them.
      const active:InstalledPack[]=[];for(const kind of PACK_KINDS){const pack=await recover(db,kind,now);if(pack)active.push(pack);}validateDependencies(manifest,active,checksum);
      const total=manifest.files.reduce((n,f)=>n+f.sizeBytes,0);
      if(Paths.availableDiskSpace<total*2+16*1024*1024)throw new Error('Insufficient free storage for validation and rollback');
      root().create({intermediates:true,idempotent:true});
      const temp=new Directory(root(),`pending-${Crypto.randomUUID()}`);temp.create();
      let moved=false;
      try {
        for(const entry of manifest.files){const file=new File(temp,entry.path);file.parentDirectory.create({intermediates:true,idempotent:true});
          canceled();await downloadResumable(entry,file,{userInitiated:true,retries,signal:options.signal});
        }
        canceled();const candidate={manifest,manifestSha256:checksum,directory:temp.uri};await verifyArtifact(candidate,new Date().toISOString());canceled();
        // Immutable content-addressed directory; the active valid slot is never overwritten.
        const destination=new Directory(root(),checksum);if(destination.exists){await verifyArtifact({...candidate,directory:destination.uri},now);temp.delete();}else {await temp.move(destination);moved=true;}
        const directory=destination.uri;
        canceled();
        const previous=(await pointers(db)).find(p=>p.kind===manifest.kind&&p.slot===p.active_slot);const slot=previous?1-previous.active_slot:0;
        await db.execAsync('BEGIN IMMEDIATE');try {canceled();await run(db,'INSERT INTO pack_slot(kind,slot,manifest_json,manifest_sha256,directory) VALUES(?,?,?,?,?) ON CONFLICT(kind,slot) DO UPDATE SET manifest_json=excluded.manifest_json,manifest_sha256=excluded.manifest_sha256,directory=excluded.directory',[manifest.kind,slot,canonical(manifest),checksum,directory]);canceled();await run(db,'INSERT INTO pack_active VALUES(?,?) ON CONFLICT(kind) DO UPDATE SET active_slot=excluded.active_slot',[manifest.kind,slot]);canceled();validateManifest(manifest,new Date().toISOString());await db.execAsync('COMMIT');}catch(e){await db.execAsync('ROLLBACK');throw e;}
        delete failure[manifest.kind];
      }catch(e){failure[manifest.kind]=String(e);throw e;}finally{if(!moved&&temp.exists)temp.delete();}
    });
  });
}
export async function rollbackPack(kind:PackKind):Promise<void>{return own(()=>withIndex(async db=>{const all=(await pointers(db)).filter(p=>p.kind===kind);const previous=all.find(p=>p.slot!==p.active_slot);if(!previous)throw new Error('No rollback slot');const pack=installed(previous);await verifyArtifact(pack,new Date().toISOString());validateDependencies(pack.manifest,(await activeUnchecked(db)).filter(p=>p.manifest.kind!==kind),pack.manifestSha256);await run(db,'UPDATE pack_active SET active_slot=? WHERE kind=?',[previous.slot,kind]);}));}
