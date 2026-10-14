const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx?$/.test(file)) files.push(file);
  }
}
walk(path.join(root, 'apps/mobile/src'));
for (const name of ['domain', 'geo', 'routing']) walk(path.join(root, 'packages', name));
files.push(path.join(root, 'apps/mobile/App.tsx'));
const known = new Set(files);
const relative = (file) => path.relative(root, file).replaceAll('\\', '/');
const graph = new Map();
for (const file of files) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const edges = [];
  for (const statement of source.statements) {
    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), specifier.text);
    const target = [base + '.ts', base + '.tsx', path.join(base, 'index.ts')].find((candidate) =>
      known.has(candidate),
    );
    if (target) edges.push(target);
  }
  graph.set(file, edges);
}
// Tarjan strongly connected components includes import and re-export edges,
// including type-only imports: conservative architectural inventory, not a bundler.
let sequence = 0;
const indices = new Map(),
  low = new Map(),
  stack = [],
  active = new Set(),
  cycles = [];
function visit(file) {
  indices.set(file, sequence);
  low.set(file, sequence++);
  stack.push(file);
  active.add(file);
  for (const target of graph.get(file)) {
    if (!indices.has(target)) {
      visit(target);
      low.set(file, Math.min(low.get(file), low.get(target)));
    } else if (active.has(target)) low.set(file, Math.min(low.get(file), indices.get(target)));
  }
  if (low.get(file) !== indices.get(file)) return;
  const component = [];
  let item;
  do {
    item = stack.pop();
    active.delete(item);
    component.push(item);
  } while (item !== file);
  if (component.length > 1 || graph.get(file).includes(file))
    cycles.push(component.map(relative).sort());
}
for (const file of files) if (!indices.has(file)) visit(file);
console.log(
  JSON.stringify(
    {
      modules: files.length,
      edges: [...graph.values()].reduce((n, values) => n + values.length, 0),
      cycles,
      imports: Object.fromEntries(
        [...graph].map(([file, targets]) => [relative(file), targets.map(relative)]),
      ),
    },
    null,
    2,
  ),
);
if (process.argv.includes('--check') && cycles.length) process.exitCode = 1;
