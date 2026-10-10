const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { test } = require('node:test');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'apps/mobile/node_modules/typescript'));
function load(file) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, require: () => ({}), Set }; vm.runInNewContext(output, context); return context.exports;
}
const demo = load('apps/mobile/src/features/explore/demoDirectory.ts');
const directory = load('apps/mobile/src/features/explore/directory.ts');
const parser = load('apps/mobile/src/data/parser.ts');
test('fictional fixtures contain no routes/entrances/coordinates/ratings/allergens or verified facts', () => {
  for (const place of demo.demoPlaces) {
    assert.equal(place.coordinate, null); assert.equal(place.entrances.length, 0); assert.equal(place.status, 'candidate');
    assert.equal(place.demo.classification, 'synthetic-preview'); assert.match(place.name, /Sample/);
    assert.match(place.demo.notice, /Fictional/); assert.match(place.demo.hours, /sample hours/);
    assert.equal(place.citations[0].verifiedAt, null);
    assert.equal(place.citations[0].sourceId, 'OMNI-UX-V2-FICTIONAL-PREVIEW');
    for (const item of place.menus) { assert.equal(item.allergens, undefined); assert.equal(item.checkedAt, undefined); assert.match(item.price, /sample/); }
    assert.equal(place.rating, undefined); assert.equal(place.photo, undefined);
  }
});
test('fixture branches/dishes have distinct stable UUIDs and participate in saved contracts', () => {
  const ids = demo.demoPlaces.flatMap(place => [place.id, ...place.menus.map(item => item.id)]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
  assert.equal(demo.demoPlaces.length, 6); assert.equal(ids.length, 39);
  const state = parser.validateSaved({ placeIds: [demo.demoPlaces[0].id], itinerary: [{ placeId: demo.demoPlaces[2].id, durationMinutes: 30 }], startTime: '12:00' });
  assert.equal(state.itinerary.length, 1);
});
test('dish/category/branch search works without adding fictional data to real merchant facts', () => {
  assert.equal(directory.searchDirectory(demo.demoPlaces, 'tofu', 'Food').length, 2);
  assert.equal(directory.searchDirectory(demo.demoPlaces, 'Cloudline', 'Coffee').length, 2);
  assert.equal(directory.searchDirectory(demo.demoPlaces, 'Courtyard', 'All').length, 1);
  assert.equal(directory.searchDirectory(demo.demoPlaces, 'tofu', 'Coffee').length, 0);
  assert.equal(demo.isDemoPlace(demo.demoPlaces[0]), true); assert.equal(demo.isDemoPlace('source-real-place'), false);
  assert.equal(demo.demoDetails({ id: 'source-real-place' }), null);
});
test('internal preview manifest binds source bytes/counts and denies factual publication', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/evaluations/ux-v2/demo-manifest.json'), 'utf8'));
  const source = manifest.sources[0];
  assert.equal(source.sha256, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, source.path))).digest('hex'));
  assert.equal(source.publicationAuthorized, false); assert.equal(source.acquiredExternally, false);
  assert.equal(manifest.counts.menuItems, demo.demoPlaces.reduce((n, place) => n + place.menus.length, 0));
  assert.equal(manifest.counts.branches, demo.demoPlaces.length); assert.equal(manifest.counts.rejectedDuplicates, 0);
  assert.equal(manifest.counts.approvedFacts, 0); assert.equal(manifest.counts.routes, 0);
});
