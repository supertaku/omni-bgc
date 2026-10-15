// Execute authored TS with explicit external mocks. Unknown native imports fail.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../../apps/mobile/node_modules/typescript');
const root = path.resolve(__dirname, '../..');

function loadTs(relative, mocks = {}, globals = {}, cache = new Map()) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file);
  const context = { exports: {}, console, Date, Map, Set, Promise, AbortController, setTimeout, clearTimeout, ...globals, require(name) {
    if (name in mocks) return mocks[name];
    if (!name.startsWith('.')) throw Error(`Missing explicit mock for ${name} in ${relative}`);
    const target = path.resolve(path.dirname(file), name);
    if (target.endsWith('.json') && fs.existsSync(target)) return JSON.parse(fs.readFileSync(target, 'utf8'));
    const found = [target + '.ts', target + '.tsx', path.join(target, 'index.ts')].find(fs.existsSync);
    if (!found) throw Error(`Unresolved import ${name} in ${relative}`);
    return loadTs(path.relative(root, found), mocks, globals, cache);
  } };
  cache.set(file, context.exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, context, { filename: file });
  return context.exports;
}
module.exports = { loadTs };
