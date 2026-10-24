const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { createFoodResearchService, displayFoodPrice: policyFoodPrice, displayFoodFloor } = require('../src/features/food/service.ts');
const displayFoodPrice = item => policyFoodPrice(item, false);
const { canonicalPreviewId } = require('../src/preview/directory.ts');
const { restaurantHoursLines } = require('../src/features/food/presentation.ts');
const sourceDocument = require('../assets/generated/food-research/directory.json');
for (const floor of ['GF', 'G/F', 'Groundfloor', 'Lower ground', 'LGF', 'UGF', '2F', '3rdFloor', 'Level 1', 'B1']) {
  assert.equal(displayFoodFloor(floor), floor, `retain whole recognized floor label ${floor}`);
}
for (const floor of ['7th Avenue corner 25th Street', 'W City Center', 'BGC; precise location missing', '2F per directory; other source 3F', 'GF, Unit 130']) {
  assert.equal(displayFoodFloor(floor), null, `never infer a floor from address, unit or uncertainty prose: ${floor}`);
}
const service = createFoodResearchService(sourceDocument, false);
const { foodPlaces } = require('../src/features/food/directory.ts');
for (const floor of ['7th Avenue corner 25th Street', 'W City Center', 'BGC; precise location missing']) {
  const sourceRows = sourceDocument.restaurants.filter(row => row.floor === floor);
  assert.ok(sourceRows.length, 'regression uses actual retained source records');
  for (const sourceRow of sourceRows) {
    const projected = service.getFoodEstablishmentDetails(sourceRow.id);
    assert.equal(projected.floor, null, 'malformed source floor is unknown in service projection');
    assert.equal(foodPlaces.find(place => place.id === canonicalPreviewId(sourceRow.id)).floor, undefined, 'cards and place details cannot label source prose as Floor');
    assert.equal(projected.locationOriginal, sourceRow.locationOriginal, 'retain original location evidence');
    assert.equal(sourceRow.floor, floor, 'never mutate retained raw source field');
  }
}
const validFloorRow = sourceDocument.restaurants.find(row => row.floor === '3F');
assert.ok(validFloorRow);
assert.equal(service.getFoodEstablishmentDetails(validFloorRow.id).floor, '3F');
const bonchon = service.restaurants.find(row => /bonchon/i.test(row.name));
assert.ok(bonchon && bonchon.items.length);
assert.ok(bonchon.items.every(item => displayFoodPrice(item) === null), 'BonChon estimates never display as published prices');
assert.equal(service.searchFoodMenuItems({ restaurantId: bonchon.id, maxPhp: '1000' }).total, 0, 'estimates cannot satisfy numeric budgets');
assert.deepEqual(restaurantHoursLines(bonchon.hours), ['Hours not available.']);
const item = { ...bonchon.items[0], priceEvidence: 'published-menu', branch: 'Recorded branch', menuSourceUrl: 'https://example.org/menu', priceSourceUrl: 'https://example.org/menu', amount: '123.00' };
assert.equal(displayFoodPrice(item), '₱123');
assert.equal(displayFoodPrice({ ...item, branch: null }), null);
assert.equal(displayFoodPrice({ ...item, priceSourceUrl: null }), null);
assert.equal(displayFoodPrice({ ...item, priceEvidence: 'published-starting' }), null);
const hours = { ...bonchon.hours, kind: 'restaurant', text: 'Recorded schedule', sourceUrl: 'https://example.org/hours', weeklySchedule: [1,2,3,4,5].map(day => ({ day, start: '11:00', end: '21:00' })) };
assert.deepEqual(restaurantHoursLines(hours), ['Mon–Fri: 11:00 AM–9:00 PM']);
assert.deepEqual(restaurantHoursLines({ ...hours, kind: 'delivery' }), ['Hours not available.']);
assert.deepEqual(restaurantHoursLines({ ...hours, sourceUrl: null }), ['Hours not available.']);
console.log('Food presentation: strict whole-floor labels, preserved location evidence, price/source gates and grouped hours passed.');
