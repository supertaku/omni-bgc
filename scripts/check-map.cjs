const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const typescript = require('typescript');

const root = path.resolve(__dirname, '..');
const provenance = require('../assets/generated/context/provenance.json');
const context = require('../src/map/context.json');
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

assert.equal(context.type, 'FeatureCollection');
assert.deepEqual(provenance.bbox, [121.035, 14.53, 121.07, 14.575]);
assert.equal(provenance.navigationEligible, false);
assert.equal(provenance.placeFactsEligible, false);
assert.equal(provenance.sourceFiles.length, 16);
for (const source of provenance.sourceFiles) {
  const file = path.join(root, 'assets/generated/context/source', source.path);
  assert.equal(fs.statSync(file).size, source.bytes);
  assert.equal(sha(file), source.sha256);
}
const output = path.join(root, provenance.output.path);
assert.equal(fs.statSync(output).size, provenance.output.bytes);
assert.equal(sha(output), provenance.output.sha256);
const counts = { building: 0, road: 0, green: 0, water: 0, landmark: 0 };
const core = provenance.coreExclusionBbox;
for (const feature of context.features) {
  const kind = feature.properties.kind;
  assert.ok(Object.hasOwn(counts, kind));
  counts[kind]++;
  if (kind === 'landmark') {
    assert.equal(feature.properties.osmNodeId, 7597467285);
    assert.deepEqual(feature.geometry.coordinates, [121.0482529, 14.554675]);
    continue;
  }
  const lines =
    feature.geometry.type === 'MultiLineString'
      ? feature.geometry.coordinates
      : feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates
        : [feature.geometry.coordinates];
  for (const coords of lines) {
    const xs = coords.map((p) => p[0]);
    const ys = coords.map((p) => p[1]);
    if (kind === 'road') {
      for (let i = 1; i < coords.length; i++) {
        const midpoint = [
          (coords[i - 1][0] + coords[i][0]) / 2,
          (coords[i - 1][1] + coords[i][1]) / 2,
        ];
        assert.ok(
          midpoint[0] <= core[0] ||
            midpoint[0] >= core[2] ||
            midpoint[1] <= core[1] ||
            midpoint[1] >= core[3],
        );
      }
    } else {
      assert.ok(
        Math.max(...xs) < core[0] ||
          Math.min(...xs) > core[2] ||
          Math.max(...ys) < core[1] ||
          Math.min(...ys) > core[3],
      );
    }
  }
}
assert.deepEqual(counts, provenance.featureCounts);
const kalayaan = context.features.find((f) => f.properties.osmWayId === 4940313);
assert.equal(kalayaan.properties.name, 'Kalayaan Avenue');
assert.equal(kalayaan.geometry.type, 'MultiLineString');
assert.equal(kalayaan.geometry.coordinates.length, 2);
assert.equal(kalayaan.geometry.coordinates[0].at(-1)[0], core[2]);
assert.equal(kalayaan.geometry.coordinates[1][0][1], core[3]);
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
assert.equal(byId(rendered, 'buildings-facades').minzoom, 15.5);
assert.equal(byId(rendered, 'buildings-2.5D').maxzoom, byId(rendered, 'buildings-facades').minzoom, 'massing and facade volumes must not overlap at the zoom handoff');
const facadeExpression = byId(rendered, 'buildings-facades').paint['fill-extrusion-pattern'];
assert.equal(facadeExpression[0], 'match');
const textureIds = new Set(
  facadeExpression.filter((value) => typeof value === 'string' && value.startsWith('fort-facade-')),
);
const mappedFamilies = new Set(
  facadeExpression.filter((value) => typeof value === 'string' && value.startsWith('facade-')),
);
const evidence = require('../assets/generated/gex/building-evidence.json');
for (const row of evidence.rows) assert.ok(mappedFamilies.has(row.facade_pattern));
const facadeManifest = require('../assets/map-facades/manifest.json');
assert.equal(facadeManifest.generatorSha256, sha(path.join(root, facadeManifest.source)));
assert.equal(facadeManifest.images.length, 10);
const mapCanvas = fs.readFileSync(path.join(root, 'src/map/MapCanvas.tsx'), 'utf8');
for (const image of facadeManifest.images) {
  const id = `fort-facade-${image.path.slice(0, -4)}`;
  assert.ok(textureIds.has(id));
  assert.ok(mapCanvas.includes(`'${id}': require('../../assets/map-facades/${image.path}')`));
  const asset = path.join(root, 'assets/map-facades', image.path);
  const png = fs.readFileSync(asset);
  assert.equal(png.readUInt32BE(16), 128, 'MapLibre pattern width must be a power of two');
  assert.equal(png.readUInt32BE(20), 128, 'MapLibre pattern height must be a power of two');
  assert.equal(fs.statSync(asset).size, image.bytes);
  assert.equal(sha(asset), image.sha256);
}
assert.ok(mapCanvas.includes('<Images images={facadeImages} />'));
assert.equal(byId(rendered, 'building-roof-caps').minzoom, 15.5);
assert.equal(byId(rendered, 'source-crosswalks').minzoom, 17);
assert.deepEqual(
  byId(rendered, 'source-crosswalks').filter,
  byId(original, 'source-crosswalks').filter,
);
assert.equal(byId(rendered, 'path-edge').minzoom, 14.5);
const flat = JSON.parse(presentation.exports.renderMapStyle(JSON.stringify(original), true, false));
assert.equal(byId(flat, 'buildings-facades').layout.visibility, 'none');
console.log('Offline context source receipts, geometry gap, and counts verified:', counts);
