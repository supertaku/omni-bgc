/* SYNTHETIC TEST ONLY: native file/crypto/verified-update receipt mocked in memory. */
const fs = require('node:fs'); const path = require('node:path'); const Module = require('node:module');
const assert = require('node:assert/strict'); const { test, beforeEach } = require('node:test'); const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'apps/mobile/node_modules/typescript'));
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, filename);
const engine = require(path.join(root, 'apps/mobile/src/routing/engine.ts'));
const contracts = require(path.join(root, 'apps/mobile/src/updates/contracts.ts'));
const bytesHash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let active = null; let bytes = new Uint8Array(); let trusted = []; let exists = true; let recover = async () => active;
const nativeCrypto = { CryptoDigestAlgorithm: { SHA256: 'SHA256' }, digestStringAsync: async (_algorithm, text) => bytesHash(Buffer.from(text)), digest: async (_algorithm, data) => { const digest = crypto.createHash('sha256').update(data).digest(); return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength); } };
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith(path.join('routing', 'installed.ts'))) {
    if (request === 'expo-file-system') return { File: class { constructor(directory, filename) { assert.equal(directory, 'file:///SYNTHETIC-TEST-ONLY/'); assert.equal(filename, 'graph.json'); } get exists() { return exists; } get size() { return bytes.length; } async bytes() { return bytes; } } };
    if (request === 'expo-crypto') return nativeCrypto;
    if (request === '../updates') return { getActivePack: async kind => { assert.equal(kind, 'core'); return recover(); } };
    if (request === '../updates/reviewed-catalog') return { get REVIEWED_MANIFEST_SHA256() { return trusted; } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { refreshInstalledGraph } = require(path.join(root, 'apps/mobile/src/routing/installed.ts'));
Module._load = originalLoad;
const now = Date.now(); const iso = offset => new Date(now + offset).toISOString();
const review = () => ({ status: 'approved', fieldVerifiedAt: iso(-86400000), validUntil: iso(3600000), reviewer: 'SYNTHETIC TEST REVIEWER', evidenceId: 'SYNTHETIC TEST ONLY' });
const boundary = [[121.0475, 14.54865], [121.05205, 14.54865], [121.05205, 14.5524], [121.0475, 14.5524], [121.0475, 14.54865]];
const scopeId = 'omni-bgc:service-area:high-street-pilot-v1';
const p = x => [121.049 + x * 0.00001, 14.55];
function setup(mutator) {
  const graph = { schemaVersion: 1, version: 'SYNTHETIC-LOADER-v1', scopeId, sourceSnapshotId: 'SYNTHETIC-SNAPSHOT', sourceSha256: 'a'.repeat(64), status: 'approved', review: review(), boundary: boundary.map(c => [...c]),
    nodes: ['a', 'b'].map((id, i) => ({ id, coordinate: p(i * 100), grade: '0', barrier: 'none', review: review() })),
    edges: [{ id: 'ab', from: 'a', to: 'b', coordinates: [p(0), p(100)], direction: 'both', access: 'allowed', foot: 'allowed', gradeTransition: 'none', review: review() }],
    connectors: [{ id: 'entry-link', entranceId: 'entry', edgeId: 'ab', edgeCoordinate: p(80), endpointCoordinate: p(80), coordinates: [p(80), p(80)], access: 'allowed', foot: 'allowed', direction: 'both', review: review() }] };
  if (mutator) mutator(graph);
  bytes = new Uint8Array(Buffer.from(JSON.stringify(graph)));
  const manifest = { formatVersion: 1, kind: 'core', version: 'SYNTHETIC-LOADER-v1', schemaVersion: 1, scopeId, createdAt: iso(-86400000), validUntil: iso(86400000),
    files: [{ path: 'graph.json', url: 'https://example.invalid/SYNTHETIC/graph.json', sha256: bytesHash(bytes), sizeBytes: bytes.length }], dependencies: [],
    snapshots: [{ id: 'SYNTHETIC-SNAPSHOT', rawSha256: 'a'.repeat(64), license: 'SYNTHETIC TEST ONLY', attribution: 'SYNTHETIC TEST ONLY', permissionEvidenceSha256: 'b'.repeat(64), permittedUse: 'data', validUntil: iso(86400000) }],
    review: { parentReviewer: 'SYNTHETIC TEST ONLY', humanRightsReviewer: 'SYNTHETIC TEST ONLY', reviewedAt: iso(-86399000), userDistributionAuthorized: true, licenseObligationsSatisfied: true } };
  active = { manifest, manifestSha256: bytesHash(Buffer.from(contracts.canonical(manifest))), directory: 'file:///SYNTHETIC-TEST-ONLY/' }; trusted.push(active.manifestSha256);
  return graph;
}
function rebindManifest() { active.manifestSha256 = bytesHash(Buffer.from(contracts.canonical(active.manifest))); trusted.push(active.manifestSha256); }
const origin = { coordinate: p(20), confirmed: true, method: 'manual' }; const entrance = { id: 'entry', label: 'SYNTHETIC TEST ONLY', coordinate: p(80), eligible: true };
beforeEach(() => { engine.clearGraph(); active = null; bytes = new Uint8Array(); trusted = []; exists = true; recover = async () => active; });
test('missing core clears previously installed engine', async () => {
  const graph = setup(); engine.installGraph(graph); active = null;
  assert.equal((await refreshInstalledGraph()).installed, false); assert.equal((await engine.route(origin, entrance)).available, false);
});
test('exact synthetic reviewed graph receipt installs and preserves route API', async () => {
  setup(); const result = await refreshInstalledGraph(); assert.equal(result.installed, true); assert.equal(result.eligibleEdges, 1); assert.equal(result.packVersion, 'SYNTHETIC-LOADER-v1'); assert.equal((await engine.route(origin, entrance)).available, true);
});
test('unbound graph artifact SHA and absent exact artifact denied', async () => {
  setup(); active.manifest.files[0].sha256 = 'f'.repeat(64); rebindManifest(); assert.equal((await refreshInstalledGraph()).installed, false);
  setup(); active.manifest.files[0].path = 'candidate-graph.json'; rebindManifest(); assert.equal((await refreshInstalledGraph()).installed, false);
  setup(); exists = false; assert.equal((await refreshInstalledGraph()).installed, false);
});
test('unreviewed or mismatched canonical manifest SHA denied', async () => {
  setup(); trusted = []; assert.equal((await refreshInstalledGraph()).installed, false);
  setup(); active.manifestSha256 = '0'.repeat(64); assert.equal((await refreshInstalledGraph()).installed, false);
});
test('source snapshot, source SHA, version and polygon binding denied independently', async () => {
  for (const mutate of [g => g.sourceSnapshotId = 'other', g => g.sourceSha256 = 'c'.repeat(64), g => g.version = 'other', g => g.scopeId = 'other', g => g.boundary[0] = [121.0474, 14.54865]]) {
    setup(mutate); assert.equal((await refreshInstalledGraph()).installed, false);
  }
});
test('expired rights and graph review exceeding source rights fail closed', async () => {
  setup(); active.manifest.snapshots[0].validUntil = iso(-1000); rebindManifest(); assert.equal((await refreshInstalledGraph()).installed, false);
  setup(); active.manifest.snapshots[0].validUntil = iso(1000); rebindManifest(); assert.equal((await refreshInstalledGraph()).installed, false);
  setup(); active.manifest.review.userDistributionAuthorized = false; rebindManifest(); assert.equal((await refreshInstalledGraph()).installed, false);
});
test('candidate graph never promoted, even within synthetic reviewed artifact receipt', async () => {
  setup(g => g.status = 'candidate'); assert.equal((await refreshInstalledGraph()).installed, false); assert.equal((await engine.route(origin, entrance)).available, false);
});
test('async metadata failure clears graph and superseded refresh cannot remove newer state', async () => {
  const graph = setup(); engine.installGraph(graph); recover = async () => { throw Error('SYNTHETIC READ FAILURE'); }; assert.equal((await refreshInstalledGraph()).installed, false);
  setup(); let release; recover = () => new Promise(resolve => { release = resolve; }); const old = refreshInstalledGraph();
  recover = async () => active; assert.equal((await refreshInstalledGraph()).installed, true);
  release(null); assert.equal((await old).installed, false); assert.equal((await engine.route(origin, entrance)).available, true);
});
