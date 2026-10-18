const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const repository = path.resolve(__dirname, '../../..');
const slash = (file) => file.replaceAll('\\', '/');
// Existing adapter seams are explicit, narrow and reviewed in docs/quality/README.md.
const adapterSeams = new Set([
  'apps/mobile/src/data/store.ts -> apps/mobile/src/features/offices/service.ts',
  'apps/mobile/src/ai/retrieval.ts -> apps/mobile/src/features/offices/service.ts',
  'apps/mobile/src/ai/retrieval.ts -> apps/mobile/src/features/food/directory.ts',
]);
function audit(root = repository) {
  const files = [];
  function walk(directory, native = false) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        !(native && ['android', 'ios', 'node_modules', 'build', '.gradle'].includes(entry.name))
      )
        walk(file, native);
      else if (entry.isFile() && /\.tsx?$/.test(file)) files.push(file);
    }
  }
  walk(path.join(root, 'apps/mobile/src'));
  for (const name of ['domain', 'geo', 'routing']) walk(path.join(root, 'packages', name));
  for (const file of ['apps/mobile/App.tsx', 'apps/mobile/index.ts']) {
    if (fs.existsSync(path.join(root, file))) files.push(path.join(root, file));
  }
  const modules = path.join(root, 'apps/mobile/modules');
  walk(modules, true);
  files.sort();
  const known = new Set(files),
    graph = new Map(),
    violations = [],
    exceptions = [],
    unresolvedDynamic = [];
  const relative = (file) => slash(path.relative(root, file));
  function dependency(file, specifier, typeOnly) {
    const from = relative(file);
    const resolved = ts.resolveModuleName(
      specifier,
      file,
      {
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        allowJs: true,
        resolveJsonModule: true,
      },
      ts.sys,
    ).resolvedModule?.resolvedFileName;
    const target = resolved ? path.resolve(resolved) : null;
    const local = target && known.has(target),
      to = local ? relative(target) : specifier;
    if (local) graph.get(file).add(target);
    let reason;
    const pure = /^packages\/(domain|geo|routing)\//;
    if (pure.test(from) && !(local && pure.test(to)))
      reason = 'Pure packages may depend only on pure packages';
    if (
      from.startsWith('apps/mobile/src/domain/') &&
      !(local && (to.startsWith('apps/mobile/src/domain/') || pure.test(to)))
    )
      reason = 'App domain must remain independent of application/native adapters';
    if (
      !typeOnly &&
      from.startsWith('apps/mobile/src/data/') &&
      to.startsWith('apps/mobile/src/features/')
    )
      reason = 'Storage must not acquire feature dependencies';
    if (
      !typeOnly &&
      from.startsWith('apps/mobile/src/ai/') &&
      to.startsWith('apps/mobile/src/features/')
    )
      reason = 'AI must use domain policy/contracts, not feature implementations';
    if (
      !typeOnly &&
      from.startsWith('apps/mobile/modules/') &&
      local &&
      !to.startsWith('apps/mobile/modules/')
    )
      reason = 'Native bridge entrypoints may import app contracts only as types';
    const resource =
      specifier.startsWith('.') &&
      /\.(json|png|jpg|ttf|otf)$/.test(specifier) &&
      fs.existsSync(path.resolve(path.dirname(file), specifier));
    if (!resolved && specifier.startsWith('.') && !resource) reason = 'Unresolved local dependency';
    if (reason) {
      const entry = { from, to, reason };
      if (adapterSeams.has(`${from} -> ${to}`)) exceptions.push(entry);
      else violations.push(entry);
    }
  }
  for (const file of files) {
    graph.set(file, new Set());
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    function visitNode(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const clause = ts.isImportDeclaration(node) ? node.importClause : node;
        const bindings = clause?.namedBindings ?? node.exportClause;
        const allTypes =
          bindings &&
          (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((element) => element.isTypeOnly) &&
          !clause?.name;
        dependency(file, node.moduleSpecifier.text, !!clause?.isTypeOnly || !!allTypes);
      } else if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      ) {
        dependency(file, node.argument.literal.text, true);
      } else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) &&
        ts.isStringLiteral(node.moduleReference.expression)
      ) {
        dependency(file, node.moduleReference.expression.text, node.isTypeOnly);
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      ) {
        if (node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0]))
          dependency(file, node.arguments[0].text, false);
        else
          unresolvedDynamic.push({
            file: relative(file),
            line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          });
      }
      ts.forEachChild(node, visitNode);
    }
    visitNode(source);
  }
  // Tarjan includes type edges conservatively, as the previous checker did.
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
    if (component.length > 1 || graph.get(file).has(file))
      cycles.push(component.map(relative).sort());
  }
  for (const file of files) if (!indices.has(file)) visit(file);
  return {
    modules: files.length,
    edges: [...graph.values()].reduce((n, targets) => n + targets.size, 0),
    cycles,
    violations,
    exceptions,
    unresolvedDynamic,
    imports: Object.fromEntries(
      [...graph].map(([file, targets]) => [relative(file), [...targets].map(relative)]),
    ),
  };
}
if (require.main === module) {
  const result = audit();
  console.log(JSON.stringify(result, null, 2));
  if (
    process.argv.includes('--check') &&
    (result.cycles.length || result.violations.length || result.unresolvedDynamic.length)
  )
    process.exitCode = 1;
}
module.exports = { audit };
