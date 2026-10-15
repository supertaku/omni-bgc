const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../../helpers/load-ts.cjs');
const directory = loadTs('apps/mobile/src/data/directory-entities.ts');
const building='00000000-0000-4000-8000-000000000001';
const tenant='00000000-0000-4000-8000-000000000002';
const fact=(id,kind,property,value,parent=null)=>({entity_id:id,kind,parent_id:parent,property,value_json:JSON.stringify(value),knowledge:'asserted',source_id:'TEST ONLY',license:'TEST ONLY',attribution:'TEST ONLY',observed_at:'2026-10-14T00:00:00Z',verified_at:'2026-10-14T00:00:00Z',locator:'TEST ONLY'});
const point={longitude:121.05,latitude:14.55,crs:'EPSG:4326'};
const input=[fact(building,'building','name','TEST ONLY Office Building'),fact(building,'building','coordinate',point),fact(building,'building','alias','TEST ONLY Tower'),fact(tenant,'place','name','TEST ONLY Company',building),fact(tenant,'place','coordinate',point,building),fact(tenant,'place','building',building,building),fact(tenant,'place','category','office',building)];

test('approved projection buildings and tenant offices are searchable with original distinct IDs',()=>{
  const places=directory.parseDirectoryEntities(input);assert.equal(places.length,2);
  const b=places.find(p=>p.id===building);assert.equal(b.category,'Building');assert.equal(b.aliases[0],'TEST ONLY Tower');assert.equal(b.entrances.length,0);assert.equal(b.menus.length,0);
  assert.equal(places.find(p=>p.id===tenant).building,'TEST ONLY Office Building');
  assert.equal(directory.tenantsOfBuilding(input,building)[0].id,tenant);
});

test('missing/conflicting/invalid building coordinates cannot create a map destination or tenant match',()=>{
  for (const facts of [input.filter(f=>f.entity_id!==building||f.property!=='coordinate'),[...input,fact(building,'building','coordinate',{...point,longitude:121.051})],input.map(f=>f.entity_id===building&&f.property==='coordinate'?{...f,value_json:JSON.stringify({...point,crs:'EPSG:3857'})}:f)]) {
    assert.equal(directory.parseDirectoryEntities(facts).filter(p=>p.id===building).length,0);
    assert.equal(directory.tenantsOfBuilding(facts,building).length,0);
  }
});

test('a company name or copied parent display name cannot substitute for approved occupancy relationship',()=>{
  const missing=input.filter(f=>f.entity_id!==tenant||f.property!=='building');
  assert.equal(directory.tenantsOfBuilding(missing,building).length,0);
  const conflicting=[...input,fact(tenant,'place','building','00000000-0000-4000-8000-000000000003',building)];
  assert.equal(directory.tenantsOfBuilding(conflicting,building).length,0);
  assert.throws(()=>directory.tenantsOfBuilding(input,'osm:way:1'));
});
