// Synthetic topology-free test records are isolated here, never production-imported.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const ts=require(path.join(root,'apps/mobile/node_modules/typescript'));
const code=ts.transpileModule(fs.readFileSync(path.join(root,'apps/mobile/src/ui/itinerary.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const api={};vm.runInNewContext(code,{exports:api});
const point=[1,1],entry=key=>({id:'test-only-'+key,label:'Test-only entrance '+key,coordinate:point,eligible:true});
const place=key=>({id:key,name:'Test-only '+key,category:'test',coordinate:[9,9],aliases:[],entrances:[entry(key)],citations:[],status:'approved',menus:[]});
const saved={placeIds:[],itinerary:[{placeId:'A',durationMinutes:10},{placeId:'B',durationMinutes:20},{placeId:'C',durationMinutes:0}],startTime:null};
test('approved entrance origin, unavailable path and incomplete totals stay honest',async()=>{
 let calls=0;
 const legs=await api.calculateItineraryLegs(saved,[place('A'),place('B'),place('C')],async(origin,entrance)=>{calls++;assert.equal(origin.method,'landmark');assert.equal(origin.confirmed,true);assert.deepEqual(origin.coordinate,point);assert.equal(entrance.eligible,true);return{available:false,reason:'Test-only graph unavailable'};});
 assert.equal(calls,2);assert.equal(legs.length,2);assert.equal(api.itineraryTotals(saved,legs),null);
});
test('unapproved or entrance-less stops do not route from display centroid',async()=>{
 const p=place('A');p.entrances=[];const candidate=place('C');candidate.status='candidate';let calls=0;
 const legs=await api.calculateItineraryLegs(saved,[p,place('B'),candidate],async()=>{calls++;throw Error('must not call');});
 assert.equal(calls,0);assert.equal(legs.every(l=>!l.result.available),true);assert.equal(api.itineraryTotals(saved,legs),null);
});
test('all valid legs show only known metres and user visit minutes; edits invalidate totals',async()=>{
 const legs=await api.calculateItineraryLegs(saved,[place('A'),place('B'),place('C')],async()=>({available:true,coordinates:[[1,1],[1,2]],lengthM:25,instructions:[],graphVersion:'test-only-graph'}));
 const totals=api.itineraryTotals(saved,legs);assert.equal(totals.metres,50);assert.equal(totals.visitMinutes,30);assert.equal(totals.travelMinutes,undefined);
 const reordered={...saved,itinerary:[saved.itinerary[1],saved.itinerary[0],saved.itinerary[2]]};assert.equal(api.itineraryTotals(reordered,legs),null);
});
test('invalid route distance/geometry and thrown routing are unavailable',async()=>{
 for(const calculate of [async()=>({available:true,coordinates:[[1,1]],lengthM:NaN,instructions:[],graphVersion:'test'}),async()=>{throw Error('test graph error');}]){
  const legs=await api.calculateItineraryLegs(saved,[place('A'),place('B'),place('C')],calculate);assert.equal(legs.every(l=>!l.result.available),true);assert.equal(api.itineraryTotals(saved,legs),null);
 }
});
