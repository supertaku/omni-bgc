// Synthetic contract records only. No native runtime or real-company acceptance claim.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const {loadTs}=require('../../helpers/load-ts.cjs');
const root=require('node:path').resolve(__dirname,'../../..');
const fixture=JSON.parse(execFileSync('python',['tests/data-quality/offices/emit_projection.py'],{cwd:root,encoding:'utf8'}));
let now=Date.parse('2026-10-15T00:00:00Z');
class Clock extends Date { static now(){return now;} }
const cache=new Map(), globals={Date:Clock,__DEV__:false};
const mocks={'../explore/demoDirectory':{isDemoPlace:()=>false}};
const load=file=>loadTs('apps/mobile/src/'+file,mocks,globals,cache);
const service=load('features/offices/service.ts'), adapter=load('data/offices.ts');
const parse=load('data/directory-entities.ts').parseDirectoryEntities;
const map=load('features/offices/map.ts');
const directory=load('features/assistant/directory.ts');
const saved={placeIds:[],itinerary:[],startTime:null};
function install(){now=Date.parse('2026-10-15T00:00:00Z');const places=parse(fixture.facts);const offices=adapter.parseOfficeDetails(fixture.facts,places);service.replaceOfficeDirectory(offices,true);return {places,offices};}

test('actual M1 SQLite projection binds business, building, evidence, expiry and mobile office',()=>{
 const {places,offices}=install(); assert.equal(offices.length,1);
 const office=offices[0];assert.equal(office.placeId,fixture.ids.site);assert.equal(office.organizationId,fixture.ids.org);
 assert.equal(office.buildingId,fixture.ids.tower);assert.equal(office.building,'Synthetic Tower');assert.equal(office.floor,null);
 assert.equal(office.validUntil,'2027-10-14T00:00:00.000Z');assert.equal(office.verifiedAt,'2026-10-14T00:00:00Z');
 assert.ok(office.citations.every(c=>c.factId&&c.evidenceId&&c.snapshotId&&c.rawSha256&&c.verificationMethod));
 assert.equal(places.find(p=>p.id===office.placeId).status,'approved');
 assert.equal(service.searchOffices({query:'technology bgc core'}).total,1);
 assert.equal(service.searchOffices({query:'Synthetic Tower'}).items[0].placeId,fixture.ids.site);
});
test('unknown/corrupt organization, missing expiry and disputed claims cannot form an office',()=>{
 for(const change of [facts=>facts.filter(f=>f.property!=='office_organization'),facts=>facts.map(f=>({...f,evidence_valid_until:undefined})),facts=>[...facts,{...facts.find(f=>f.property==='office_district'),value_json:'"mckinley-west"'}],facts=>facts.map(f=>f.property==='office_organization'?{...f,value_json:'"unknown"'}:f)]){
  const facts=change(fixture.facts);assert.equal(adapter.parseOfficeDetails(facts,parse(facts)).length,0);
 }
});
test('only cited organization aliases extend office search; review suggestions never become facts',()=>{
 const alias={...fixture.facts.find(f=>f.entity_id===fixture.ids.org&&f.property==='name'),fact_id:'TEST organization alias',property:'alias',value_json:'"Synthetic and Partners"'};
 const facts=[...fixture.facts,alias];const offices=adapter.parseOfficeDetails(facts,parse(facts));service.replaceOfficeDirectory(offices,true);
 assert.equal(service.searchOffices({query:'Synthetic and Partners'}).total,1);
 assert.ok(offices[0].citations.some(c=>c.factId===alias.fact_id));
});
test('reviewed pack/permission expiry caps cached office details',()=>{
 const places=parse(fixture.facts);const until='2026-11-15T00:00:00Z';const offices=adapter.parseOfficeDetails(fixture.facts,places,until);
 assert.equal(offices[0].validUntil,'2026-11-15T00:00:00.000Z');
 service.replaceOfficeDirectory(offices,true);now=Date.parse(until);assert.equal(service.searchOffices().total,0);
 assert.equal(adapter.parseOfficeDetails(fixture.facts,places,'invalid').length,0);
});
test('cited building aliases remain searchable separately from company aliases',()=>{
 const alias={...fixture.facts.find(f=>f.entity_id===fixture.ids.tower&&f.property==='name'),fact_id:'TEST building alias',property:'alias',value_json:'"Former Synthetic Park"'};
 const facts=[...fixture.facts,alias];const offices=adapter.parseOfficeDetails(facts,parse(facts));service.replaceOfficeDirectory(offices,true);
 assert.equal(service.searchOffices({query:'Former Synthetic Park'}).total,1);
 assert.equal(offices[0].aliases.includes('Former Synthetic Park'),false);
 assert.ok(offices[0].citations.some(c=>c.factId===alias.fact_id));
});
test('P&G initialism matches a literal cited company alias rather than common address initials',()=>{
 const {offices}=install();const target={...offices[0],name:'Synthetic Procter & Gamble (P&G)',aliases:['P&G']};
 const other={...offices[0],placeId:'00000000-0000-4000-8000-000000000099',name:'Synthetic Other',address:'Philippines Global City'};
 service.replaceOfficeDirectory([target,other],true);assert.equal(service.searchOffices({query:'P&G'}).total,1);assert.equal(service.searchOffices({query:'P G'}).items[0].placeId,target.placeId);
});
test('building points are approximate; unknown/outside/unavailable scope yields no office focus',()=>{
 const {places,offices}=install(); const place=places.find(p=>p.id===fixture.ids.site);
 map.setOfficeMapScope(null);assert.equal(map.officeFocus(place),null);assert.equal(map.officeMapCoverage(place.id),'unavailable');
 map.setOfficeMapScope(map.fallbackOfficeMapScope);assert.equal(map.officeMapCoverage(place.id),'mapped');assert.equal(map.officeFocus(place).join(','),'121.05,14.55');
 assert.equal(map.officeMapPlaces(places).filter(p=>p.id===fixture.ids.site).length,0); // canonical building represents group
 service.replaceOfficeDirectory([{...offices[0],placeId:'00000000-0000-4000-8000-000000000099',coordinate:[122,15]}],true);
 assert.equal(map.officeMapCoverage('00000000-0000-4000-8000-000000000099'),'outside');
 assert.equal(map.officeFocus({...place,id:'00000000-0000-4000-8000-000000000099'}),null);
 service.replaceOfficeDirectory([{...offices[0],coordinate:null,locationKind:'unknown'}],true);assert.equal(map.officeFocus(place),null);
});
test('Assistant uses approved offices and preserves live-status, navigation and price guards',()=>{
 install();const places=service.officeTextPlaces();
 const response=directory.answerDirectoryQuery('Find company offices',places,saved);
 assert.equal(response.find(p=>p.kind==='places').placeIds[0],fixture.ids.site);
 assert.ok(response.find(p=>p.kind==='evidence').citations.length);
 for(const query of ['offices open now','office phone number','walk to office']){
  const response=directory.answerDirectoryQuery(query,places,saved);assert.equal(response.some(p=>p.kind==='places'),false,query);
 }
 assert.equal(directory.answerDirectoryQuery('office menu under PHP 100',places,saved).some(p=>p.kind==='places'),false);
});
test('expiry/closed/registered-only preserve identity but leave operating results and map pins',()=>{
 const {places,offices}=install();
 for(const update of [{state:'closed'},{presence:'registered_only'},{presence:'virtual_only'},{state:'uncertain'}]){
  service.replaceOfficeDirectory([{...offices[0],...update}],true);assert.equal(service.searchOffices().total,0);assert.equal(service.searchOffices({includeNonOperating:true}).total,1);assert.ok(service.officeSavedLabel(fixture.ids.site));
 }
 service.replaceOfficeDirectory(offices,true);now=Date.parse(offices[0].validUntil);
 assert.equal(service.officeTextPlaces().length,0);assert.match(service.officeSavedLabel(fixture.ids.site),/Stale/);
 assert.equal(service.currentOfficePlaces(places).some(p=>p.id===fixture.ids.site),false);
 assert.equal(directory.answerDirectoryQuery('company offices',places,saved).some(p=>p.kind==='places'),false);
});
test('5000 offices preserve multisite identity and bounded deterministic pagination',()=>{
 const {offices}=install();const rows=Array.from({length:5000},(_,i)=>({...offices[0],placeId:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`Synthetic Office ${i}`,industry:i%2?'technology':'finance'}));
 service.replaceOfficeDirectory(rows,true);const start=performance.now();
 for(let i=0;i<100;i++) assert.equal(service.searchOffices({query:'technology',limit:200}).items.length,100);
 const elapsed=performance.now()-start;
 assert.equal(service.searchOffices({buildingId:fixture.ids.tower}).total,5000);
 assert.notEqual(service.searchOffices({offset:0,limit:30}).items[0].placeId,service.searchOffices({offset:30,limit:30}).items[0].placeId);
 console.log(JSON.stringify({hostOnly:true,offices:5000,queries:100,meanQueryMilliseconds:elapsed/100,deviceBenchmark:false}));
});
test('candidate asset cannot become approved records and production research view stays disabled',()=>{
 const research=loadTs('apps/mobile/src/features/offices/research.ts',{'../../../assets/generated/offices/research.json':{candidates:[]}},globals);
 assert.equal(research.internalOfficeResearchEnabled,false);
 const candidate={candidateId:'research:offices:sha256:test:row-0001',name:'Synthetic',industry:null,district:null,building:null,floor:null,address:null,presenceClaim:null,researchDate:null,evidenceStrength:null,sourceUrl:null,issues:[]};
 const asset={version:'office-research-mobile-v1',origin:'internal_research',publicationAuthorized:false,mapPoints:0,candidates:[candidate]};
 assert.equal(research.createOfficeResearch(asset).count,1);
 const initialism={...asset,candidates:[{...candidate,name:'Synthetic P&G'}, {...candidate,candidateId:candidate.candidateId+'-other',name:'Synthetic Other',address:'Philippines Global City'}]};
 assert.equal(research.createOfficeResearch(initialism).search('P&G').total,1);
 for(const injection of [{coordinate:[121.05,14.55]},{status:'approved'},{placeId:fixture.ids.site}]) assert.equal(research.createOfficeResearch({...asset,candidates:[{...candidate,...injection}]}).count,0);
});
