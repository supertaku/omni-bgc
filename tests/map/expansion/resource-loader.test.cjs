const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../../helpers/load-ts.cjs');
const { createMapResourceLoader,defaultScopeView } = loadTs('apps/mobile/src/map/resource-loader.ts');
const scopes = loadTs('apps/mobile/src/map/scope.ts');
const fs=require('node:fs');
const registry=JSON.parse(fs.readFileSync('apps/mobile/src/map/reviewed-scopes.json','utf8'));
const expansion=registry.scopes[1];
const style=s=>JSON.stringify({metadata:{scopeId:s.id,scopeManifestSha256:s.manifestSha256}});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};

test('latest foreground result wins and an older scope cannot replace it',async()=>{
  const first=deferred(),second=deferred();let calls=0;const accepted=[];
  const loader=createMapResourceLoader(()=>calls++===0?first.promise:second.promise,(s,c)=>accepted.push(c.id),()=>assert.fail('unexpected error'));
  const a=loader.refresh(),b=loader.refresh();second.resolve(style(expansion));await b;first.resolve(style(scopes.pilotScope));await a;
  assert.deepEqual(accepted,[expansion.id]);
});
test('superseded rejection and unmounted results cannot change current state',async()=>{
  const first=deferred(),second=deferred();let calls=0,errors=0,accepted=0;
  const loader=createMapResourceLoader(()=>calls++===0?first.promise:second.promise,()=>accepted++,()=>errors++);
  const a=loader.refresh(),b=loader.refresh();second.resolve(style(expansion));await b;first.reject(Error('old failure'));await a;
  assert.equal(errors,0);assert.equal(accepted,1);
  const pending=deferred();const disposed=createMapResourceLoader(()=>pending.promise,()=>accepted++,()=>errors++);
  const request=disposed.refresh();disposed.dispose();pending.resolve(style(scopes.pilotScope));await request;assert.equal(accepted,1);
});
test('scope transition command explicitly restores district zoom/bearing and respects flat mode',()=>{
  const district=defaultScopeView(expansion,false),pilot=defaultScopeView(scopes.pilotScope,false);
  assert.equal(district.zoom,15.2);assert.equal(pilot.zoom,17);assert.equal(district.bearing,expansion.defaultView.bearing);
  assert.equal(defaultScopeView(expansion,true).pitch,0);assert.notEqual(district.center,expansion.defaultView.center);
});
