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
