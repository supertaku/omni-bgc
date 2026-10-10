/* Optional local integration input: not redistributed and not required by portable tests. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(__dirname, '../../../..');
const ts = require(path.join(root, 'apps/mobile/node_modules/typescript'));
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, filename);
const engine = require(path.join(root, 'packages/routing/index.ts'));
const input = path.join(root, 'data/generated/m3/run-a/candidate-graph.json');
test('historical M3 candidate graph cannot install or navigate', {
  skip: fs.existsSync(input) ? false : 'NOT RUN: local historical data/generated/m3/run-a/candidate-graph.json unavailable',
}, async () => {
  engine.clearGraph();
  const graph = JSON.parse(fs.readFileSync(input, 'utf8'));
  assert.equal(engine.installGraph(graph).installed, false);
  assert.equal((await engine.route(
    { coordinate: [121.0502, 14.55], method: 'manual', confirmed: true },
    { id: 'SYNTHETIC-TEST-ONLY', label: 'TEST ONLY entrance', coordinate: [121.0508, 14.55005], eligible: true },
  )).available, false);
});
