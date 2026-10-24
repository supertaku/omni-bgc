const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const typescript = require('typescript');

const root = path.resolve(__dirname, '..');
const provenance = require('../assets/generated/context/provenance.json');
const contextManifest = require('../assets/generated/context/manifest.json');
const coverage = require('../assets/generated/context/coverage.json');
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

assert.equal(contextManifest.formatVersion, 1);
assert.equal(contextManifest.displayOnly, true);
assert.equal(contextManifest.navigationEligible, false);
assert.deepEqual(contextManifest.bbox, coverage.bounds.flat());
assert.equal(contextManifest.coverageSha256, coverage.sha256);
assert.equal(provenance.coverageSha256, coverage.sha256);
assert.equal(coverage.buffer.metres, 100);
assert.equal(coverage.extension.additionalMetres, 150);
assert.equal(coverage.extension.totalUnprotectedMetres, 250);
assert.equal(coverage.buffer.crs, 'EPSG:32651');
assert.equal(contextManifest.minzoom, 14);
assert.equal(contextManifest.maxzoom, 18);
assert.deepEqual(provenance.bbox, contextManifest.bbox);
assert.equal(provenance.navigationEligible, false);
assert.equal(provenance.placeFactsEligible, false);
assert.equal(provenance.detailedArchiveSha256, sha(path.join(root, 'assets/generated/gex/gex.pmtiles')));
assert.deepEqual(Object.keys(provenance.featureCounts).sort(), ['building', 'green', 'landmark', 'road', 'water']);
assert.equal(provenance.featureCounts.landmark, 1, 'retain the single sourced hospital landmark point');
for (const count of Object.values(provenance.featureCounts)) assert.ok(Number.isSafeInteger(count) && count > 0);
assert.deepEqual(Object.keys(provenance.tileCounts).sort(), ['14', '15', '16', '17', '18']);
for (const count of Object.values(provenance.tileCounts)) assert.ok(Number.isSafeInteger(count) && count > 0);
assert.equal(provenance.sourceFiles.length, 22);
assert.equal(provenance.sourceInventorySha256, sha(path.join(root, 'assets/generated/context/source-inventory.json')));
assert.deepEqual(provenance.sourceFiles, require('../assets/generated/context/source-inventory.json').sourceFiles);
for (const source of provenance.sourceFiles) {
  const file = path.join(root, 'assets/generated/context/source', source.path);
  assert.equal(fs.statSync(file).size, source.bytes);
  assert.equal(sha(file), source.sha256);
}
assert.equal(contextManifest.files.length, 1);
const archive = contextManifest.files[0];
assert.equal(archive.path, 'context.pmtiles');
const archivePath = path.join(root, 'assets/generated/context', archive.path);
assert.equal(fs.statSync(archivePath).size, archive.bytes);
assert.equal(sha(archivePath), archive.sha256);
assert.equal(provenance.output.path, 'assets/generated/context/features.geojson.gz');
const auditPath = path.join(root, provenance.output.path);
assert.equal(fs.statSync(auditPath).size, provenance.output.bytes);
assert.equal(sha(auditPath), provenance.output.sha256);
for (const [directory, inventoryName, styleName] of [
  ['gex', 'expanded-resources.json', 'expanded-style.json'],
  ['omni', 'bundled-resources.json', 'pilot-style.json'],
]) {
  const inventory = require(path.join(root, 'src/map', inventoryName));
  const assetRoot = path.join(root, 'assets/generated', directory);
  assert.equal(sha(path.join(assetRoot, 'manifest.json')), inventory.packSha256);
  assert.equal(sha(path.join(assetRoot, 'style.json')), inventory.styleSha256);
  assert.deepEqual(
    fs.readFileSync(path.join(assetRoot, 'style.json')),
    fs.readFileSync(path.join(root, 'src/map', styleName)),
  );
}
const presentationPath = path.join(root, 'src/map/presentation.ts');
const compiled = typescript.transpileModule(fs.readFileSync(presentationPath, 'utf8'), {
  compilerOptions: { module: typescript.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const presentation = new Module(presentationPath, module);
presentation.filename = presentationPath;
presentation.paths = Module._nodeModulePaths(path.dirname(presentationPath));
presentation._compile(compiled, presentationPath);
const original = require('../src/map/expanded-style.json');
const rendered = JSON.parse(
  presentation.exports.renderMapStyle(JSON.stringify(original), false, false),
);
assert.deepEqual(rendered.sources, original.sources);
const byId = (style, id) => style.layers.find((layer) => layer.id === id);
const facadeManifest = require('../assets/map-facades/manifest.json');
assert.equal(facadeManifest.generatorSha256, sha(path.join(root, facadeManifest.source)));
assert.equal(facadeManifest.images.length, 10);
const mapCanvas = fs.readFileSync(path.join(root, 'src/map/MapCanvas.tsx'), 'utf8');
// Layer layout props cross the RN bridge, unlike checksum-bound style JSON.
// MapLibre RN 11.5 Android setIconPadding calls getFloatArray, never getFloat.
const bridgePath = path.join(root, 'node_modules/@maplibre/maplibre-react-native/src/utils/BridgeValue.ts');
const bridge = new Module(bridgePath, module);
bridge.filename = bridgePath;
bridge.require = name => {
  assert.equal(name, './index');
  return { isNumber: v => typeof v === 'number', isString: v => typeof v === 'string', isBoolean: v => typeof v === 'boolean' };
};
bridge._compile(typescript.transpileModule(fs.readFileSync(bridgePath, 'utf8'), {
  compilerOptions: { module: typescript.ModuleKind.CommonJS },
}).outputText, bridgePath);
const canvasTree = typescript.createSourceFile('MapCanvas.tsx', mapCanvas, typescript.ScriptTarget.Latest, true, typescript.ScriptKind.TSX);
function checkPadding(node) {
  if (typescript.isPropertyAssignment(node) && node.name.getText(canvasTree) === "'icon-padding'") {
    const raw = Function(`return (${node.initializer.getText(canvasTree)});`)();
    const payload = new bridge.exports.BridgeValue(raw).toJSON();
    assert.equal(payload.type, 'array', 'RN Android icon-padding must reach getFloatArray as an array; omit the optional override to use native defaults');
    assert(Array.isArray(payload.value));
  }
  typescript.forEachChild(node, checkPadding);
}
checkPadding(canvasTree);
for (const image of facadeManifest.images) {
  const asset = path.join(root, 'assets/map-facades', image.path);
  const png = fs.readFileSync(asset);
  assert.equal(png.readUInt32BE(16), 128, 'MapLibre pattern width must be a power of two');
  assert.equal(png.readUInt32BE(20), 128, 'MapLibre pattern height must be a power of two');
  assert.equal(fs.statSync(asset).size, image.bytes);
  assert.equal(sha(asset), image.sha256);
}
assert.equal(byId(rendered, 'buildings-2.5D').minzoom, 14);
assert.equal(byId(rendered, 'buildings-2.5D').maxzoom, undefined);
assert.equal(byId(rendered, 'buildings-2.5D').paint['fill-extrusion-height'][1], 'visual_height');
assert.equal(byId(rendered, 'buildings-2.5D').paint['fill-extrusion-base'][1], 'visual_base');
assert.equal(byId(rendered, 'buildings-2.5D').paint['fill-extrusion-color'][0], 'match');
assert.equal(byId(rendered, 'buildings-facades').minzoom, 18);
assert.equal(byId(rendered, 'building-roof-caps').minzoom, 14);
assert.equal(byId(rendered, 'building-roof-caps').paint['fill-extrusion-opacity'], 1);
assert.equal(byId(rendered, 'source-crosswalks').minzoom, 17);
assert.deepEqual(
  byId(rendered, 'source-crosswalks').filter,
  byId(original, 'source-crosswalks').filter,
);
assert.equal(byId(rendered, 'path-edge').minzoom, 14.5);
const flat = JSON.parse(presentation.exports.renderMapStyle(JSON.stringify(original), true, false));
assert.equal(byId(flat, 'buildings-facades').layout.visibility, 'none');
assert.ok(mapCanvas.includes('clusterRadius={44}'));
assert.ok(mapCanvas.includes('clusterMaxZoom={20}'));
assert.ok(mapCanvas.includes('getClusterExpansionZoom'));
assert.ok(mapCanvas.includes('getClusterLeaves'));
assert.ok(mapCanvas.includes('source-layer="geometry"'));
assert.ok(mapCanvas.includes('loadContextSource()'));
assert.ok(!mapCanvas.includes("from './context.json'"));
const mapChrome = fs.readFileSync(path.join(root, 'src/features/explore/MapChrome.tsx'), 'utf8');
assert.ok(mapChrome.includes('moreTarget'));
assert.ok(!mapChrome.includes("{['All','Food','Coffee','Shops','More']"));
console.log('Map rendering, clustering, hit-target bridge payload and pack receipts verified.');
