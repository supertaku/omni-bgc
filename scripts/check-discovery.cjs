const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (name) => name.startsWith('.') && fs.existsSync(path.resolve(path.dirname(filename), name) + '.ts')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name) + '.ts'))
    : original(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}

const { planDeterministicRequest } = load('src/ai/deterministicIntent.ts');
const { directoryCategory, oneEditAway, lexicalSearchQueries } = load('src/data/lexical.ts');
const place = {
  id: '00000000-0000-4000-8000-000000000001', name: 'Café Luna', category: 'cafe',
  coordinate: [121.05, 14.55], aliases: ['Luna Coffee'], entrances: [], citations: [], status: 'approved', menus: [],
};
assert.deepEqual(planDeterministicRequest('are there any coffee shops', [place]), { kind: 'places', query: 'coffee' });
assert.equal(planDeterministicRequest('sort ramen by price', [place]).priceSort, 'asc');
assert.equal(planDeterministicRequest('ramen high to low', [place]).priceSort, 'desc');
assert.equal(directoryCategory('cafés'), 'coffee');
assert.equal(directoryCategory('coffee shops'), 'coffee');
assert.equal(directoryCategory('coffee shop'), 'coffee');
assert.equal(directoryCategory('coffee shops uptown'), undefined, 'category recognition preserves unknown qualifiers');
assert.deepEqual(planDeterministicRequest('find coffee shops in BGC', [place]), { kind: 'places', query: 'coffee' });
assert.equal(planDeterministicRequest('coffee menu', [place]).kind, 'menus');
assert.equal(planDeterministicRequest('coffee under PHP 150', [place]).kind, 'menus');
assert.ok(lexicalSearchQueries('coffee').includes('cafe'));
assert.ok(lexicalSearchQueries('kape').includes('cafe'));
assert.equal(planDeterministicRequest('find Luna Coffee', [place]).placeId, place.id,
  'complete alias matching happens before filler removal');
const namedDish = planDeterministicRequest('find ramen at Luna Coffee', [place]);
assert.equal(namedDish.kind, 'menus');
assert.equal(namedDish.placeId, place.id);
assert.equal(namedDish.query, 'ramen', 'resolving a branch name preserves the requested dish');
const suggestion = planDeterministicRequest('find lunaa coffee', [place]);
assert.equal(suggestion.kind, 'suggestion');
assert.equal(suggestion.placeId, place.id, 'single one-edit candidate is a suggestion, never a focus action');
assert.equal(oneEditAway('luna', 'lunaa'), true);
assert.equal(oneEditAway('luna', 'luneaa'), false);
assert.equal(planDeterministicRequest('nearby coffee shops', [place]).kind, 'places',
  'proximity search stays deterministic and lets the host ask for origin');

// Exercise the actual research adapter and directory fallback with retained source records.
const { foodPlaces, foodResearch } = load('src/features/food/directory.ts');
const { createFoodResearchAnswer } = load('src/features/food/assistant.ts');
const { answerDirectoryQuery, placeMatchesCategory } = load('src/features/assistant/directory.ts');
const researchAnswer = createFoodResearchAnswer(foodResearch);
for (const query of [
  'Find a coffee place and show its details',
  'Find a coffee place in Uptown and tell me about it',
  'Recommend a quiet coffee place with outdoor seating',
  'Find coffee nonexistentqualifier and show details',
]) {
  assert.equal(researchAnswer(query, foodPlaces), null,
    `${query} must reach the shared planner/model instead of an implicit coffee menu lookup`);
}
const expectedCoffeeIds = new Set(foodPlaces.filter((record) => placeMatchesCategory(record, 'coffee')).map((record) => record.id));
assert.ok(expectedCoffeeIds.size > 0, 'retained directory includes coffee category places');
for (const query of ['find coffee shops in BGC', 'coffee', 'cafes', 'cafés', 'coffee shops']) {
  const answer = answerDirectoryQuery(query, foodPlaces, undefined, researchAnswer);
  const results = answer.find((payload) => payload.kind === 'places');
  assert.ok(results?.placeIds.length, `${query} must produce selectable places while model is unavailable`);
  assert.deepEqual(results.placeIds, [...expectedCoffeeIds].slice(0, 12), `${query} preserves exact recorded coffee place identities`);
  assert.equal(results.total, expectedCoffeeIds.size, `${query} includes all matching recorded places`);
  assert.ok(!answer.some((payload) => payload.kind === 'food-menus'), `${query} must not turn into a drink menu search`);
}
const qualified = answerDirectoryQuery('find coffee shops nonexistentqualifier', foodPlaces, undefined, researchAnswer);
assert.ok(!qualified.some((payload) => payload.kind === 'places'), 'unknown qualifiers cannot silently broaden discovery');
for (const query of ['coffee menu', 'coffee under PHP 150', 'coffee and bread', 'coffee and ramen']) {
  assert.ok(researchAnswer(query, foodPlaces)?.some((payload) => payload.kind === 'food-menus' ||
    (payload.kind === 'text' && /menu items/i.test(payload.text))), `${query} retains explicit menu/price intent`);
}
assert.equal(researchAnswer('find coffee shops in BGC verified sources only', foodPlaces), null,
  'research exclusion still prevents candidate answers');

const { getOfficeLocationReference, THINKING_MACHINES_CANDIDATE_ID } = load('src/features/offices/service.ts');
const reference = getOfficeLocationReference(THINKING_MACHINES_CANDIDATE_ID);
assert.equal(reference.name, 'Thinking Machines Data Science, Inc.');
assert.equal(reference.citations[0].status, 'candidate');
assert.equal(reference.citations[1].factId, 'way/222123034');
assert.deepEqual(reference.coordinate, [121.04793834926411, 14.5471164]);
assert.match(reference.notice, /occupancy.*unverified/i);
assert.equal(getOfficeLocationReference('unrelated'), null);
const { officeMapPlaces } = load('src/features/offices/map.ts');
const { pilotScope } = load('src/map/scope.ts');
assert.ok(!officeMapPlaces([place], pilotScope).some((candidate) => candidate.id === reference.candidateId),
  'an office candidate is not added to a category-filtered map result');
const candidatePlace = { ...place, id: reference.candidateId, name: reference.name, category: 'office', coordinate: reference.coordinate, status: 'candidate' };
const referenceScope = { ...pilotScope, geometry: { type: 'Polygon', coordinates: [[[121.04, 14.54], [121.06, 14.54], [121.06, 14.56], [121.04, 14.56], [121.04, 14.54]]] } };
assert.ok(officeMapPlaces([place, candidatePlace], referenceScope).some((candidate) => candidate.id === reference.candidateId),
  'the candidate remains available when the filtered input includes it');
console.log('Discovery assertions passed.');
