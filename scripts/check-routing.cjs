// Synthetic host fixtures only; these do not approve real pedestrian access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { calculateWalkingRoute: route, route: legacyRoute, installGraph, clearGraph, distance, lineLength, search, nextGraphExpiry } = require('../src/routing/engine.ts');
const clock = Date.now;
let now = Date.parse('2026-10-24T00:00:00Z');
Date.now = () => now;
const point = (x, y = 0) => [121 + x / 110000, 14 + y / 110000];
const review = () => ({ status: 'approved', reviewer: 'fixture-reviewer', evidenceId: 'synthetic-test', fieldVerifiedAt: '2026-10-23T00:00:00Z', validUntil: '2026-10-25T00:00:00Z' });
const node = (id, x, y = 0, grade = 'ground') => ({ id, coordinate: point(x, y), grade, barrier: 'none', review: review() });
const edge = (id, from, to, overrides = {}) => ({ id, from: from.id, to: to.id, coordinates: [from.coordinate, to.coordinate], direction: 'both', access: 'allowed', foot: 'allowed', review: review(), gradeTransition: 'none', ...overrides });
const graph = (nodes, edges, connectors = []) => ({ schemaVersion: 1, version: 'synthetic-fixture', scopeId: 'fixture', status: 'approved', sourceSha256: 'a'.repeat(64), review: review(), boundary: [point(-1000, -1000), point(1000, -1000), point(1000, 1000), point(-1000, 1000), point(-1000, -1000)], nodes, edges, connectors });
const manual = (coordinate) => ({ coordinate, method: 'manual', confirmed: true });
const entrance = (id, coordinate) => ({ id, coordinate, label: id, eligible: true });
const place = (...entrances) => ({ coordinate: null, method: 'place', confirmed: true, entrances, label: 'Synthetic place' });
const connector = (id, e, endpointCoordinate, edgeCoordinate, overrides = {}) => ({ id, edgeId: e.id, endpointCoordinate, edgeCoordinate, coordinates: [endpointCoordinate, edgeCoordinate], review: review(), access: 'allowed', foot: 'allowed', direction: 'both', ...overrides });
function install(pack) { assert.equal(installGraph(pack).installed, true); }
function available(result) { assert.equal(result.available, true, JSON.stringify(result)); return result; }
function unavailable(result, code) { assert.equal(result.available, false, JSON.stringify(result)); assert.equal(result.code, code); }
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.05, `${a} differs from ${b}`);

(async () => {
  const a = node('a', 0), b = node('b', 100), e = edge('main', a, b);
  clearGraph();
  unavailable(await route(manual(point(20)), manual(point(80))), 'missing_graph');
  install(graph([a, b], [e]));
  for (const [start, end] of [[20, 80], [80, 20], [50, 50], [0, 100], [100, 0]]) {
    const result = available(await route(manual(point(start)), manual(point(end))));
    close(result.lengthM, distance(point(start), point(end)));
    assert.equal(result.originAttachment.edgeId, 'main');
  }
  for (const direction of ['forward', 'reverse']) {
    install(graph([a, b], [{ ...e, direction }]));
    const [start, end] = direction === 'forward' ? [20, 80] : [80, 20];
    available(await route(manual(point(start)), manual(point(end))));
    unavailable(await route(manual(point(end)), manual(point(start))), 'disconnected');
    close(available(await route(manual(point(50)), manual(point(50)))).lengthM, 0);
  }
  install(graph([a, b], [e]));
  unavailable(await route({ ...manual(point(20)), confirmed: false }, manual(point(80))), 'invalid_origin');
  unavailable(await route(manual(point(20)), manual(null)), 'invalid_destination');
  unavailable(await route(manual(point(20)), manual(point(1200))), 'destination_outside_coverage');
  unavailable(await route(manual(point(-1200)), manual(point(80))), 'origin_outside_coverage');
  unavailable(await route(manual(point(20)), manual(point(80)), 'wheelchair'), 'unsupported_profile');
  unavailable(await route(manual(point(20, 1)), manual(point(80))), 'no_origin_attachment');
  unavailable(await route(manual(point(20)), manual(point(80, 1))), 'no_destination_attachment');
  const gps = { ...manual(point(50)), method: 'gps', accuracyM: 5, observedAt: new Date(now).toISOString() };
  available(await route(gps, manual(point(80))));
  available(await route(manual(point(80)), gps));
  unavailable(await route({ ...gps, accuracyM: 21 }, manual(point(80))), 'gps_inaccurate');
  unavailable(await route(manual(point(80)), { ...gps, observedAt: new Date(now - 60001).toISOString() }), 'gps_stale');
  unavailable(await route({ ...gps, observedAt: new Date(now + 5001).toISOString() }, manual(point(80))), 'gps_stale');
  const c = node('c', 0, 4), d = node('d', 100, 4), parallel = edge('parallel', c, d);
  for (const other of [parallel, { ...parallel, access: 'restricted' }]) {
    install(graph([a, b, c, d], [e, other]));
    unavailable(await route(gps, manual(point(80))), 'gps_inaccurate');
  }
  const ground = node('ground', 100), upper = node('upper', 150, 0, 'upper');
  const stairs = edge('stairs', ground, upper);
  for (const patch of [{ access: 'restricted' }, { foot: 'unknown' }, { review: { ...review(), status: 'candidate' } }]) {
    install(graph([a, b], [{ ...e, ...patch }]));
    unavailable(await route(manual(point(20)), manual(point(80))), 'no_origin_attachment');
  }
  install(graph([a, ground, upper], [edge('ground-path', a, ground), stairs]));
  unavailable(await route(manual(point(20)), manual(point(130))), 'no_destination_attachment');
  install(graph([a, ground, upper], [edge('ground-path', a, ground), { ...stairs, gradeTransition: 'verified_stairs' }]));
  available(await route(manual(point(20)), manual(point(130))));
  install(graph([{ ...a, barrier: 'blocked' }, b], [e]));
  unavailable(await route(manual(point(20)), manual(point(80))), 'no_origin_attachment');

  const endpoint = point(20, 5), target = point(80, 5);
  const startLink = connector('start', e, endpoint, point(20));
  const endLink = connector('end', e, target, point(80));
  install(graph([a, b], [e], [startLink, endLink]));
  for (const [start, end] of [[endpoint, target], [target, endpoint]]) {
    const result = available(await route(manual(start), manual(end)));
    close(result.lengthM, distance(endpoint, point(20)) + distance(point(20), point(80)) + distance(point(80), target));
  }
  install(graph([a, b], [e], [{ ...startLink, direction: 'endpoint_to_edge' }, { ...endLink, direction: 'edge_to_endpoint' }]));
  available(await route(manual(endpoint), manual(target)));
  unavailable(await route(manual(target), manual(endpoint)), 'no_origin_attachment');
  install(graph([a, b], [e], [connector('too-far', e, point(20, 16), point(20))]));
  unavailable(await route(manual(point(20, 16)), manual(point(80))), 'no_origin_attachment');

  // First nearby attachment is disconnected; the second reviewed connector works.
  const island = edge('island', c, d);
  install(graph([a, b, c, d], [e, island], [connector('a-disconnected', island, endpoint, point(20, 4)), startLink]));
  assert.equal(available(await route(manual(endpoint), manual(point(80)))).originAttachment.connectorId, 'start');
  assert.equal(available(await route(manual(point(80)), manual(endpoint))).destinationAttachment.connectorId, 'start');
  const crossingFrom = node('crossing-from', 50, -20), crossingTo = node('crossing-to', 50, 20);
  install(graph([a, b, crossingFrom, crossingTo], [e, edge('crossing-without-junction', crossingFrom, crossingTo)]));
  unavailable(await route(manual(point(20)), manual(point(50, 10))), 'disconnected');
  const bad = entrance('bad', point(80, 9)), good = entrance('good', target);
  const entranceLinks = [connector('a-island-entrance', island, bad.coordinate, point(80, 4), { entranceId: bad.id }), { ...endLink, entranceId: good.id }];
  install(graph([a, b, c, d], [e, island], entranceLinks));
  const destination = place(bad, good);
  assert.equal(available(await route(manual(point(20)), destination)).destinationAttachment.entranceId, 'good');
  assert.equal(available(await route(destination, manual(point(20)))).originAttachment.entranceId, 'good');
  available(await legacyRoute(manual(point(20)), good));
  unavailable(await route(manual(point(20)), place({ ...good, eligible: false })), 'no_destination_attachment');
  unavailable(await route(manual(point(20)), { ...place(), coordinate: point(80) }), 'no_destination_attachment');
  install(graph([a, b], [e], [endLink]));
  unavailable(await route(manual(point(20)), place(good)), 'no_destination_attachment');

  // Complete connector length participates in the winning entrance, not ID order.
  const long = entrance('long', point(90, 100)), short = entrance('short', point(90, 1));
  install(graph([a, b], [e], [connector('a-long', e, long.coordinate, point(25), { entranceId: long.id }), connector('z-short', e, short.coordinate, point(90), { entranceId: short.id })]));
  assert.equal(available(await route(manual(point(20)), place(long, short))).destinationAttachment.entranceId, 'short');
  assert.equal(available(await route(place(long, short), manual(point(20)))).originAttachment.entranceId, 'short');
  unavailable(await route(place(entrance('outside', point(1200))), manual(point(20))), 'origin_outside_coverage');
  unavailable(await route(manual(point(20)), place(entrance('outside', point(1200)))), 'destination_outside_coverage');
  const detour = node('detour', 50, 20);
  install(graph([a, b, detour], [{ ...e, costFactor: 3 }, edge('detour-in', a, detour), edge('detour-out', detour, b)]));
  const cheaper = available(await route(manual(a.coordinate), manual(b.coordinate)));
  assert.ok(cheaper.coordinates.some(p => distance(p, detour.coordinate) < 0.01));
  assert.equal(installGraph(graph([a, b], [{ ...e, costFactor: 0.5 }])).installed, false);

  const expiring = graph([a, b], [e], [{ ...endLink, entranceId: good.id }]);
  expiring.connectors[0].review.validUntil = '2026-10-24T00:00:01Z';
  install(expiring);
  assert.equal(nextGraphExpiry(), now + 1000);
  available(await route(manual(point(20)), place(good)));
  now += 1001;
  unavailable(await route(manual(point(20)), place(good)), 'no_destination_attachment');
  assert.ok(nextGraphExpiry() > now);
  now = Date.parse('2026-10-25T00:00:00Z');
  unavailable(await route(manual(point(20)), manual(point(80))), 'review_expired');
  clearGraph(); assert.equal(nextGraphExpiry(), null);

  // Deterministic directed, weighted A* agrees with Dijkstra on synthetic graphs.
  let seed = 42;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let run = 0; run < 60; run++) {
    const positions = new Map(Array.from({ length: 12 }, (_, i) => [String(i), point(random() * 100, random() * 100)]));
    const arcs = [];
    for (const [from, p] of positions) for (const [to, q] of positions) if (from !== to && random() < 0.2) arcs.push({ from, to, cost: distance(p, q) * (1 + random() * 3), geometry: [p, q], edgeId: `${from}-${to}`, label: 'fixture' });
    const astar = search(arcs, positions, '0', '11'), dijkstra = search(arcs, positions, '0', '11', false);
    assert.equal(astar?.cost, dijkstra?.cost);
    assert.deepEqual(search(arcs, positions, '0', '11'), astar);
    if (astar) assert.ok(astar.cost >= lineLength(astar.arcs.flatMap(arc => arc.geometry)) - 0.001);
  }
  console.log('Routing host checks passed: symmetric endpoints, directed splits, complete candidate costs, access/grade/GPS/review gates, A* vs Dijkstra.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Date.now = clock; clearGraph(); });
