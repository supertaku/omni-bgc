const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, filename);
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve(__dirname, '../src/features/assistant/mapResults.ts');
const { resultPlaceIds, resolveMapResultRecords } = require(filename);
assert.deepEqual(resultPlaceIds([
  {kind:'places',placeIds:['a','b']}, {kind:'place',placeId:'a'},
  {kind:'food-menus',items:[{placeId:'c'}]}, {kind:'food-hours',placeId:'d'},
  {kind:'menus',items:[{placeId:'b'}]}, {kind:'text',text:'coordinates are not IDs'},
]), ['a','b','c','d']);
assert.equal(resultPlaceIds([{kind:'places',placeIds:Array.from({length:120},(_,i)=>String(i))}]).length,100);
(async () => {
  const candidate = {id:'candidate',status:'candidate',coordinate:null};
  const stale = {id:'old',status:'approved',coordinate:[121.05,14.55]};
  const requested=[];
  const rows=await resolveMapResultRecords(['old','approved','candidate','mismatch','failed','candidate'],[candidate,stale],async id=>{
    requested.push(id);
    if(id==='approved') return {id,status:'approved',coordinate:[121.05,14.55]};
    if(id==='mismatch') return {id:'wrong',status:'approved'};
    if(id==='failed') throw Error('source unavailable');
    return null;
  });
  assert.deepEqual(rows.map(row=>row.id),['approved','candidate']);
  assert.equal(rows[1].status,'candidate','map action never upgrades candidate authority');
  assert.equal(rows[1].coordinate,null,'text-only result gets no invented coordinate');
  assert.ok(requested.includes('old'),'historical approved snapshots are re-read');
  assert.ok(!requested.includes('candidate'),'candidate comes only from current source directory');
  const parserPath=path.resolve(__dirname,'../src/data/parser.ts');
  const parser=new Module(parserPath,module);
  parser._compile(ts.transpileModule(fs.readFileSync(parserPath,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,parserPath);
  const parent='00000000-0000-4000-8000-000000000001', child='00000000-0000-4000-8000-000000000002';
  const fact=(entity_id,kind,property,value,parent_id=null)=>({entity_id,kind,property,value_json:JSON.stringify(value),knowledge:'asserted',parent_id});
  const facts=[fact(parent,'building','name','Test building'),fact(child,'place','name','Test tenant',parent),fact(child,'place','building',parent,parent)];
  assert.equal(parser.exports.parsePlaces(facts)[0].buildingId,parent);
  assert.equal(parser.exports.parsePlaces(facts.filter(f=>f.property!=='building'))[0].buildingId,undefined,'parent alone cannot invent a supported relationship');
  // Run the actual source-refresh effect with withdrawn and changed selected records.
  const application=fs.readFileSync(path.resolve(__dirname,'../src/app/Application.tsx'),'utf8');
  const tree=ts.createSourceFile('Application.tsx',application,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let refreshEffect;
  function visit(node) {
    if(ts.isCallExpression(node) && node.expression.getText(tree)==='useEffect'
      && node.arguments[1]?.getText(tree)==='[basePlaces, setSelected]') refreshEffect=node.arguments[0].getText(tree);
    ts.forEachChild(node,visit);
  }
  visit(tree);
  assert.ok(refreshEffect,'source refresh must revoke transient map snapshots');
  const javascript=ts.transpileModule(`const run = ${refreshEffect};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  for(const retained of [false,true]) {
    let overlay=[stale],highlights=['old'],fit=[[121.05,14.55]],selected=stale;
    const fresh={...stale,name:'Changed source',coordinate:[121.06,14.56]};
    Function('basePlaces','setMapResults','setHighlightedPlaceIds','setFitCoordinates','setSelected',javascript+';run();')(
      retained?[fresh]:[],value=>overlay=value,value=>highlights=value,value=>fit=value,update=>selected=update(selected));
    assert.deepEqual(overlay,[],'old source overlays revoked after refresh/rollback');
    assert.deepEqual(highlights,[]);
    assert.equal(fit,null);
    assert.deepEqual(selected,retained?fresh:null,'selection is refreshed or revoked with its authoritative source');
  }
  let chooseArrow, navigationEffect;
  function findOpening(node) {
    if(ts.isVariableDeclaration(node) && node.name.getText(tree)==='choose') chooseArrow=node.initializer.getText(tree);
    if(ts.isCallExpression(node) && node.expression.getText(tree)==='useEffect'
      && node.arguments[1]?.getText(tree)==='[tab, panel, query, category, confirming, installing, basePlaces]') navigationEffect=node.arguments[0].getText(tree);
    ts.forEachChild(node,findOpening);
  }
  findOpening(tree);
  assert.ok(chooseArrow && navigationEffect, 'pending place openings are invalidated on navigation/source change');
  const compiledChoose=ts.transpileModule(`const open = ${chooseArrow};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const compiledNavigation=ts.transpileModule(`const navigate = ${navigationEffect};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const {resolveCurrentPlace}=require('../src/features/explore/placeOpening.ts');
  for(const navigated of [false,true]) {
    let complete, chosen;
    const pending=new Promise(resolve=>complete=resolve), selectionEpoch={current:0};
    const deps={confirming:false,installing:false,selectionEpoch,resolveCurrentPlace,places:[stale],getPlaceDetails:()=>pending,
      setMessage:()=>{},setLocationFocus:()=>{},setFitCoordinates:()=>{},setMapResults:()=>{},setHighlightedPlaceIds:()=>{},
      setTabSafely:()=>{},selectPlace:place=>chosen=place,officeFocus:place=>place.coordinate,officeScope:null,coverageAt:()=> 'service'};
    const open=Function('deps',`const {${Object.keys(deps).join(',')}}=deps;${compiledChoose};return open;`)(deps);
    const opening=open(stale);
    if(navigated) Function('selectionEpoch',compiledNavigation+';navigate();')(selectionEpoch);
    complete(stale);
    assert.equal(await opening,!navigated);
    assert.equal(!!chosen,!navigated,'a delayed lookup must not reopen dismissed details');
  }
  console.log('PASS result IDs, current-source map resolution, candidate/text-only preservation and supported building IDs');
})().catch(error=>{console.error(error);process.exitCode=1;});
