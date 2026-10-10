import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'../../..');
const require=createRequire(path.join(root,'apps/mobile/package.json'));const ts=require('typescript');
const modules={};
function load(file,mocks={}){const js=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const ctx={exports:{},require:n=>mocks[n]??modules[n]??{},Date,Map,Set,Promise,console};vm.runInNewContext(js,ctx);return ctx.exports;}
const parser=load('apps/mobile/src/data/parser.ts');modules['./parser']=parser;
const lexical=load('apps/mobile/src/data/lexical.ts');modules['./lexical']=lexical;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const citation={sourceId:'TEST ONLY',label:'TEST ONLY',license:'TEST ONLY',observedAt:'2026-10-10T00:00:00Z',verifiedAt:'2026-10-10T00:00:00Z',status:'approved',factId:'TEST fact',snapshotId:id(99),rawSha256:'a'.repeat(64),evidenceId:'TEST evidence',locator:'TEST ONLY',verificationMethod:'synthetic_review'};
const place=(n,amount,currency='PHP')=>({id:id(n),name:'TEST branch '+n,category:'restaurant',coordinate:null,aliases:[],entrances:[],citations:[citation],status:'approved',menus:[{id:id(n+10),name:'TEST salmon pasta',priceValue:amount===null?undefined:{amount,currency},tags:n===1?['explicit-vegetarian-label']:undefined,citation:{...citation},priceCitation:{...citation},tagCitation:{...citation},relationshipCitations:[{...citation,factId:'TEST menu-place'},{...citation,factId:'TEST item-menu'}]}]});
const places=[place(1,'250.00'),place(2,'350.00'),place(3,null),place(4,'200','USD')];
const api=load('apps/mobile/src/data/retrieval.ts',{'./store':{loadPlaces:async()=>places,searchPlaces:async(q,c)=>places.filter(p=>!c||p.category===c)}});
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
test('Branch price unknown and currency stay separate',()=>{assert.equal(api.filterMenuItems(places,{branchId:id(1)}).length,1);assert.equal(api.filterMenuItems(places,{maxPricePhp:'300'}).length,1);assert.equal(api.filterMenuItems(places,{maxPricePhp:'249.99'}).length,0);assert.equal(api.filterMenuItems(places,{query:'SALMON!',requiredTags:['explicit-vegetarian-label']}).length,1);assert.equal(api.filterMenuItems(places,{requiredTags:['vegetarian']}).length,0);});
test('PHP decimals compare exactly without rounding or guessed prices',()=>{assert.equal(api.filterMenuItems([place(1,'0.30')],{maxPricePhp:'0.30'}).length,1);assert.equal(api.filterMenuItems([place(1,'0.31')],{maxPricePhp:'0.30'}).length,0);for(const maxPricePhp of ['-1','NaN','1.001','1e3'])assert.throws(()=>api.filterMenuItems(places,{maxPricePhp}));assert.throws(()=>api.filterMenuItems(places,{branchId:'name-derived-id'}));});
test('Candidate branches cannot satisfy queries',()=>{assert.equal(api.filterMenuItems([{...place(1,'100'),status:'candidate'}]).length,0);});
test('Menu item and both relationships require exact approved evidence',()=>{
for(const status of ['candidate','stale']){const p=place(1,'100');p.menus[0].citation={...citation,status};assert.equal(api.filterMenuItems([p]).length,0);}
for(const key of ['factId','snapshotId','rawSha256','evidenceId','locator','verificationMethod']){const p=place(1,'100');delete p.menus[0].citation[key];assert.equal(api.filterMenuItems([p]).length,0);p.menus[0].citation=citation;}
for(const links of [undefined,[],[citation],[citation,{...citation,status:'stale'}]]){const p=place(1,'100');p.menus[0].relationshipCitations=links;assert.equal(api.filterMenuItems([p]).length,0);}
const p=place(1,'100');p.menus[0].citation={...citation,verifiedAt:'2099-01-01T00:00:00Z'};assert.equal(api.filterMenuItems([p]).length,0);
});
test('Unsupported price and tag claims are removed without mutating source rows',()=>{
const p=place(1,'100');p.menus[0].priceCitation={...citation,status:'stale'};p.menus[0].tagCitation={...citation,status:'candidate'};p.menus[0].allergens=['TEST unsupported'];
assert.equal(api.filterMenuItems([p],{maxPricePhp:'200'}).length,0);assert.equal(api.filterMenuItems([p],{requiredTags:['explicit-vegetarian-label']}).length,0);
const result=api.filterMenuItems([p])[0].item;assert.equal(result.priceValue,undefined);assert.equal(result.tags,undefined);assert.equal(result.allergens,undefined);assert.equal(p.menus[0].priceValue.amount,'100');assert.equal(p.menus[0].tags.length,1);
});
test('Lexical normalization and dictionary aliases remain bounded and literal',()=>{
assert.equal(lexical.lexicalTokens('ＣＯＦＦＥＥ!').join(' '),'coffee');assert.equal(lexical.lexicalTokens('a '.repeat(30)).length,8);assert.equal(lexical.lexicalTokens('z'.repeat(200))[0].length,48);assert.throws(()=>lexical.lexicalTokens('z'.repeat(2049)));
assert.ok(lexical.lexicalSearchQueries('coffee tinapay').includes('coffee bread'));assert.ok(lexical.lexicalSearchQueries('kape bread').length<=3);
const p=place(1,'100');p.menus[0].name='TEST coffee tinapay';assert.equal(api.filterMenuItems([p],{query:'ＫＡＰＥ bread!'}).length,1);assert.equal(api.filterMenuItems([p],{query:'vegetarian'}).length,0);
assert.equal(lexical.matchesLexicalText('TEST coffee',lexical.lexicalAlternatives('coffee OR salmon')),false);
});
test('Parser retains price values and only explicit tags',()=>{const base={entity_id:id(1),kind:'place',parent_id:null,property:'name',value_json:'"TEST branch"',knowledge:'asserted',source_id:'TEST ONLY',license:'TEST ONLY',attribution:'TEST ONLY',observed_at:'2026-10-10T00:00:00Z',verified_at:'2026-10-10T00:00:00Z',locator:'TEST ONLY'};
const menu={...base,entity_id:id(2),kind:'menu',parent_id:id(1)};const item={...base,entity_id:id(3),kind:'menu_item',parent_id:id(2),value_json:'"TEST dish"'};
const relations=[{...menu,property:'place',value_json:JSON.stringify(id(1))},{...item,property:'menu',value_json:JSON.stringify(id(2))}];
const input=[base,menu,item,...relations,{...item,property:'price',value_json:'{"amount":"250.00","currency":"PHP"}'},{...item,property:'tag',value_json:'"explicit-vegetarian-label"'}];const result=parser.parsePlaces(input)[0].menus[0];assert.equal(result.priceValue.amount,'250.00');assert.equal(result.priceValue.currency,'PHP');assert.equal(result.tags[0],'explicit-vegetarian-label');assert.equal(result.allergens,undefined);
assert.equal(parser.parsePlaces([base,menu,item,...relations,{...item,property:'price',value_json:'{"amount":-1,"currency":"PHP"}'}])[0].menus[0].priceValue,undefined);
for(const removed of [menu,relations[0],relations[1]])assert.equal(parser.parsePlaces(input.filter(f=>f!==removed))[0].menus.length,0);
});
test('Building name requires current subject-bound relationship',()=>{const base={entity_id:id(1),kind:'place',parent_id:id(2),property:'name',value_json:'"TEST branch"',knowledge:'asserted',source_id:'TEST ONLY',license:'TEST ONLY',attribution:'TEST ONLY',observed_at:'2026-10-10T00:00:00Z',verified_at:'2026-10-10T00:00:00Z',locator:'TEST ONLY'};const building={...base,entity_id:id(2),kind:'building',parent_id:null,value_json:'"TEST building"'};
assert.equal(parser.parsePlaces([base,building])[0].building,undefined);assert.equal(parser.parsePlaces([base,building,{...base,property:'building',value_json:JSON.stringify(id(2))}])[0].building,'TEST building');});
test('Same-source facts retain distinct exact citations',()=>{const base={entity_id:id(1),kind:'place',parent_id:null,property:'name',value_json:'"TEST branch"',knowledge:'asserted',source_id:'TEST ONLY',license:'TEST ONLY',attribution:'TEST ONLY',observed_at:'2026-10-10T00:00:00Z',verified_at:'2026-10-10T00:00:00Z',locator:'TEST name',fact_id:'name',evidence_id:'e-name',snapshot_id:id(99),raw_sha256:'a'.repeat(64)};
const coordinate={...base,property:'coordinate',value_json:'{"longitude":121.05,"latitude":14.55,"crs":"EPSG:4326"}',locator:'TEST coordinate',fact_id:'coordinate',evidence_id:'e-coordinate'};const citations=parser.parsePlaces([base,coordinate])[0].citations;assert.equal(citations.length,2);assert.equal(citations[1].factId,'coordinate');assert.equal(citations[1].evidenceId,'e-coordinate');assert.equal(citations[1].rawSha256,'a'.repeat(64));assert.equal(citations[1].locator,'TEST coordinate');});
assert.equal((await api.getRestaurantMenu(id(1))).length,1);assert.equal(await api.getPlaceDetails(id(99)),null);count++;console.log('PASS supported store services return current branch data');
const calls=[];const candidate={...place(2,'100'),status:'candidate'};
const aliasApi=load('apps/mobile/src/data/retrieval.ts',{'./store':{searchPlaces:async(query,category)=>{calls.push([query,category]);return query==='coffee bread'?[place(1,'100'),candidate]:[place(1,'100')];}}});
assert.equal((await aliasApi.findPlaces({query:'kape tinapay',category:'restaurant'})).length,1);assert.ok(calls.some(([query,category])=>query==='coffee bread'&&category==='restaurant'));assert.ok(calls.length<=3);count++;console.log('PASS place aliases preserve filters, deduplicate identities and exclude candidates');
console.log(`${count} deterministic mobile retrieval cases passed; native device not exercised.`);
