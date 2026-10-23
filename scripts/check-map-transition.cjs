const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const path = require('node:path');
const file = path.resolve(__dirname, '../src/map/style-transition.ts');
const loaded = new Module(file, module);
loaded._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  file,
);
const gate = loaded.exports.createStyleTransition();
assert.equal(gate.begin('a'), true);
assert.equal(gate.begin('b'), false, 'do not replace a style still loading');
assert.equal(gate.rendered(), false, 'a render before style loaded is stale');
gate.loaded();
assert.equal(gate.rendered(), true);
assert.equal(gate.begin('c'), true, 'latest requested style can start after full render');
assert.equal(gate.begin('b'), false);
gate.loaded();
assert.equal(gate.rendered(), true);
assert.equal(gate.begin('c'), false, 'same style cannot reenter loading');
console.log('Map lifecycle gate regression checks passed');

// Execute the actual camera-effect bodies with a failed requested mode and a restored mode.
const canvasFile = path.resolve(__dirname, '../src/map/MapCanvas.tsx');
const canvasText = fs.readFileSync(canvasFile, 'utf8');
const canvasTree = ts.createSourceFile(canvasFile, canvasText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const cameraEffects = [];
function findCameraEffects(node) {
  if (ts.isCallExpression(node) && node.expression.getText(canvasTree) === 'useEffect') {
    const callback = node.arguments[0];
    if (callback && /defaultScopeView\(activeScope|cameraResetKey >/.test(callback.getText(canvasTree)))
      cameraEffects.push(callback.getText(canvasTree));
  }
  ts.forEachChild(node, findCameraEffects);
}
findCameraEffects(canvasTree);
assert.equal(cameraEffects.length, 2);
for (const [appliedFlat, appliedQuiet] of [[true, false], [false, true], [false, false]]) {
  for (const callback of cameraEffects) {
    let cameraOptions;
    const bindings = {
      cameraReady: true, flat: !appliedFlat, quiet: false, appliedFlat, appliedQuiet,
      pendingScopeView: { current: true }, activeScope: { defaultView: { center: [121.05, 14.55], zoom: 16 } },
      defaultScopeView: (_scope, isFlat) => { assert.equal(isFlat, appliedFlat || appliedQuiet); return {}; },
      fittedBounds: null, focusCoordinate: null, center: { current: [121.05, 14.55] },
      camera: { current: { easeTo: options => { cameraOptions = options; } } },
      padding: {}, duration: 0, cameraResetKey: 1, lastResetKey: { current: 0 },
    };
    const javascript = ts.transpileModule(`const callback = ${callback}; callback();`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    Function(...Object.keys(bindings), javascript)(...Object.values(bindings));
    assert.equal(cameraOptions.pitch, appliedFlat || appliedQuiet ? 0 : 38,
      'restored style camera follows applied mode, even when requested mode failed');
  }
}
console.log('Recovered map camera mode regression checks passed');
