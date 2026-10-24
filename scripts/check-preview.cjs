const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildPreview, uuid, interiorPoint, containsPoint, dishKey, coverKey } = require('./build-preview.cjs');
assert.equal(dishKey({name:'Sirloin steak'}),'dish-steak');
assert.equal(dishKey({name:'Coconut chicken curry'}),'dish-chicken');
assert.equal(coverKey('Parking','One Parkade'),'cover-building');
const a = buildPreview(), b = buildPreview();
assert.equal(JSON.stringify(a), JSON.stringify(b), 'identical inputs rebuild byte-identically');
const original = JSON.parse(fs.readFileSync('assets/generated/food-research/directory.json'));
const rawDirectory = JSON.parse(fs.readFileSync('assets/generated/directory/places.json'));
assert.ok(a.food.restaurants.length >= original.restaurants.length);
const places = new Map(a.overlay.places.map(p => [p.id, p]));
const ids = new Set();
for (const r of a.food.restaurants) {
  assert.ok(r.items.length >= 8);
  const source = original.restaurants.find(s => s.id === r.id);
  for (const item of source?.items??[]) {
    const projected = r.items.find(i => i.id === item.id);
    assert.ok(projected, 'source item IDs retained');
    for (const field of ['amount', 'priceEvidence', 'priceSourceUrl', 'menuSourceUrl', 'restaurantId'])
      assert.equal(projected[field], item[field], 'existing prices and source claims immutable');
    if(item.priceEvidence!=='estimated') assert.equal(a.overlay.itemEvidence[item.id].amount.observedAt,item.researchDate,'source dates are never refreshed by rebuild');
  }
  for (const item of r.items) {
    assert.ok(!ids.has(item.id)); ids.add(item.id);
    assert.equal(item.restaurantId, r.id);
    assert.match(item.amount, /^\d{1,12}(?:\.\d{1,2})?$/);
    assert.ok(Number(item.amount) > 0 && item.currency === 'PHP');
    assert.ok(item.description && item.imageKey.startsWith('dish-'));
    assert.ok(places.has(a.overlay.aliases[item.id]));
  }
}
for (const raw of rawDirectory) {
  const current = places.get(raw.id);
  assert.deepEqual(current.coordinate, raw.coordinate, 'recorded coordinates unchanged');
  assert.deepEqual(current.citations, raw.citations, 'source approval metadata unchanged');
  assert.equal(a.overlay.details[raw.id].fields.coordinate.classification, 'sourced', 'recorded point retains its own coordinate evidence');
  assert.deepEqual(a.overlay.details[raw.id].fields.coordinate.sourceIds, raw.citations.map(c=>c.sourceId));
  assert.equal(a.overlay.details[raw.id].location.kind, 'recorded-point');
}
for (const p of places.values()) {
  assert.ok(p.description && p.imageKey && p.status !== 'approved');
  assert.equal(a.overlay.aliases[p.id], p.id, 'canonical lookup idempotent');
  assert.equal(p.entrances.length, 0, 'preview anchors never gain entrance eligibility');
  if (p.coordinate) assert.ok(p.coordinate.every(Number.isFinite));
  const location=a.overlay.details[p.id].location;
  assert.equal(location.kind,p.locationKind,'every place exposes its coordinate quality');
  if(p.locationKind==='building-anchor') {
    assert.equal(a.overlay.details[p.id].fields.coordinate.classification,'derived');
    const polygon=a.buildings.find(b=>b.sourceId===location.sourceIds.at(-1));
    assert.ok(polygon && containsPoint(polygon.polygon,p.coordinate),'building anchor stays inside its named source polygon');
    assert.equal(location.sourceSha256,polygon.sourceSha256);
    assert.equal(location.entrance,false);
  }
}
const q=a.quality;
assert.equal(q.counts.canonicalPlaces,places.size);
assert.equal(q.counts.recordedPlacePoints+q.counts.derivedBuildingAnchors+q.counts.unresolvedIdentities,places.size);
assert.equal(q.counts.unresolvedIdentities,q.unresolved.length);
assert.equal(q.counts.ambiguousBuildingMatches,q.unresolved.filter(x=>x.assessment==='ambiguous-building-polygon').length);
assert.equal(q.counts.missingCoordinateEvidence,q.unresolved.filter(x=>x.assessment==='missing-building-claim').length);
assert.equal(q.counts.reviewedBuildingAssociations,a.inputs.crosswalk.reviewedBuildingAssociations.reduce((n,row)=>n+a.overlay.places.filter(p=>a.overlay.details[p.id].location?.relationship?.sourceId===row.osmId).length,0)+a.inputs.crosswalk.reviewedPlaceBuildings.length);
for(const row of a.inputs.crosswalk.reviewedPlaceBuildings) {
  const place=places.get(a.overlay.aliases[row.sourceId]);
  assert.equal(a.overlay.details[place.id].location.relationship.sourceId,row.osmId,'source-specific address relationship retained');
}
assert.equal(q.counts.publicationRestricted,places.size);
assert.ok(q.unresolved.some(x=>x.name==='George and Onnie’s' && x.polygonSourceIds.length===2),'duplicate named polygons stay unresolved');
assert.ok(q.unresolved.some(x=>x.building==='Robinsons Cyber Sigma'),'off-coverage name similarity does not create an anchor');
for (const merge of a.inputs.crosswalk.merges) {
  assert.equal(a.overlay.aliases[merge.sourceId], merge.canonicalId);
  assert.ok(merge.basis && merge.sourceIds.length);
}
const namedBranches = original.restaurants.filter(r => r.name === 'SaladStop!');
assert.ok(new Set(namedBranches.map(r => a.overlay.aliases[r.id])).size > 1, 'distinct branches stay distinct');
const concave = [[[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4], [0, 0]]];
assert.ok(containsPoint(concave, interiorPoint(concave)));
assert.equal(uuid('office-a'), uuid('office-a'));
assert.notEqual(uuid('office-a'), uuid('office-b'));
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} }).outputText, filename);
const runtime = require('../src/preview/directory.ts');
assert.equal(runtime.previewAvailable, true, 'built overlay must not silently disable itself');
for (const r of a.food.restaurants) {
  assert.ok(runtime.resolvePreviewPlace(r.id));
  const item=r.items[0];
  assert.equal(runtime.resolvePreviewPlace(item.id)?.id, a.overlay.aliases[item.id]);
  assert.equal(runtime.previewDetails(item.id)?.fields.amount?.replacementKey, `${item.id}:amount`);
}
assert.equal(runtime.resolvePreviewPlace('obsolete-id'), null);
const derived=runtime.previewPlaces.find(p=>p.locationKind==='building-anchor');
assert.ok(derived);
assert.equal(runtime.enrichPreviewPlace(derived).locationKind,'building-anchor', 'derived coordinates never become recorded exact points');
assert.equal(a.overlay.places.find(p=>p.id==='4d346150-70aa-531a-a67e-5d67b4aca414').floor,'LGF','refreshed official floor overrides older presentation value without rewriting source');
for(const p of rawDirectory.filter(p=>/food|coffee|restaurant|caf[eé]|bakery|dining/i.test(p.category)))
  assert.ok(a.food.restaurants.some(r=>a.overlay.aliases[r.id]===a.overlay.aliases[p.id]), 'every retained restaurant-like directory place has a menu');
for(const [pattern,dish] of [[/MOS Burger/i,/burger/],[/^Tsuta$/i,/ramen/],[/Jinjoo|Sariwon/i,/bulgogi/],[/KOI Thé|Moonleaf|TWG Tea/i,/milk tea/],[/Agave Mexican/i,/tacos/]]) {
  const restaurants=a.food.restaurants.filter(r=>pattern.test(r.name));
  assert.ok(restaurants.length,`representative cuisine fixture ${pattern}`);
  for(const r of restaurants.filter(r=>!original.restaurants.find(s=>s.id===r.id)?.items.length))
    assert.ok(r.items.some(i=>dish.test(i.name)),`generated preview dishes suit ${r.name}`);
}
console.log(`Preview integrity: ${places.size} canonical places, ${ids.size} menu items, stable identities, PHP values, retained evidence and safe anchors passed.`);
