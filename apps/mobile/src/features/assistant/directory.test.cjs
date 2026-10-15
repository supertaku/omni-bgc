// Synthetic contract inputs for deterministic tests; never imported by the app.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const ts=require(path.resolve(__dirname,'../../../node_modules/typescript'));
const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'directory.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const moneyContext={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../domain/money.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,moneyContext);
const context={exports:{},Set,BigInt,require:name=>{
  if(name==='../../domain/money')return moneyContext.exports;
  if(name==='../offices/assistant')return require('../../../../../tests/helpers/load-ts.cjs').loadTs('apps/mobile/src/features/offices/assistant.ts');
  if(name==='../explore/demoDirectory')return {isDemoPlace:place=>String(typeof place==='string'?place:place.id).startsWith('sample-')};
  throw Error('Unexpected directory import '+name);
}};vm.runInNewContext(source,context);
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
test('directions always defer with exact wording and no origin, route or place handoff',()=>{
  for(const query of ['Directions to Test Kitchen','How to get there','Walking to Test Café','How do I get to Test Kitchen','Navigate to unknown','Directions to my saved places','Walking directions for my itinerary','Find a walking route under PHP 30','How to reach Test Kitchen']) {
    const result=answerDirectoryQuery(query,places,saved);
    assert.equal(result.length,1,query);
    assert.equal(result[0].kind,'text',query);
    assert.equal(result[0].text,'Walking directions are not available in this version.',query);
  }
});
test('saved results omit removed records and deferral leaves the saved itinerary intact',()=>{
  assert.equal(payload('My saved places','places').total,1);
  const original=JSON.stringify(saved);
  for(const query of ['Show my itinerary','Create a trip','Plan my visit']) {
    const result=answerDirectoryQuery(query,places,saved);
    assert.equal(result.length,1);assert.equal(result[0].kind,'text');
    assert.equal(result[0].text,'Visit planning is not available in this version.');
  }
  assert.equal(JSON.stringify(saved),original);
  assert.ok(!answerDirectoryQuery('My saved places',places,{...saved,placeIds:[]})[0].text.includes('Save'));
});
test('absent records and live facts produce explicit unavailable states',()=>{
  assert.equal(answerDirectoryQuery('Find coffee',[],saved).some(p=>p.kind==='places'),false);
  assert.equal(payload('Which restaurants are open now','capability').state,'unsupported-query');
});

test('a stale item cannot become an ordinary menu result through an approved branch',()=>{
  const approved=place('stale-item','Test Old Kitchen','restaurant',{status:'approved',menus:[item('old','100',{citation:{...citation,status:'stale'}})]});
  for(const query of ['Show menu for Test Old Kitchen','Menu under PHP 200']) {
    const result=answerDirectoryQuery(query,[approved],saved);
    assert.equal(result.some(payload=>payload.kind==='menus'),false);
    assert.match(result[0].text,/No matching menu items/);
  }
  assert.equal(approved.menus[0].citation.status,'stale');
});


test('sample menus stay candidate, disclose fiction and cannot create geographic routes',()=>{
  const sampleCitation={...citation,status:'candidate',sourceId:'OMNI-UX-V2-FICTIONAL-PREVIEW',verificationMethod:'synthetic-preview'};
  const sample=place('sample-coffee','Test sample coffee','Coffee',{menus:[{...item('sample-dish','125'),citation:sampleCitation,priceCitation:sampleCitation,tagCitation:sampleCitation,tags:['vegetarian recipe']}]});
  const result=answerDirectoryQuery('Menu under PHP 150',[sample],saved);
  assert.equal(result.find(p=>p.kind==='menus').items.length,1);
  assert.match(result.find(p=>p.kind==='text').text,/fictional/);
  assert.equal(sample.menus[0].citation.status,'candidate');
  const route=answerDirectoryQuery('Directions to Test sample coffee',[sample],saved);
  assert.equal(route.length,1);assert.equal(route[0].kind,'text');
  assert.equal(route[0].text,'Walking directions are not available in this version.');
  // Merely assigning a sample ID must not permit unrelated candidate evidence.
  sample.menus[0].priceCitation={...citation,status:'candidate'};
  assert.equal(answerDirectoryQuery('Menu under PHP 150',[sample],saved).some(p=>p.kind==='menus'),false);
});
