/* Host bridge contract regression. Does not establish Android rendering success. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'apps/mobile/node_modules/typescript'));
const library = path.join(root, 'apps/mobile/node_modules/@maplibre/maplibre-react-native');
const factory = fs.readFileSync(path.join(library, 'android/src/main/java/org/maplibre/reactnative/components/layer/style/MLRNStyleFactory.kt'), 'utf8');
const getters = new Map([...factory.matchAll(/fun set(\w+)\([\s\S]*?\n    \}/g)].map(match => [
  match[1][0].toLowerCase() + match[1].slice(1),
  match[0].match(/styleValue\.(getFloatArray|getStringArray|getFloat|getDouble|getInt|getBoolean|getString)\(VALUE_KEY\)/)?.[1],
]));
// Load the installed serialization code; only React Native platform/color helpers are mocked.
const cache = new Map();
function loadUtility(name) {
  if (cache.has(name)) return cache.get(name);
  if (name === './index') return { isAndroid: () => true, isBoolean: v => typeof v === 'boolean', isNumber: v => typeof v === 'number', isString: v => typeof v === 'string' };
  const module = { exports: {} };
  cache.set(name, module.exports);
  const source = fs.readFileSync(path.join(library, 'src/utils', name + '.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports, require: dependency => dependency === 'react-native'
    ? { processColor: () => 0, Image: { resolveAssetSource: () => { throw Error('Unexpected image asset'); } } }
    : loadUtility(dependency) }, { filename: name });
  return module.exports;
}
const { mergeStyleProps } = loadUtility('./convertStyleSpec');
const { transformStyle } = loadUtility('./StyleValue');
function assertNativeTypes(style) {
  for (const [property, { styletype, stylevalue: payload }] of Object.entries(transformStyle(style) ?? {})) {
    // Kotlin also turns sprite names into literal image expressions in its constructor.
    if (styletype === 'image' && payload.type === 'string') continue;
    // Kotlin recognizes arrays beginning with typed strings as expressions.
    if (payload.type === 'array' && payload.value[0]?.type === 'string') continue;
    const getter = getters.get(property);
    const expected = { getFloatArray: 'array', getStringArray: 'array', getFloat: 'number', getDouble: 'number', getInt: 'number', getBoolean: 'boolean', getString: 'string' }[getter];
    assert.ok(expected, `No reviewed Android getter for ${property}`);
    assert.equal(payload.type, expected, `${property}: ${getter} cannot read ${payload.type}`);
    if (expected === 'array') assert.ok(payload.value.every(item => item.type === (getter === 'getFloatArray' ? 'number' : 'string')), property);
  }
}
test('installed Android icon padding getter rejects scalar; one-element array is compatible', () => {
  assert.equal(getters.get('iconPadding'), 'getFloatArray');
  assert.throws(() => assertNativeTypes(mergeStyleProps(undefined, { 'icon-padding': 8 })), /iconPadding.*cannot read number/);
  assert.doesNotThrow(() => assertNativeTypes(mergeStyleProps(undefined, { 'icon-padding': [8] })));
  assert.equal(getters.get('textPadding'), 'getFloat');
  assert.doesNotThrow(() => assertNativeTypes(mergeStyleProps(undefined, { 'text-padding': 8 })));
});
function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? sourceFiles(path.join(directory, entry.name)) : entry.name.endsWith('.tsx') ? [path.join(directory, entry.name)] : []);
}
test('every dynamic JSX Layer serializes values compatible with installed Android setters', () => {
  let layers = 0;
  for (const file of sourceFiles(path.join(root, 'apps/mobile/src'))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(source) === 'Layer') {
        layers++;
        const props = {};
        for (const attribute of node.attributes.properties) {
          assert.ok(ts.isJsxAttribute(attribute), 'Layer spreads need explicit compatibility coverage');
          const name = attribute.name.getText(source);
          if (!['layout', 'paint', 'style'].includes(name)) continue;
          assert.ok(ts.isJsxExpression(attribute.initializer) && ts.isObjectLiteralExpression(attribute.initializer.expression), `${file}: ${name} needs explicit compatibility coverage`);
          props[name] = vm.runInNewContext('(' + attribute.initializer.expression.getText(source) + ')', { origin: { confirmed: true } });
        }
        assertNativeTypes(mergeStyleProps(props.paint, props.layout, props.style));
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.ok(layers > 0, 'No JSX layers inspected');
});
