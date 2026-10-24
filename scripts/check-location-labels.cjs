const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { locationPrecisionLabel } = require('../src/features/assistant/detailPresentation.ts');
const { previewPlaces } = require('../src/preview/directory.ts');
assert.equal(locationPrecisionLabel(undefined), null, 'missing historical geometry is not reclassified');
assert.equal(locationPrecisionLabel({ coordinate: null }), 'Map location unavailable');
assert.equal(locationPrecisionLabel({ coordinate: [121, 14], locationKind: 'recorded-point' }), null);
const anchor = previewPlaces.find(p => p.locationKind === 'building-anchor');
assert.ok(anchor);
assert.equal(locationPrecisionLabel(anchor), 'Approximate building location; not an entrance');
assert.equal(anchor.status, 'candidate', 'location precision does not confer approval');
console.log('Location labels preserve recorded points and distinguish approximate/unresolved locations.');
