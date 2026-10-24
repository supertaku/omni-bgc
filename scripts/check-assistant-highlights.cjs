const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const file = require('node:path').resolve(
  __dirname,
  '../src/features/assistant/inlineHighlights.ts',
);
const mod = new Module(file, module);
mod._compile(
  ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  file,
);
const { highlightSegments } = mod.exports;
const text = 'Find coffee shops near St. Luke’s (BGC). Coffeehouse costs ₱400?';
const segments = highlightSegments(text, ['St. Luke’s (BGC)']);
assert.equal(segments.map((segment) => segment.text).join(''), text);
assert.ok(
  segments.some((segment) => segment.kind === 'place' && segment.text === 'St. Luke’s (BGC)'),
);
assert.ok(
  segments.some((segment) => segment.kind === 'category' && segment.text === 'coffee shops'),
);
assert.ok(!segments.some((segment) => segment.kind && segment.text.includes('Coffeehouse')));
assert.ok(
  !segments.some((segment) => segment.kind && segment.text.includes('₱400')),
  'free text prices receive no factual emphasis',
);
const long = 'coffee '.repeat(3000);
const bounded = highlightSegments(long, []);
assert.equal(
  bounded.map((segment) => segment.text).join(''),
  long,
  'bounded styling preserves all text',
);
assert.ok(bounded.length <= 257, 'highlighting has a bounded number of spans');
assert.equal(
  highlightSegments('<b>coffee</b>', [])
    .map((segment) => segment.text)
    .join(''),
  '<b>coffee</b>',
  'HTML remains literal',
);
console.log(
  'PASS assistant inline accents preserve content, exact names, word boundaries and bounded rendering',
);
