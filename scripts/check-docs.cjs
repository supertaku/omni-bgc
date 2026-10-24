const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const app = JSON.parse(read('app.json')).expo;
const catalog = { exports: {} };
new Function('exports', ts.transpileModule(read('src/ai/modelCatalog.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(catalog.exports);
const overlay = JSON.parse(read('assets/generated/preview/overlay.json'));
const food = JSON.parse(read('assets/generated/preview/food.json'));
const expected = {
  'Application version': app.version,
  'Android package': app.android.package,
  'Android versionCode': String(app.android.versionCode),
  'Canonical preview places': String(overlay.places.length),
  'Restaurants/cafés with menus': String(food.restaurants.length),
  'Preview menu items': String(food.restaurants.reduce((n, r) => n + r.items.length, 0)),
  'Internally generated menu items': String(overlay.coverage.generatedMenuItems),
  'Recorded place points': String(overlay.coverage.recordedPoints),
  'Derived building anchors': String(overlay.coverage.buildingAnchors),
  'Unresolved preview identities': String(overlay.coverage.unlocated),
};
function validate(text) {
  const rows = new Map(text.split(/\r?\n/).filter(line => line.startsWith('|'))
    .map(line => line.split('|').slice(1, -1).map(cell => cell.replace(/[`*,]/g, '').trim()))
    .map(cells => [cells[0], cells[1]]));
  const errors = Object.entries(expected).filter(([key, value]) => rows.get(key) !== value)
    .map(([key, value]) => `${key}: expected ${value}, got ${rows.get(key) ?? 'missing'}`);
  for (const model of catalog.exports.MODEL_CATALOG)
    if (rows.get(model.displayName) !== String(model.bytes)) errors.push(`${model.displayName}: catalog byte size drift`);
  if (/Selected Model: Gemma|Gemma 4 E2B\s*\|\s*Selected local/i.test(text)) errors.push('Withdrawn model described as current');
  for (const file of ['.github/workflows/host-checks.yml', '.github/workflows/android-release.yml'])
    if (!fs.existsSync(path.join(root, file))) errors.push(`Missing documented workflow: ${file}`);
  return errors;
}
if (process.argv.includes('--self-test')) {
  const fixture = Object.entries(expected).concat(catalog.exports.MODEL_CATALOG.map(m => [m.displayName, String(m.bytes)]))
    .map(([key, value]) => `| ${key} | ${value} |`).join('\n');
  // Workflow existence is checked by the real run, independent of prose fixtures.
  const contentErrors = text => validate(text).filter(error => !error.startsWith('Missing documented workflow:'));
  assert.deepEqual(contentErrors(fixture), []);
  assert.ok(contentErrors(fixture.replace(app.version, '0.0.1')).some(e => e.startsWith('Application version:')));
  assert.ok(contentErrors(fixture.replace('Preview menu items', 'Missing count')).some(e => e.startsWith('Preview menu items:')));
  assert.ok(contentErrors(fixture.replace(String(catalog.exports.MODEL_CATALOG[0].bytes), '1')).some(e => e.includes('catalog byte size drift')));
  assert.ok(contentErrors(`${fixture}\n### Selected Model: Gemma`).includes('Withdrawn model described as current'));
  console.log('Documentation drift regression: version, counts and model catalog mutations rejected.');
} else {
  const errors = validate(read('README.md'));
  assert.deepEqual(errors, [], errors.join('\n'));
  console.log('README references match app identity, model catalog, generated preview and workflows.');
}
