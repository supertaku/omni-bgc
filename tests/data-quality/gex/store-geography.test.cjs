const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { loadTs } = require('../../helpers/load-ts.cjs');
const registry=JSON.parse(fs.readFileSync('apps/mobile/src/map/reviewed-scopes.json'));
const v2=registry.scopes[1],v1=registry.scopes[0];
const building='00000000-0000-4000-8000-000000000001',tenant='00000000-0000-4000-8000-000000000002',outside='00000000-0000-4000-8000-000000000003';
const fact=(id,kind,property,value,parent=null)=>({entity_id:id,kind,parent_id:parent,property,value_json:JSON.stringify(value),knowledge:'asserted',source_id:'TEST ONLY',license:'TEST ONLY',attribution:'TEST ONLY',observed_at:'2026-10-14T00:00:00Z',verified_at:'2026-10-14T00:00:00Z',locator:'TEST ONLY',fact_id:'TEST '+id+property,evidence_id:'TEST evidence '+property,snapshot_id:'TEST snapshot',raw_sha256:'a'.repeat(64),verification_method:'TEST ONLY',fact_valid_until:'2099-01-01T00:00:00Z',evidence_valid_until:'2099-01-01T00:00:00Z',snapshot_valid_until:'2099-01-01T00:00:00Z'});
const point={longitude:121.0497,latitude:14.5506,crs:'EPSG:4326'};
const facts=[fact(building,'building','name','TEST ONLY North Tower'),fact(building,'building','coordinate',point),fact(tenant,'place','name','TEST ONLY Example Company',building),fact(tenant,'place','coordinate',point,building),fact(tenant,'place','building',building,building),fact(tenant,'place','floor','9F',building),fact(tenant,'place','category','office',building),fact(outside,'place','name','TEST ONLY Exterior'),fact(outside,'place','coordinate',{...point,longitude:121.0523,latitude:14.5442})];
// Separate Offices composition requires complete reviewed company claims, not category alone.
const organization='00000000-0000-4000-8000-000000000004';
facts.push(fact(organization,'business','name','TEST ONLY Example Holdings'));
for(const [property,value] of Object.entries({office_organization:organization,office_district:'bgc-core',office_address:'TEST ONLY Address',office_presence:'operating',office_state:'operating',office_location_kind:'verified_site_point'}))facts.push(fact(tenant,'place',property,value,building));
const python=String.raw`
import json,sqlite3,sys
r=json.loads(sys.stdin.read());db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
db.executescript("CREATE TABLE entity(id TEXT,kind TEXT,parent_id TEXT); CREATE TABLE search_document(id INTEGER PRIMARY KEY,entity_id TEXT,name TEXT); CREATE VIRTUAL TABLE search_fts USING fts5(name);")
for row in r['entities']:db.execute('INSERT INTO entity VALUES(?,?,?)',row)
for i,row in enumerate(r['documents'],1):
 db.execute('INSERT INTO search_document VALUES(?,?,?)',(i,*row));db.execute('INSERT INTO search_fts(rowid,name) VALUES(?,?)',(i,row[1]))
print(json.dumps([dict(row) for row in db.execute(r['sql'],r['parameters'])]))
`;
function store({scope=v2,menuScope=scope}={}) {
  const metadata=s=>[{key:'service_area_id',value:s.id},{key:'service_area_sha256',value:s.manifestSha256}];
  const entities=[...new Map(facts.map(f=>[f.entity_id,[f.entity_id,f.kind,f.parent_id]])).values()];
  const documents=facts.filter(f=>['name','category','floor'].includes(f.property)).map(f=>[f.entity_id,JSON.parse(f.value_json)]);
  documents.push([tenant,'TEST ONLY expired ghost alias']);
  let closed=0;
  const read=async(db,sql,parameters)=>{
    if(sql.includes('FROM pack_metadata'))return metadata(db.kind==='menus'?menuScope:scope);
    if(sql.includes('FROM sqlite_master'))return [];
    if(sql.includes('FROM entity e JOIN fact f'))return db.kind==='menus'?[]:facts;
    if(sql.includes('WITH matched'))return JSON.parse(execFileSync('C:/Users/joshu/Documents/BGC/.venv/Scripts/python.exe',['-I','-B','-c',python],{input:JSON.stringify({sql,parameters,entities,documents}),encoding:'utf8'}));
    throw Error('Unexpected SQL '+sql);
  };
  class File {constructor(directory,name){this.name=name;this.parentDirectory={uri:directory};}}
  const api=loadTs('apps/mobile/src/data/store.ts',{
    'expo-file-system':{File},'expo-sqlite':{openDatabaseAsync:async(name,options,directory)=>({kind:directory.split('/').at(-1),execAsync:async()=>{},closeAsync:async()=>{closed++;}})},
    '../updates':{getActivePack:async()=>({manifest:{files:[],validUntil:'2099-01-01T00:00:00Z'}}),getActivePackPath:async kind=>'file:///'+kind},'./ownership':{serialOwner:()=>async work=>work(),rows:read,OPEN_OPTIONS:{}},
  });
  return {api,closed:()=>closed};
}
test('actual SQLite FTS joins office name and approved building name across tokens',async()=>{
  const {api,closed}=store();
  const result=await api.searchPlaces('Example Tower');assert.equal(result.length,1);assert.equal(result[0].id,tenant);
  assert.equal((await api.searchPlaces('Example 9F'))[0].id,tenant);
  assert.equal((await api.searchPlaces('Tower')).length,2);assert.ok(closed()>0);
});
test('v2 directory denies exterior points and stale FTS text, and does not clamp coordinates',async()=>{
  const {api}=store();const places=await api.loadPlaces();assert.equal(places.length,2);assert.ok(!places.some(p=>p.id===outside));
  assert.equal((await api.searchPlaces('Exterior')).length,0);assert.equal((await api.searchPlaces('ghost')).length,0);
  assert.equal(places.find(p=>p.id===tenant).coordinate[0],point.longitude);
});
test('content scope hash mismatch rejects projection without accepting a downloaded polygon',async()=>{
  const {api}=store({scope:{...v2,manifestSha256:'a'.repeat(64)}});await assert.rejects(api.loadPlaces(),/scope/);
});
test('a different menu scope does not prevent current base directory use',async()=>{
  const {api}=store({menuScope:v1});assert.equal((await api.loadPlaces()).length,2);
});
