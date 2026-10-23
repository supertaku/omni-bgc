const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');

const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = mod.require.bind(mod);
  mod.require = (name) => {
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), name);
      if (fs.existsSync(target + '.ts'))
        return load(path.relative(path.resolve(__dirname, '..'), target + '.ts'));
    }
    return original(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}

const { confirmedOrigin } = load('src/ai/confirmedOrigin.ts');
const manual = { coordinate: [121.05, 14.55], method: 'manual', confirmed: true };
const gps = { coordinate: [121.05, 14.55], method: 'gps', confirmed: true, accuracyM: 8 };
assert.equal(confirmedOrigin(manual), manual, 'confirmed map origin may reach local sorting');
assert.equal(confirmedOrigin(gps), gps, 'confirmed foreground location may reach local sorting');
assert.equal(confirmedOrigin({ ...manual, confirmed: false }), null, 'unconfirmed candidate is never passed as origin');
assert.equal(confirmedOrigin({ ...manual, coordinate: [181, 14.55] }), null, 'invalid coordinate is never passed as origin');

const hook = fs.readFileSync(path.resolve(__dirname, '../src/features/assistant/useAssistantConversation.ts'), 'utf8');
assert.match(hook, /\},\s*current\.current\.origin\);/, 'the origin current at send time reaches the runtime call');
const screen = fs.readFileSync(path.resolve(__dirname, '../src/features/assistant/AssistantScreen.tsx'), 'utf8');
assert.doesNotMatch(screen, /onUseLocation|onChooseOrigin|Set origin|Use my location/, 'Assistant has no positioning controls');
const application = fs.readFileSync(path.resolve(__dirname, '../src/app/Application.tsx'), 'utf8');
assert.match(application, /requestForegroundPermissionsAsync/, 'positioning remains foreground and explicit on the map');
assert.match(application, /onLocate=\{\(\) => setLocationControls\(true\)\}/, 'map owns the position dialog');

(async () => {
  const { runHybridTurn } = load('src/ai/hybridAssistant.ts');
  const near = { id: 'near', name: 'Near Coffee', category: 'coffee', coordinate: [121.051, 14.55], status: 'approved', aliases: [], entrances: [], citations: [], menus: [] };
  const far = { ...near, id: 'far', name: 'Far Coffee', coordinate: [121.08, 14.55] };
  const byId = new Map([[near.id, near], [far.id, far]]);
  const retrieval = {
    findPlaces: async (filters) => ({ status: 'ok', authority: 'approved', data: [far, near], sourceRecordIds: ['far', 'near'], citations: [], appliedFilters: filters, warnings: [], sourceFingerprint: 'fixture' }),
    getPlaceDetails: async (id) => ({ data: byId.get(id) ?? null }),
  };
  const executor = {
    retrieval,
    execute: async (raw, callId) => ({ callId, name: raw.name, status: 'ok', authority: 'approved', data: [far, near], sourceRecordIds: ['far', 'near'], citations: [], appliedFilters: raw.arguments, warnings: [], sourceFingerprint: 'fixture' }),
  };
  let agentCalls = 0;
  const deps = { executor, canInfer: () => true, answerDirectory: () => [], agent: { run: async () => { agentCalls++; throw new Error('origin must not reach model prompts'); } } };
  const withoutOrigin = await runHybridTurn('nearest coffee', [near, far], deps);
  assert.match(withoutOrigin.payloads[0].text, /flat map’s location control/);
  assert.equal(agentCalls, 0, 'proximity never sends an origin or prompt to the model');
  const sorted = await runHybridTurn('nearest coffee', [near, far], deps, {}, manual);
  assert.deepEqual(sorted.payloads.find((entry) => entry.kind === 'places').placeIds, ['near', 'far']);
  assert.equal(agentCalls, 0, 'confirmed origin is used only by the deterministic path');
  const { answerDirectoryQuery } = load('src/features/assistant/directory.ts');
  const candidateNear = { ...near, status: 'candidate' };
  const candidateFar = { ...far, status: 'candidate' };
  const emptyExecutor = { ...executor, retrieval: {
    ...retrieval, findPlaces: async () => ({ status: 'empty', authority: 'approved', data: [], sourceRecordIds: [], citations: [], warnings: [] }),
  }, execute: async raw => ({ name: raw.name, status: 'empty', authority: 'approved', data: [], sourceRecordIds: [], citations: [], warnings: [] }) };
  const candidateDeps = { ...deps, executor: emptyExecutor, answerDirectory: answerDirectoryQuery };
  const candidatesSorted = await runHybridTurn('nearest coffee', [candidateFar, candidateNear], candidateDeps, {}, manual);
  assert.deepEqual(candidatesSorted.payloads.find(p => p.kind === 'places' && p.placeIds.length)?.placeIds, ['near', 'far'], 'recorded candidates sort before truncation and are not overwritten by fallback');
  const excluded = await runHybridTurn('find coffee without candidates', [candidateNear], candidateDeps, {}, manual);
  assert.ok(!excluded.payloads.some(p => p.kind === 'places' && p.placeIds.includes('near')), 'shared source-exclusion policy applies to candidate discovery');
  console.log('PASS confirmed origin validation, send-time wiring, proximity gate and deterministic sorting');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
