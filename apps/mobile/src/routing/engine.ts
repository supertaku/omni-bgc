/** Pure offline routing. Reviewed geometry only; no storage, permissions or network. */
export type Coordinate = readonly [number, number];
export type Review = { status: 'approved' | 'candidate' | 'stale'; fieldVerifiedAt: string | null; validUntil: string; reviewer: string; evidenceId: string };
export type Node = { id: string; coordinate: Coordinate; grade: string; barrier: 'none' | 'cleared' | 'unknown' | 'blocked'; review: Review };
export type Edge = { id: string; from: string; to: string; coordinates: Coordinate[]; direction: 'both' | 'forward' | 'reverse'; access: 'allowed' | 'unknown' | 'restricted'; foot: 'allowed' | 'unknown' | 'restricted'; review: Review; gradeTransition: 'none' | 'verified_stairs' | 'verified_ramp' | 'verified_lift'; costFactor?: number; label?: string };
export type Connector = { id: string; edgeId: string; edgeCoordinate: Coordinate; endpointCoordinate: Coordinate; coordinates: Coordinate[]; review: Review; access: 'allowed' | 'unknown' | 'restricted'; foot: 'allowed' | 'unknown' | 'restricted'; direction: 'both' | 'endpoint_to_edge' | 'edge_to_endpoint'; entranceId?: string };
export type GraphPack = { schemaVersion: 1; version: string; status: 'approved' | 'candidate'; sourceSha256: string; review: Review; boundary: Coordinate[]; nodes: Node[]; edges: Edge[]; connectors: Connector[] };
export type Origin = { coordinate: Coordinate; method: 'manual' | 'gps' | 'landmark'; confirmed: boolean; accuracyM?: number; observedAt?: string };
export type Entrance = { id: string; label: string; coordinate: Coordinate | null; eligible: boolean; reason?: string; floor?: string };
export type RouteResult = { available: false; reason: string } | { available: true; coordinates: Coordinate[]; lengthM: number; instructions: string[]; graphVersion: string };
const RAD = Math.PI / 180;
const R = 6371008.8;
const ON_NETWORK_M = 0.25;
const MAX_SNAP_M = 15;
export function validCoordinate(c: unknown): c is Coordinate {
  return Array.isArray(c) && c.length === 2 && c.every(v => typeof v === 'number' && Number.isFinite(v)) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
}
export function distance(a: Coordinate, b: Coordinate): number {
  const lat = (b[1] - a[1]) * RAD; const lon = (b[0] - a[0]) * RAD;
  const h = Math.sin(lat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(lon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function lineLength(c: readonly Coordinate[]): number { return c.slice(1).reduce((sum, p, i) => sum + distance(c[i]!, p), 0); }
const same = (a: Coordinate, b: Coordinate) => distance(a, b) <= 0.01;
function validReview(r: Review | undefined, now: number): boolean {
  const known = (v: unknown) => typeof v === 'string' && Boolean(v.trim()) && !['UNKNOWN', 'UNASSIGNED'].includes(v.trim().toUpperCase());
  const utc = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(v);
  if (!r || r.status !== 'approved' || !known(r.reviewer) || !known(r.evidenceId) || !utc(r.fieldVerifiedAt) || !utc(r.validUntil)) return false;
  const verified = Date.parse(r.fieldVerifiedAt!); const expiry = Date.parse(r.validUntil);
  return Number.isFinite(verified) && Number.isFinite(expiry) && new Date(verified).toISOString().slice(0, 19) === r.fieldVerifiedAt!.slice(0, 19) && new Date(expiry).toISOString().slice(0, 19) === r.validUntil.slice(0, 19) && verified <= now && expiry > now && expiry > verified;
}
function onSegment(p: Coordinate, a: Coordinate, b: Coordinate): boolean {
  const cross = (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]);
  return Math.abs(cross) < 1e-12 && p[0] >= Math.min(a[0], b[0]) - 1e-12 && p[0] <= Math.max(a[0], b[0]) + 1e-12 && p[1] >= Math.min(a[1], b[1]) - 1e-12 && p[1] <= Math.max(a[1], b[1]) + 1e-12;
}
function boundaryValid(ring: Coordinate[]): boolean {
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(validCoordinate) || ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1]) return false;
  // This local pilot engine intentionally rejects global/dateline polygons.
  if (Math.max(...ring.map(c => c[0])) - Math.min(...ring.map(c => c[0])) > 1 || Math.max(...ring.map(c => c[1])) - Math.min(...ring.map(c => c[1])) > 1) return false;
  const turn = (a: Coordinate, b: Coordinate, c: Coordinate) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!; const b = ring[i + 1]!;
    if (same(a, b)) return false;
    area += a[0] * b[1] - b[0] * a[1];
    for (let j = i + 2; j < ring.length - 1; j++) {
      if (i === 0 && j === ring.length - 2) continue;
      const c = ring[j]!; const d = ring[j + 1]!;
      if (onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b) || (turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0)) return false;
    }
  }
  return Math.abs(area) > 1e-12;
}
export function insideBoundary(p: Coordinate, ring: readonly Coordinate[]): boolean {
  let inside = false;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!; const b = ring[i + 1]!;
    if (onSegment(p, a, b)) return true;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function lineInside(coords: Coordinate[], ring: Coordinate[]): boolean {
  if (!coords.every(p => insideBoundary(p, ring))) return false;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!; const b = coords[i]!; const ts = [0, 1];
    for (let j = 1; j < ring.length; j++) {
      const c = ring[j - 1]!; const d = ring[j]!;
      const rx = b[0] - a[0]; const ry = b[1] - a[1]; const sx = d[0] - c[0]; const sy = d[1] - c[1];
      const denom = rx * sy - ry * sx;
      if (Math.abs(denom) < 1e-20) continue;
      const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / denom;
      const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / denom;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
    ts.sort((x, y) => x - y);
    for (let j = 1; j < ts.length; j++) {
      const t = (ts[j - 1]! + ts[j]!) / 2;
      if (!insideBoundary([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ring)) return false;
    }
  }
  return true;
}
export type Projection = { coordinate: Coordinate; distanceM: number; alongM: number; segment: number };
export function projectOnLine(point: Coordinate, coords: readonly Coordinate[]): Projection {
  let best: Projection = { coordinate: coords[0]!, distanceM: Infinity, alongM: 0, segment: 0 }; let cumulative = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!; const b = coords[i]!; const cos = Math.cos(point[1] * RAD);
    const dx = (b[0] - a[0]) * cos; const dy = b[1] - a[1];
    const px = (point[0] - a[0]) * cos; const py = point[1] - a[1];
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)));
    const coordinate: Coordinate = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const d = distance(point, coordinate); const segmentLength = distance(a, b);
    if (d < best.distanceM) best = { coordinate, distanceM: d, alongM: cumulative + segmentLength * t, segment: i - 1 };
    cumulative += segmentLength;
  }
  return best;
}
function sliceLine(coords: Coordinate[], from: Projection, to: Projection): Coordinate[] {
  if (from.alongM > to.alongM) return sliceLine(coords, to, from).reverse();
  const result = [from.coordinate];
  for (let i = from.segment + 1; i <= to.segment; i++) result.push(coords[i]!);
  if (!same(result[result.length - 1]!, to.coordinate)) result.push(to.coordinate);
  return result;
}
type Arc = { from: string; to: string; cost: number; geometry: Coordinate[]; label: string; edgeId: string };
type Installed = { pack: GraphPack; nodes: Map<string, Node>; edges: Edge[]; connectors: Connector[] };
let installed: Installed | null = null;
let lastInstallReason = 'No reviewed offline walking graph is installed.';
export function clearGraph(): void { installed = null; lastInstallReason = 'No reviewed offline walking graph is installed.'; }
function eligibleEdges(pack: GraphPack, nodes: Map<string, Node>, now: number): Edge[] {
  return pack.edges.filter(e => {
    const a = nodes.get(e.from); const b = nodes.get(e.to);
    return a && b && validReview(a.review, now) && validReview(b.review, now) && ['none', 'cleared'].includes(a.barrier) && ['none', 'cleared'].includes(b.barrier)
      && validReview(e.review, now) && e.access === 'allowed' && e.foot === 'allowed' && ['both', 'forward', 'reverse'].includes(e.direction)
      && (a.grade === b.grade ? e.gradeTransition === 'none' : ['verified_stairs', 'verified_ramp', 'verified_lift'].includes(e.gradeTransition))
      && lineInside(e.coordinates, pack.boundary);
  });
}
export function installGraph(input: unknown, now = Date.now()): { installed: boolean; eligibleEdges: number; reason: string | null } {
  clearGraph();
  try {
    const pack = JSON.parse(JSON.stringify(input)) as GraphPack;
    if (pack.schemaVersion !== 1 || pack.status !== 'approved' || !pack.version?.trim() || !/^[a-f0-9]{64}$/.test(pack.sourceSha256) || !validReview(pack.review, now)) throw Error('Pack requires current engineering and field approval.');
    if (!boundaryValid(pack.boundary)) throw Error('Invalid supported-area boundary.');
    if (!Array.isArray(pack.nodes) || !Array.isArray(pack.edges) || !Array.isArray(pack.connectors)) throw Error('Invalid graph structure.');
    const nodes = new Map<string, Node>(); const ids = new Set<string>();
    for (const n of pack.nodes) {
      if (!n.id?.trim() || n.id.startsWith('@') || nodes.has(n.id) || !validCoordinate(n.coordinate) || !n.grade?.trim() || ['UNKNOWN', 'UNASSIGNED'].includes(n.grade.trim().toUpperCase())) throw Error('Invalid or duplicate source node.');
      nodes.set(n.id, n);
    }
    for (const e of pack.edges) {
      const a = nodes.get(e.from); const b = nodes.get(e.to);
      if (!e.id?.trim() || ids.has(e.id) || !a || !b || !Array.isArray(e.coordinates) || e.coordinates.length < 2 || !e.coordinates.every(validCoordinate) || !same(e.coordinates[0]!, a.coordinate) || !same(e.coordinates[e.coordinates.length - 1]!, b.coordinate) || lineLength(e.coordinates) <= 0 || !Number.isFinite(e.costFactor ?? 1) || (e.costFactor ?? 1) < 1) throw Error('Invalid edge geometry, identity or cost.');
      ids.add(e.id);
    }
    const connectorIds = new Set<string>();
    for (const c of pack.connectors) {
      const e = pack.edges.find(edge => edge.id === c.edgeId);
      if (!c.id?.trim() || connectorIds.has(c.id) || !e || !validCoordinate(c.edgeCoordinate) || !validCoordinate(c.endpointCoordinate) || !Array.isArray(c.coordinates) || c.coordinates.length < 2 || !c.coordinates.every(validCoordinate) || !same(c.coordinates[0]!, c.endpointCoordinate) || !same(c.coordinates[c.coordinates.length - 1]!, c.edgeCoordinate) || projectOnLine(c.edgeCoordinate, e.coordinates).distanceM > 0.01 || !['both', 'endpoint_to_edge', 'edge_to_endpoint'].includes(c.direction)) throw Error('Invalid reviewed connector geometry.');
      connectorIds.add(c.id);
    }
    const edges = eligibleEdges(pack, nodes, now);
    installed = { pack, nodes, edges, connectors: pack.connectors };
    lastInstallReason = edges.length ? '' : 'The offline graph has no current, field-verified walking edges.';
    return { installed: true, eligibleEdges: edges.length, reason: lastInstallReason || null };
  } catch (error) { lastInstallReason = error instanceof Error ? error.message : 'Invalid offline graph.'; return { installed: false, eligibleEdges: 0, reason: lastInstallReason }; }
}
export function assessOrigin(origin: Origin | null, now = Date.now()): { usable: boolean; reason: string | null } {
  if (!origin) return { usable: false, reason: 'Choose and confirm a manual origin, landmark or location fix.' };
  if (!validCoordinate(origin.coordinate) || !['manual', 'gps', 'landmark'].includes(origin.method)) return { usable: false, reason: 'Origin coordinates are invalid.' };
  if (origin.confirmed !== true) return { usable: false, reason: 'Confirm the origin before routing.' };
  if (origin.method === 'gps') {
    if (!Number.isFinite(origin.accuracyM) || origin.accuracyM! < 0 || origin.accuracyM! > 20) return { usable: false, reason: 'Location accuracy is insufficient; choose a manual origin.' };
    const observed = Date.parse(origin.observedAt || '');
    if (!Number.isFinite(observed) || now - observed > 60000 || observed > now + 5000) return { usable: false, reason: 'Location fix is stale or has an invalid time; choose a manual origin.' };
  }
  if (installed && !insideBoundary(origin.coordinate, installed.pack.boundary)) return { usable: false, reason: 'Origin is outside the supported area.' };
  return { usable: true, reason: null };
}
function connectorEligible(c: Connector, pack: GraphPack, now: number): boolean { return validReview(c.review, now) && c.access === 'allowed' && c.foot === 'allowed' && lineInside(c.coordinates, pack.boundary); }
export function search(arcs: Arc[], positions: Map<string, Coordinate>, start: string, target: string, useHeuristic = true): { arcs: Arc[]; cost: number } | null {
  const adjacency = new Map<string, Arc[]>();
  for (const arc of arcs) adjacency.set(arc.from, [...(adjacency.get(arc.from) || []), arc]);
  for (const list of adjacency.values()) list.sort((a, b) => a.to.localeCompare(b.to) || a.edgeId.localeCompare(b.edgeId));
  const costs = new Map([[start, 0]]); const previous = new Map<string, Arc>();
  const h = (id: string) => useHeuristic ? distance(positions.get(id)!, positions.get(target)!) : 0;
  type QueueItem = { id: string; cost: number; priority: number };
  const queue: QueueItem[] = [];
  const compare = (a: QueueItem, b: QueueItem) => a.priority - b.priority || a.id.localeCompare(b.id) || a.cost - b.cost;
  const push = (item: QueueItem) => {
    queue.push(item); let i = queue.length - 1;
    while (i > 0) { const parent = Math.floor((i - 1) / 2); if (compare(queue[parent]!, queue[i]!) <= 0) break; [queue[parent], queue[i]] = [queue[i]!, queue[parent]!]; i = parent; }
  };
  const pop = (): QueueItem => {
    const first = queue[0]!; const last = queue.pop()!;
    if (queue.length) {
      queue[0] = last; let i = 0;
      while (i * 2 + 1 < queue.length) {
        let child = i * 2 + 1; if (child + 1 < queue.length && compare(queue[child + 1]!, queue[child]!) < 0) child++;
        if (compare(queue[i]!, queue[child]!) <= 0) break;
        [queue[i], queue[child]] = [queue[child]!, queue[i]!]; i = child;
      }
    }
    return first;
  };
  push({ id: start, cost: 0, priority: h(start) });
  while (queue.length) {
    const item = pop(); const current = item.id;
    if (item.cost !== costs.get(current)) continue;
    if (current === target) {
      const path: Arc[] = []; let cursor = target;
      while (cursor !== start) { const arc = previous.get(cursor)!; path.unshift(arc); cursor = arc.from; }
      return { arcs: path, cost: costs.get(target)! };
    }
    for (const arc of adjacency.get(current) || []) {
      const candidate = costs.get(current)! + arc.cost;
      if (candidate < (costs.get(arc.to) ?? Infinity)) { costs.set(arc.to, candidate); previous.set(arc.to, arc); push({ id: arc.to, cost: candidate, priority: candidate + h(arc.to) }); }
    }
  }
  return null;
}
export async function route(origin: Origin, entrance: Entrance): Promise<RouteResult> {
  const now = Date.now(); const originState = assessOrigin(origin, now);
  if (!originState.usable) return { available: false, reason: originState.reason! };
  if (entrance.eligible !== true || !entrance.coordinate || !validCoordinate(entrance.coordinate)) return { available: false, reason: entrance.reason || 'This entrance has no verified walking connection.' };
  if (!installed) return { available: false, reason: lastInstallReason };
  const { pack, nodes } = installed;
  if (!validReview(pack.review, now)) return { available: false, reason: 'Offline walking graph review has expired.' };
  if (!insideBoundary(entrance.coordinate, pack.boundary)) return { available: false, reason: 'Entrance is outside the supported area.' };
  const edges = eligibleEdges(pack, nodes, now);
  if (!edges.length) return { available: false, reason: 'No current field-verified walking edges are available.' };
  const edgeMap = new Map(edges.map(e => [e.id, e]));
  const target = pack.connectors.filter(c => c.entranceId === entrance.id && c.direction !== 'endpoint_to_edge' && same(c.endpointCoordinate, entrance.coordinate!) && edgeMap.has(c.edgeId) && connectorEligible(c, pack, now)).sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!target) return { available: false, reason: 'Entrance has no current approved graph connector.' };
  const snaps = edges.map(edge => ({ edge, snap: projectOnLine(origin.coordinate, edge.coordinates) })).filter(s => s.snap.distanceM <= MAX_SNAP_M).sort((a, b) => a.snap.distanceM - b.snap.distanceM || a.edge.id.localeCompare(b.edge.id));
  let chosen: { edge: Edge; snap: Projection; geometry: Coordinate[] } | null = null;
  for (const { edge, snap } of snaps) {
    if (snap.distanceM <= ON_NETWORK_M) { chosen = { edge, snap, geometry: [snap.coordinate] }; break; }
    const connector = pack.connectors.find(c => !c.entranceId && c.edgeId === edge.id && c.direction !== 'edge_to_endpoint' && same(c.endpointCoordinate, origin.coordinate) && connectorEligible(c, pack, now));
    if (connector) { const anchor = projectOnLine(connector.edgeCoordinate, edge.coordinates); if (distance(origin.coordinate, anchor.coordinate) <= MAX_SNAP_M) { chosen = { edge, snap: anchor, geometry: connector.coordinates }; break; } }
  }
  if (!chosen) return { available: false, reason: 'No nearby verified origin connection; choose an origin on an approved path.' };
  const targetEdge = edgeMap.get(target.edgeId)!; const targetSnap = projectOnLine(target.edgeCoordinate, targetEdge.coordinates);
  const arcs: Arc[] = []; const positions = new Map([...nodes].map(([id, n]) => [id, n.coordinate]));
  positions.set('@origin', chosen.snap.coordinate); positions.set('@entrance', targetSnap.coordinate);
  const add = (from: string, to: string, geometry: Coordinate[], e: Edge) => arcs.push({ from, to, geometry, cost: lineLength(geometry) * (e.costFactor ?? 1), label: e.label || (e.gradeTransition === 'verified_stairs' ? 'verified stairs' : 'approved walking path'), edgeId: e.id });
  for (const e of edges) { if (e.direction !== 'reverse') add(e.from, e.to, e.coordinates, e); if (e.direction !== 'forward') add(e.to, e.from, [...e.coordinates].reverse(), e); }
  const endpoints = (e: Edge): [Projection, Projection] => [{ coordinate: e.coordinates[0]!, alongM: 0, distanceM: 0, segment: 0 }, { coordinate: e.coordinates[e.coordinates.length - 1]!, alongM: lineLength(e.coordinates), distanceM: 0, segment: e.coordinates.length - 2 }];
  const [originFrom, originTo] = endpoints(chosen.edge); const [targetFrom, targetTo] = endpoints(targetEdge);
  if (chosen.edge.direction !== 'reverse') add('@origin', chosen.edge.to, sliceLine(chosen.edge.coordinates, chosen.snap, originTo!), chosen.edge);
  if (chosen.edge.direction !== 'forward') add('@origin', chosen.edge.from, sliceLine(chosen.edge.coordinates, chosen.snap, originFrom!), chosen.edge);
  if (targetEdge.direction !== 'reverse') add(targetEdge.from, '@entrance', sliceLine(targetEdge.coordinates, targetFrom!, targetSnap), targetEdge);
  if (targetEdge.direction !== 'forward') add(targetEdge.to, '@entrance', sliceLine(targetEdge.coordinates, targetTo!, targetSnap), targetEdge);
  if (chosen.edge.id === targetEdge.id && ((chosen.snap.alongM <= targetSnap.alongM && chosen.edge.direction !== 'reverse') || (chosen.snap.alongM >= targetSnap.alongM && chosen.edge.direction !== 'forward'))) add('@origin', '@entrance', sliceLine(chosen.edge.coordinates, chosen.snap, targetSnap), chosen.edge);
  const result = search(arcs, positions, '@origin', '@entrance');
  if (!result) return { available: false, reason: 'No connected approved walking route is available.' };
  const coordinates: Coordinate[] = [];
  for (const c of [...chosen.geometry, ...result.arcs.flatMap(arc => arc.geometry), ...[...target.coordinates].reverse()]) { if (!coordinates.length || !same(coordinates[coordinates.length - 1]!, c)) coordinates.push(c); }
  const instructions = result.arcs.filter((arc, i) => !i || result.arcs[i - 1]!.edgeId !== arc.edgeId).map(arc => `Follow ${arc.label}.`);
  if (chosen.geometry.length > 1) instructions.unshift('Follow the verified origin connection to the walking path.');
  if (lineLength(target.coordinates) > 0.25) instructions.push('Follow the verified entrance connection.');
  instructions.push(`Arrive at ${entrance.label}.`);
  return { available: true, coordinates, lengthM: lineLength(coordinates), instructions, graphVersion: pack.version };
}
export function wheelchairRoutingAvailable(): false { return false; }
