/* All approved/field review records below are SYNTHETIC TEST ONLY. No geography claim. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'apps/mobile/node_modules/typescript'));
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, filename);
const engine = require(path.join(root, 'packages/routing/index.ts'));
const { matchProgress } = require(path.join(root, 'packages/routing/progress.ts'));
const now = Date.now();
const review = () => ({ status: 'approved', fieldVerifiedAt: new Date(now - 86400000).toISOString(), validUntil: new Date(now + 86400000).toISOString(), reviewer: 'SYNTHETIC TEST REVIEWER', evidenceId: 'SYNTHETIC TEST ONLY' });
const p = (x, y = 0) => [121.05 + x * 0.00001, 14.55 + y * 0.00001];
const node = (id, coordinate, overrides = {}) => ({ id, coordinate, grade: '0', barrier: 'none', review: review(), ...overrides });
const edge = (id, from, to, coordinates, overrides = {}) => ({ id, from, to, coordinates, direction: 'both', access: 'allowed', foot: 'allowed', review: review(), gradeTransition: 'none', ...overrides });
const connector = (id, edgeId, anchor, endpoint, overrides = {}) => ({ id, edgeId, edgeCoordinate: anchor, endpointCoordinate: endpoint, coordinates: [endpoint, anchor], review: review(), access: 'allowed', foot: 'allowed', direction: 'both', ...overrides });
function fixture() {
  const a = node('a', p(0)); const b = node('b', p(100));
  return { schemaVersion: 1, version: 'SYNTHETIC-TEST-v1', sourceSha256: 'a'.repeat(64), status: 'approved', review: review(), boundary: [p(-20, -20), p(150, -20), p(150, 100), p(-20, 100), p(-20, -20)], nodes: [a, b], edges: [edge('ab', 'a', 'b', [a.coordinate, b.coordinate])], connectors: [connector('target', 'ab', p(80), p(80, 5), { entranceId: 'entry' })] };
}
const origin = (coord = p(20)) => ({ coordinate: coord, method: 'manual', confirmed: true });
const entrance = (coord = p(80, 5)) => ({ id: 'entry', label: 'TEST ONLY entrance', coordinate: coord, eligible: true });
beforeEach(() => engine.clearGraph());
test('default empty graph and synthetic candidates never install or route', async () => {
  assert.equal((await engine.route(origin(), entrance())).available, false);
  const f = fixture(); f.status = 'candidate';
  const m3 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/candidate-export.json'), 'utf8'));
  for (const candidate of [f, m3]) {
    assert.equal(engine.installGraph(fixture()).installed, true);
    assert.equal((await engine.route(origin(), entrance())).available, true);
    assert.equal(engine.installGraph(candidate).installed, false);
    assert.equal((await engine.route(origin(), entrance())).available, false);
  }
});
test('same edge snap slices real geometry with no endpoint detour', async () => {
  const f = fixture(); assert.equal(engine.installGraph(f).eligibleEdges, 1);
  const result = await engine.route(origin(), entrance());
  assert.equal(result.available, true);
  assert.equal(result.graphVersion, f.version);
  assert.ok(Math.abs(result.lengthM - (engine.distance(p(20), p(80)) + engine.distance(p(80), p(80, 5)))) < 0.05);
  assert.ok(result.coordinates.every(c => c[0] >= p(20)[0] && c[0] <= p(80)[0] + 1e-12));
  assert.equal(result.instructions.at(-1), 'Arrive at TEST ONLY entrance.');
});
test('directed foot path rejects reverse journey', async () => {
  const f = fixture(); f.edges[0].direction = 'forward';
  engine.installGraph(f);
  assert.equal((await engine.route(origin(p(90)), entrance())).available, false);
  assert.equal((await engine.route(origin(p(20)), entrance())).available, true);
});
test('candidate, expired, field-unverified, unknown and private edges excluded', async () => {
  for (const mutate of [f => f.edges[0].review.status = 'candidate', f => f.edges[0].review.validUntil = new Date(now - 1000).toISOString(), f => f.edges[0].review.fieldVerifiedAt = null, f => f.edges[0].access = 'unknown', f => f.edges[0].foot = 'restricted', f => f.edges[0].review.reviewer = 'UNKNOWN']) {
    const f = fixture(); mutate(f);
    assert.equal(engine.installGraph(f).eligibleEdges, 0);
    assert.equal((await engine.route(origin(), entrance())).available, false);
  }
});
test('GPS poor/stale/future and unconfirmed fixes rejected; manual origin optional', () => {
  assert.equal(engine.assessOrigin(null).usable, false);
  assert.equal(engine.assessOrigin({ ...origin(), confirmed: false }).usable, false);
  const gps = { ...origin(), method: 'gps', accuracyM: 8, observedAt: new Date(now).toISOString() };
  assert.equal(engine.assessOrigin(gps, now).usable, true);
  for (const change of [{ accuracyM: 21 }, { observedAt: new Date(now - 61000).toISOString() }, { observedAt: new Date(now + 10000).toISOString() }, { accuracyM: NaN }]) assert.equal(engine.assessOrigin({ ...gps, ...change }, now).usable, false);
  assert.equal(engine.assessOrigin(origin()).usable, true);
  assert.equal(engine.assessOrigin(origin([290000, 1609000])).usable, false);
});
test('outside origins and destinations rejected without clamping', async () => {
  engine.installGraph(fixture());
  assert.equal(engine.assessOrigin(origin(p(200))).usable, false);
  assert.equal((await engine.route(origin(), entrance(p(200)))).available, false);
});
test('unverified or mismatched entrance connectors cannot route', async () => {
  const f = fixture(); f.connectors[0].review.fieldVerifiedAt = null; engine.installGraph(f);
  assert.equal((await engine.route(origin(), entrance())).available, false);
  engine.installGraph(fixture());
  assert.equal((await engine.route(origin(), { ...entrance(), eligible: false })).available, false);
  assert.equal((await engine.route(origin(), entrance(p(85, 5)))).available, false);
});
test('nearby edge requires verified origin connector; no invented straight traversal', async () => {
  const f = fixture(); engine.installGraph(f);
  assert.equal((await engine.route(origin(p(20, 5)), entrance())).available, false);
  f.connectors.push(connector('start', 'ab', p(20), p(20, 5))); engine.installGraph(f);
  const result = await engine.route(origin(p(20, 5)), entrance());
  assert.equal(result.available, true); assert.deepEqual(result.coordinates[0], p(20, 5));
  f.connectors[1].access = 'restricted'; engine.installGraph(f);
  assert.equal((await engine.route(origin(p(20, 5)), entrance())).available, false);
});
test('snap distance limit and connector direction enforced', async () => {
  const f = fixture(); f.connectors.push(connector('start', 'ab', p(20), p(20, 30))); engine.installGraph(f);
  assert.equal((await engine.route(origin(p(20, 30)), entrance())).available, false);
  f.connectors[1] = connector('start', 'ab', p(20), p(20, 5), { direction: 'edge_to_endpoint' }); engine.installGraph(f);
  assert.equal((await engine.route(origin(p(20, 5)), entrance())).available, false);
});
test('grade separated visual crossings and coincident IDs remain disconnected', async () => {
  const f = fixture(); const c = node('c', p(60, -10), { grade: '1' }); const d = node('d', p(60, 30), { grade: '1' });
  f.nodes.push(c, d); f.edges.push(edge('cd', 'c', 'd', [c.coordinate, d.coordinate]));
  f.connectors = [connector('target', 'cd', p(60, 20), p(65, 20), { entranceId: 'entry' })]; engine.installGraph(f);
  assert.equal((await engine.route(origin(), entrance(p(65, 20)))).available, false);
  f.nodes[2].coordinate = p(100); f.edges[1].coordinates = [p(100), d.coordinate]; f.connectors[0].edgeCoordinate = p(60, 20); f.connectors[0].coordinates = [p(65, 20), p(60, 20)];
  // Explicit duplicate-location source IDs are not connected by coordinate proximity.
  f.connectors[0] = connector('target', 'cd', d.coordinate, p(65, 20), { entranceId: 'entry' }); engine.installGraph(f);
  assert.equal((await engine.route(origin(), entrance(p(65, 20)))).available, false);
});
test('blocked nodes and unverified grade changes excluded', () => {
  for (const mutate of [f => f.nodes[1].barrier = 'blocked', f => f.nodes[1].barrier = 'unknown', f => f.nodes[1].grade = '1']) {
    const f = fixture(); mutate(f); assert.equal(engine.installGraph(f).eligibleEdges, 0);
  }
  const f = fixture(); f.nodes[1].grade = '1'; f.edges[0].gradeTransition = 'verified_stairs'; assert.equal(engine.installGraph(f).eligibleEdges, 1);
  assert.equal(engine.wheelchairRoutingAvailable(), false);
});
test('geometry mismatch, duplicate IDs, zero cost and malformed boundary denied', () => {
  for (const mutate of [f => f.nodes.push(f.nodes[0]), f => f.edges[0].coordinates[0] = p(1), f => f.edges[0].costFactor = 0.5, f => f.boundary = [p(0, 0), p(100, 100), p(0, 100), p(100, 0), p(0, 0)], f => f.nodes[0].id = '@origin']) {
    const f = fixture(); mutate(f); assert.equal(engine.installGraph(f).installed, false);
  }
});
test('concave supported area rejects shortcut exiting coverage', () => {
  const f = fixture(); f.boundary = [p(-20, -20), p(150, -20), p(150, 100), p(60, 100), p(60, -5), p(40, -5), p(40, 100), p(-20, 100), p(-20, -20)];
  assert.equal(engine.installGraph(f).eligibleEdges, 0);
});
test('A* matches Dijkstra on deterministic adversarial weighted directed graphs', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const positions = new Map(Array.from({ length: 12 }, (_, i) => [String(i), p(i * 5, ((i * seed) % 7) * 3)]));
    const arcs = [];
    for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) if (b === a + 1 || (a * 17 + b * 7 + seed) % 4 === 0) {
      const geometry = [positions.get(String(a)), positions.get(String(b))];
      arcs.push({ from: String(a), to: String(b), geometry, cost: engine.lineLength(geometry) * (1 + ((a + b + seed) % 5)), edgeId: `${a}-${b}`, label: 'TEST ONLY' });
    }
    const astar = engine.search(arcs, positions, '0', '11'); const dijkstra = engine.search(arcs, positions, '0', '11', false);
    assert.ok(astar); assert.ok(Math.abs(astar.cost - dijkstra.cost) < 1e-8);
  }
});
test('multi-edge A* reconstructs actual detour geometry and physical length separately from weighted cost', async () => {
  const f = fixture(); f.edges[0].costFactor = 10;
  f.nodes.push(node('c', p(0, 20)), node('d', p(100, 20)));
  f.edges.push(edge('ac', 'a', 'c', [p(0), p(0, 20)]), edge('cd', 'c', 'd', [p(0, 20), p(100, 20)]), edge('db', 'd', 'b', [p(100, 20), p(100)]));
  engine.installGraph(f); const result = await engine.route(origin(), entrance());
  assert.equal(result.available, true);
  assert.ok(result.coordinates.some(c => engine.distance(c, p(100, 20)) < 0.01));
  assert.ok(Math.abs(result.lengthM - engine.lineLength(result.coordinates)) < 1e-8);
  assert.ok(result.lengthM > engine.distance(p(20), p(80)));
  assert.ok(result.instructions.length >= 4);
});
test('progress hysteresis resists single bad fix, requires recovery and never persists coordinate', () => {
  const coordinates = [p(0), p(100)]; let state = null;
  let fixIndex = 0;
  const fix = (coord) => ({ coordinate: coord, accuracyM: 5, observedAt: new Date(now + fixIndex++).toISOString() });
  state = matchProgress(coordinates, 'v1', fix(p(10)), state, now).state;
  for (let i = 0; i < 2; i++) { state = matchProgress(coordinates, 'v1', fix(p(10, 30)), state, now).state; assert.equal(state.offRoute, false); }
  state = matchProgress(coordinates, 'v1', fix(p(10, 30)), state, now).state; assert.equal(state.offRoute, true);
  state = matchProgress(coordinates, 'v1', fix(p(20)), state, now).state; assert.equal(state.offRoute, true);
  state = matchProgress(coordinates, 'v1', fix(p(21)), state, now).state; assert.equal(state.offRoute, false);
  const along = state.alongM; state = matchProgress(coordinates, 'v1', fix(p(19)), state, now).state; assert.equal(state.alongM, along);
  assert.ok(!('coordinate' in state));
  assert.equal(matchProgress(coordinates, 'v1', { ...fix(p(22)), accuracyM: 100 }, state, now).accepted, false);
  assert.equal(matchProgress(coordinates, 'v1', { ...fix(p(22)), observedAt: state.lastObservedAt }, state, now).accepted, false);
});
test('closed directed loop preserves complete tail geometry when destination precedes origin', async () => {
  const f = fixture(); f.nodes = [node('loop', p(0))];
  f.edges = [edge('loop', 'loop', 'loop', [p(0), p(100), p(100, 50), p(0, 50), p(0)], { direction: 'forward' })];
  f.connectors = [connector('target', 'loop', p(20), p(20, -5), { entranceId: 'entry' })];
  engine.installGraph(f); const result = await engine.route(origin(p(0, 30)), entrance(p(20, -5)));
  assert.equal(result.available, true);
  assert.ok(result.coordinates.some(c => engine.distance(c, p(0)) < 0.01));
  assert.ok(result.lengthM > engine.distance(p(0, 30), p(20)));
});
test('review expiry rechecked per route and invalid calendar dates do not normalize to approval', async () => {
  const f = fixture(); f.review.validUntil = '2026-02-30T12:00:00Z';
  assert.equal(engine.installGraph(f).installed, false);
  const fresh = fixture(); engine.installGraph(fresh, now - 1);
  assert.equal((await engine.route(origin(), entrance())).available, true);
  const expired = fixture(); expired.review.validUntil = new Date(now - 1).toISOString();
  assert.equal(engine.installGraph(expired, now - 1000).installed, true);
  assert.equal((await engine.route(origin(), entrance())).available, false);
});
test('pack input copied so caller edits cannot silently promote restrictions', async () => {
  const f = fixture(); f.edges[0].foot = 'restricted'; engine.installGraph(f); f.edges[0].foot = 'allowed';
  assert.equal((await engine.route(origin(), entrance())).available, false);
});
