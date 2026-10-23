const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/map/presentation.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const loaded = new Module(file, module);
loaded.filename = file;
loaded.paths = Module._nodeModulePaths(path.dirname(file));
loaded._compile(compiled, file);
const { validateStyleMin } = require('@maplibre/maplibre-gl-style-spec');
const source = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../src/map/expanded-style.json'), 'utf8'),
);
for (const flat of [false, true]) {
  const result = JSON.parse(loaded.exports.renderMapStyle(JSON.stringify(source), flat, false));
  assert.deepEqual(
    validateStyleMin(result).map((error) => error.message),
    [],
    'rendered style conforms to installed SDK style spec',
  );
  assert.deepEqual(result.sources, source.sources, 'presentation preserves all geographic sources');
  assert.equal(result.metadata.omniPresentation, flat ? 'flat-v1' : 'illustrated-v1');
  const roofs = result.layers.find((l) => l.id === 'building-footprints');
  assert.ok(
    Array.isArray(roofs.paint['fill-color']),
    'source archetypes produce distinct illustrated roofs',
  );
  for (const layer of result.layers.filter((l) => l.type === 'fill-extrusion')) {
    assert.equal(
      typeof layer.paint['fill-extrusion-opacity'],
      'number',
      'native opacity stays constant',
    );
    if (flat) assert.equal(layer.layout.visibility, 'none');
  }
}
console.log('Map presentation regression checks passed');
