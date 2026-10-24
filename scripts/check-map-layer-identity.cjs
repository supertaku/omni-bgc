const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
// Execute the installed SDK helper: it removes false children before React assigns keys.
const sdkPath = path.resolve(__dirname, '../node_modules/@maplibre/maplibre-react-native/src/utils/index.ts');
const sdkTree = ts.createSourceFile(sdkPath, fs.readFileSync(sdkPath, 'utf8'), ts.ScriptTarget.Latest, true);
const helper = sdkTree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'cloneReactChildrenWithProps');
const code = ts.transpileModule(helper.getText(sdkTree).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const clone = Function('Children', 'cloneElement', code + ';return cloneReactChildrenWithProps;')(React.Children, React.cloneElement);
const canvasPath = path.resolve(__dirname, '../src/map/MapCanvas.tsx');
const tree = ts.createSourceFile(canvasPath, fs.readFileSync(canvasPath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const sourceLayers = [];
function collect(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'Layer') {
    const id = node.attributes.properties.find(prop => prop.name?.text === 'id')?.initializer?.text;
    const key = node.attributes.properties.find(prop => prop.name?.text === 'key')?.initializer?.text;
    sourceLayers.push(React.createElement('Layer', { id, ...(key ? { key } : {}) }));
  }
  ts.forEachChild(node, collect);
}
collect(tree);
assert.ok(sourceLayers.length > 20);
function changedIdentities(children) {
  const before = new Map(clone(children).map(child => [child.key, child.props.id]));
  return clone(children.map((child, index) => index === 0 ? false : child))
    .filter(child => before.has(child.key) && before.get(child.key) !== child.props.id);
}
const unkeyed = sourceLayers.map(child => React.createElement('Layer', { id: child.props.id }));
assert.ok(changedIdentities(unkeyed).length, 'fixture reproduces SDK compaction reusing a different frozen ID');
assert.deepEqual(changedIdentities(sourceLayers), [], 'conditional SDK children must retain each native layer ID');
console.log('PASS installed SDK conditional-child compaction preserves native layer identity');
