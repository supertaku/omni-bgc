// Synthetic contract inputs for deterministic tests; never imported by the app.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const ts=require(path.resolve(__dirname,'../../../node_modules/typescript'));
const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'directory.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},Set,BigInt,require:()=>({isDemoPlace:place=>String(typeof place==='string'?place:place.id).startsWith('sample-')})};vm.runInNewContext(source,context);
const {answerDirectoryQuery}=context.exports;
const citation={sourceId:'TEST ONLY',label:'Synthetic test evidence',license:'TEST ONLY',observedAt:'2026-10-10',verifiedAt:null,status:'approved'};
const place=(id,name,category,overrides={})=>({id,name,category,coordinate:null,building:'Test Building',aliases:[],entrances:[],citations:[citation],status:'candidate',menus:[],...overrides});
const item=(id,amount,overrides={})=>({id,name:'Test pasta',priceValue:{currency:'PHP',amount},citation,priceCitation:citation,...overrides});
const saved={placeIds:['coffee','removed'],itinerary:[],startTime:null};
const places=[place('coffee','Test Café','cafe'),place('food','Test Kitchen','restaurant',{menus:[item('cheap','0.30'),item('expensive','0.31'),item('unknown','0.10',{priceCitation:undefined}),item('foreign','0.01',{priceValue:{currency:'USD',amount:'0.01'}}),item('candidate','0.01',{citation:{...citation,status:'candidate'}})]})];
const payload=(query,kind)=>answerDirectoryQuery(query,places,saved).find(result=>result.kind===kind);

test('cuisine queries match only literal source tags or names, without guessing',()=>{
  const records=[place('tagged','Test Kitchen','Food',{cuisines:['italian']}),place('unknown','Test Bistro','Food')];
  const result=answerDirectoryQuery('Find Italian restaurants',records,saved).find(p=>p.kind==='places');
  assert.deepEqual(Array.from(result.placeIds),['tagged']);
});

test('category and alias search preserve canonical IDs and record classification',()=>{
  assert.equal(payload('Find coffee','places').placeIds[0],'coffee');
  assert.equal(payload('Find restaurants','places').placeIds[0],'food');
  assert.equal(answerDirectoryQuery('TEST CAFE',[place('alias','Other Name','office',{aliases:['Test Cafe']})],saved).find(p=>p.kind==='places').placeIds[0],'alias');
  assert.equal(places[0].status,'candidate');
});
test('budget includes only supported same-currency prices and exact decimal boundary',()=>{
  const result=payload('Menu under ₱0.30','menus');assert.equal(result.total,1);assert.equal(result.items[0].item.id,'cheap');
  assert.equal(payload('Menu under PHP 0.29','menus'),undefined);
});
test('dietary labels cannot match an unsupported tag',()=>{
  const p=place('food','Test Kitchen','restaurant',{menus:[item('tag','10',{tags:['vegetarian']})]});
  assert.equal(answerDirectoryQuery('Vegetarian dishes',[p],saved).some(p=>p.kind==='menus'),false);
  p.menus[0].tagCitation=citation;
  assert.equal(answerDirectoryQuery('Vegetarian dishes',[p],saved).find(p=>p.kind==='menus').items.length,1);
});
test('route handoff has no made-up distance, origin or geometry',()=>{
  const result=payload('Directions to Test Kitchen','route');assert.equal(result.placeId,'food');assert.equal(result.result.available,false);assert.equal(result.result.lengthM,undefined);
  assert.equal(payload('How to get there','route'),undefined);
});
test('saved results omit removed records, preserve actual itinerary and refuse AI planning',()=>{
  assert.equal(payload('My saved places','places').total,1);
  assert.equal(payload('Show my itinerary','itinerary').saved,saved);
  assert.equal(payload('Create a trip','capability').state,'model-unavailable');
});
test('absent records and live facts produce explicit unavailable states',()=>{
  assert.equal(answerDirectoryQuery('Find coffee',[],saved).some(p=>p.kind==='places'),false);
  assert.equal(payload('Which restaurants are open now','capability').state,'unsupported-query');
});


test('sample menus stay candidate, disclose fiction and cannot create geographic routes',()=>{
  const sampleCitation={...citation,status:'candidate',sourceId:'OMNI-UX-V2-FICTIONAL-PREVIEW',verificationMethod:'synthetic-preview'};
  const sample=place('sample-coffee','Test sample coffee','Coffee',{menus:[{...item('sample-dish','125'),citation:sampleCitation,priceCitation:sampleCitation,tagCitation:sampleCitation,tags:['vegetarian recipe']}]});
  const result=answerDirectoryQuery('Menu under PHP 150',[sample],saved);
  assert.equal(result.find(p=>p.kind==='menus').items.length,1);
  assert.match(result.find(p=>p.kind==='text').text,/fictional/);
  assert.equal(sample.menus[0].citation.status,'candidate');
  const route=answerDirectoryQuery('Directions to Test sample coffee',[sample],saved).find(p=>p.kind==='route');
  assert.equal(route.result.available,false);assert.match(route.result.reason,/fictional sample/);
  // Merely assigning a sample ID must not permit unrelated candidate evidence.
  sample.menus[0].priceCitation={...citation,status:'candidate'};
  assert.equal(answerDirectoryQuery('Menu under PHP 150',[sample],saved).some(p=>p.kind==='menus'),false);
});
