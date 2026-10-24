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

const { createExpression } = require('@maplibre/maplibre-gl-style-spec');
const palette = createExpression(loaded.exports.illustratedRoofColor, 'layers[0].paint.fill-color');
assert.equal(palette.result, 'success');
for (const family of ['office', 'residential', 'unknown']) {
  const color = palette.value.evaluate({}, { properties: { visual_family: family } });
  const [r, g, b] = color.slice(1).match(/../g).map(hex => parseInt(hex, 16));
  assert.ok(!(g > r && g > b), `${family} building must read as urban material, not park green`);
}
for (const flat of [false, true]) {
  const result = JSON.parse(loaded.exports.renderMapStyle(JSON.stringify(source), flat, false));
  const parks = result.layers.find(layer => layer.id === 'gardens').paint['fill-color'];
  const [r, g, b] = parks.slice(1).match(/../g).map(hex => parseInt(hex, 16));
  assert.ok(g > r && g > b, 'landscaping retains its green identity');
}
console.log('Modern building palette and green landscaping checks passed');

const materialColor = (visual_family, osm_id) => palette.value.evaluate({}, {
  properties: { visual_family, ...(osm_id === undefined ? {} : { osm_id }) },
});
assert.equal(materialColor('glass-office'), materialColor('office'), 'retained glass-office alias uses glass blue');
assert.notEqual(materialColor('midrise-office'), materialColor('unknown'), 'retained midrise-office gets its office material');
assert.equal(materialColor('lowrise-retail'), materialColor('retail'), 'retained retail alias uses warm retail material');
const unknownMaterials = [100, 101, 102, 103].map(id => materialColor('unknown', id));
assert.equal(new Set(unknownMaterials).size, 4, 'unknown identities get four decorative materials');
assert.deepEqual([100, 101, 102, 103].map(id => materialColor('unknown', id)), unknownMaterials,
  'decorative materials are stable across renders');
assert.equal(materialColor('unknown'), materialColor('unknown', 'invalid'), 'missing/invalid IDs have a stable material');
assert.equal(materialColor('unknown', '102'), materialColor('unknown', 102), 'numeric source IDs retain the same material');
console.log('Retained building-family aliases and decorative material variety verified');
const retainedBuildings = require('../assets/generated/gex/building-evidence.json').rows;
assert.ok(retainedBuildings.some(building => building.visual_family === 'glass-office'));
assert.ok(retainedBuildings.some(building => building.visual_family === 'midrise-office'));
assert.ok(retainedBuildings.some(building => building.visual_family === 'lowrise-retail'));
const retainedUnknownColors = new Set(retainedBuildings
  .filter(building => building.visual_family === 'unknown')
  .map(building => materialColor(building.visual_family, building.osm_id)));
assert.equal(retainedUnknownColors.size, 4, 'retained unknown OSM building IDs exercise all decorative materials');

// Inline RN Layer paints must obey the same native zoom-expression constraint as style JSON.
const { createPropertyExpression, latest } = require('@maplibre/maplibre-gl-style-spec');
const canvasFile = path.resolve(__dirname, '../src/map/MapCanvas.tsx');
const canvasTree = ts.createSourceFile(canvasFile, fs.readFileSync(canvasFile, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let checkedLineWidths = 0;
function checkInlineWidth(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(canvasTree) === "'line-width'") {
    const javascript = ts.transpileModule(`const width = ${node.initializer.getText(canvasTree)}; return width;`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const width = Function(javascript)();
    const parsed = createPropertyExpression(width, `layers[${checkedLineWidths}].paint.line-width`, latest.paint_line['line-width']);
    assert.equal(parsed.result, 'success', JSON.stringify(parsed.value.map?.(error => error.message) ?? parsed.value));
    checkedLineWidths += 1;
  }
  ts.forEachChild(node, checkInlineWidth);
}
checkInlineWidth(canvasTree);
assert.ok(checkedLineWidths > 0);
console.log('Inline native line-width expressions verified');
