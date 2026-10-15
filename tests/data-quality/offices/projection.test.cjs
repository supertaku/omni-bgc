const {test}=require('node:test');const assert=require('node:assert/strict');
const {loadTs}=require('../../helpers/load-ts.cjs');
const {validateOfficeProjection}=loadTs('apps/mobile/src/data/office-projection.ts');
const snapshot={id:'TEST ONLY',raw_sha256:'a'.repeat(64),license:'TEST ONLY',attribution:'TEST ONLY'};
const manifest={kind:'places',schemaVersion:3,files:[{path:'office-directory.sqlite'}],snapshots:[{id:snapshot.id,rawSha256:snapshot.raw_sha256,license:snapshot.license,attribution:snapshot.attribution}]};
function database(overrides={}){
 const events=[];
 const result={versions:[{version:1},{version:3}],integrity:[{integrity_check:'ok'}],foreign:[],metadata:[{key:'synthetic_test_only',value:'false'},{key:'build_contract',value:'m4-local-content-v1'}],sources:[snapshot],...overrides};
 const db={events,execAsync:async sql=>events.push(sql),closeAsync:async()=>events.push('close'),prepareAsync:async sql=>({executeAsync:async params=>({getAllAsync:async()=>{
  events.push({sql,params});
  if(sql.includes('schema_migration'))return result.versions;if(sql.includes('integrity_check'))return result.integrity;if(sql.includes('foreign_key_check'))return result.foreign;if(sql.includes('pack_metadata'))return result.metadata;if(sql.includes('SELECT id,raw_sha256'))return result.sources;
  assert.equal(params.length,9);return [];
 }}),finalizeAsync:async()=>events.push('finalized')})};return db;
}
test('office companion rejects malformed schema, corruption, synthetic bytes and unbound snapshots',async()=>{
 await validateOfficeProjection(database(),manifest);
 for(const change of [{versions:[{version:1}]},{integrity:[{integrity_check:'corrupt'}]},{foreign:[{table:'broken'}]},{metadata:[]},{sources:[]},{sources:[{...snapshot,raw_sha256:'b'.repeat(64)}]}]) await assert.rejects(validateOfficeProjection(database(change),manifest));
 await assert.rejects(validateOfficeProjection(database(),{...manifest,kind:'menus'}));
});
test('optional companion closes on rejected snapshot and never queries stale content',async()=>{
 for(const failed of [false,true]){
  const db=database(failed?{sources:[{...snapshot,id:'UNBOUND'}]}:{});
  const store=loadTs('apps/mobile/src/data/office-store.ts',{'expo-sqlite':{openDatabaseAsync:async()=>db},'expo-file-system':{File:class {name='office-directory.sqlite';parentDirectory={uri:'TEST ONLY'};}},'../updates':{getActivePack:async()=>({manifest,directory:'TEST ONLY'})}});
  if(failed)await assert.rejects(store.loadOfficeProjection());else assert.equal((await store.loadOfficeProjection()).available,true);
  assert.equal(db.events.at(-1),'close');assert.equal(db.events.some(event=>event.sql?.includes('SELECT f.id')), !failed);
 }
});
test('missing office companion remains explicitly unavailable without opening a database',async()=>{
 const store=loadTs('apps/mobile/src/data/office-store.ts',{'expo-sqlite':{openDatabaseAsync:async()=>{throw Error('Should not open');}},'expo-file-system':{},'../updates':{getActivePack:async()=>null}});
 const result=await store.loadOfficeProjection();assert.equal(result.available,false);assert.equal(result.facts.length,0);
});
