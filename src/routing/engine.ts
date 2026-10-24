/** Pure offline routing. Reviewed geometry only; no storage, permissions or network. */
import type { RouteEndpoint, RouteFailureCode, RouteAttachment, Origin, Entrance, RouteResult } from '../contracts';
export type { Origin, Entrance, RouteResult } from '../contracts';
export type Coordinate = readonly [number, number];
export type Review = { status: 'approved' | 'candidate' | 'stale'; fieldVerifiedAt: string | null; validUntil: string; reviewer: string; evidenceId: string };
export type Node = { id: string; coordinate: Coordinate; grade: string; barrier: 'none' | 'cleared' | 'unknown' | 'blocked'; review: Review };
export type Edge = { id: string; from: string; to: string; coordinates: Coordinate[]; direction: 'both' | 'forward' | 'reverse'; access: 'allowed' | 'unknown' | 'restricted'; foot: 'allowed' | 'unknown' | 'restricted'; review: Review; gradeTransition: 'none' | 'verified_stairs' | 'verified_ramp' | 'verified_lift'; costFactor?: number; label?: string };
export type Connector = { id: string; edgeId: string; edgeCoordinate: Coordinate; endpointCoordinate: Coordinate; coordinates: Coordinate[]; review: Review; access: 'allowed' | 'unknown' | 'restricted'; foot: 'allowed' | 'unknown' | 'restricted'; direction: 'both' | 'endpoint_to_edge' | 'edge_to_endpoint'; entranceId?: string };
export type GraphPack = { schemaVersion: 1; version: string; scopeId?: string; status: 'approved' | 'candidate'; sourceSha256: string; review: Review; boundary: Coordinate[]; nodes: Node[]; edges: Edge[]; connectors: Connector[] };
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
  if (distance(result[result.length - 1]!, to.coordinate) > 1e-9) result.push(to.coordinate);
  return result;
}
type Arc = { from: string; to: string; cost: number; geometry: Coordinate[]; label: string; edgeId: string; attachment?: RouteAttachment };
type Installed = { pack: GraphPack; nodes: Map<string, Node>; arcs: Arc[] };
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
    installed = { pack, nodes, arcs: pack.edges.flatMap(edge => edgeArcs(edge, edge.from, edge.to, edge.coordinates)) };
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
export function search(arcs: Arc[], positions: Map<string, Coordinate>, start: string, target: string, useHeuristic = true, estimate?: (id: string) => number): { arcs: Arc[]; cost: number } | null {
  const adjacency = new Map<string, Arc[]>();
  for (const arc of arcs) { const list = adjacency.get(arc.from) || []; list.push(arc); adjacency.set(arc.from, list); }
  for (const list of adjacency.values()) list.sort((a, b) => a.to.localeCompare(b.to) || a.edgeId.localeCompare(b.edgeId));
  const costs = new Map([[start, 0]]); const previous = new Map<string, Arc>();
  const h = (id: string) => useHeuristic ? (estimate ? estimate(id) : distance(positions.get(id)!, positions.get(target)!)) : 0;
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
function edgeArcs(edge: Edge, from: string, to: string, geometry: Coordinate[]): Arc[] {
  const arc: Arc = { from, to, geometry, cost: lineLength(geometry) * (edge.costFactor ?? 1), label: edge.label || (edge.gradeTransition === 'verified_stairs' ? 'verified stairs' : 'approved walking path'), edgeId: edge.id };
  return [...(edge.direction !== 'reverse' ? [arc] : []), ...(edge.direction !== 'forward' ? [{ ...arc, from: to, to: from, geometry: [...geometry].reverse() }] : [])];
}
type Attachment = { edge: Edge; snap: Projection; geometry: Coordinate[]; metadata: RouteAttachment; id: string };
const failure = (code: RouteFailureCode, reason: string): RouteResult => ({ available: false, code, reason });
function validateEndpoint(endpoint: RouteEndpoint, side: 'origin' | 'destination', now: number): RouteResult | null {
  if (!endpoint || endpoint.confirmed !== true || !['manual', 'gps', 'landmark', 'place'].includes(endpoint.method) || (endpoint.method !== 'place' && !validCoordinate(endpoint.coordinate)) || (endpoint.coordinate !== null && !validCoordinate(endpoint.coordinate)) || (endpoint.entrances !== undefined && !Array.isArray(endpoint.entrances))) return failure(`invalid_${side}`, `Choose and confirm a valid ${side}.`);
  if (endpoint.method === 'gps') {
    if (!Number.isFinite(endpoint.accuracyM) || endpoint.accuracyM! < 0 || endpoint.accuracyM! > 20) return failure('gps_inaccurate', 'Location accuracy is insufficient; choose a manual point.');
    const observed = Date.parse(endpoint.observedAt || '');
    if (!Number.isFinite(observed) || now - observed > 60000 || observed > now + 5000) return failure('gps_stale', 'Location fix is stale or has an invalid time; choose a manual point.');
  }
  if (endpoint.method !== 'place' && installed && !insideBoundary(endpoint.coordinate!, installed.pack.boundary)) return failure(`${side}_outside_coverage`, `The ${side} is outside the supported area.`);
  if (endpoint.method === 'place' && installed) {
    const entrances = (endpoint.entrances || []).filter(e => e && e.eligible === true && validCoordinate(e.coordinate));
    if (entrances.length && entrances.every(e => !insideBoundary(e.coordinate!, installed!.pack.boundary))) return failure(`${side}_outside_coverage`, `The ${side} entrances are outside the supported area.`);
  }
  return null;
}
function attachments(endpoint: RouteEndpoint, side: 'origin' | 'destination', pack: GraphPack, edges: Edge[], now: number): Attachment[] {
  const candidates: Attachment[] = [];
  const append = (edge: Edge, snap: Projection, geometry: Coordinate[], connector?: Connector, entrance?: Entrance) => {
    candidates.push({ edge, snap, geometry, id: `@${side}:${candidates.length}`, metadata: { edgeId: edge.id, coordinate: snap.coordinate, ...(connector ? { connectorId: connector.id } : {}), ...(entrance ? { entranceId: entrance.id } : {}) } });
  };
  const edgeMap = new Map(edges.map(edge => [edge.id, edge]));
  if (endpoint.method !== 'place') {
    for (const edge of edges) {
      const snap = projectOnLine(endpoint.coordinate!, edge.coordinates);
      if (snap.distanceM <= ON_NETWORK_M) append(edge, snap, [snap.coordinate]);
    }
  }
  const entrances = (endpoint.entrances || []).filter(e => e && e.eligible === true && validCoordinate(e.coordinate) && insideBoundary(e.coordinate!, pack.boundary));
  for (const connector of [...pack.connectors].sort((a, b) => a.id.localeCompare(b.id))) {
    const edge = edgeMap.get(connector.edgeId);
    if (!edge || !connectorEligible(connector, pack, now) || (side === 'origin' ? connector.direction === 'edge_to_endpoint' : connector.direction === 'endpoint_to_edge')) continue;
    const entrance = endpoint.method === 'place' ? entrances.find(e => e.id === connector.entranceId && same(e.coordinate!, connector.endpointCoordinate)) : undefined;
    if (endpoint.method === 'place' ? !entrance : Boolean(connector.entranceId) || !same(endpoint.coordinate!, connector.endpointCoordinate)) continue;
    const snap = projectOnLine(connector.edgeCoordinate, edge.coordinates);
    if (endpoint.method !== 'place' && distance(endpoint.coordinate!, snap.coordinate) > MAX_SNAP_M) continue;
    append(edge, snap, connector.coordinates, connector, entrance);
  }
  return candidates;
}
function uncertainGps(endpoint: RouteEndpoint, candidates: Attachment[], pack: GraphPack, eligible: Set<string>): boolean {
  if (endpoint.method !== 'gps') return false;
  const radius = endpoint.accuracyM! + ON_NETWORK_M;
  return candidates.some(candidate => pack.edges.some(other => {
    if (other.id === candidate.edge.id || projectOnLine(endpoint.coordinate!, other.coordinates).distanceM > radius) return false;
    // Coincident/parallel paths and different grades cannot be disambiguated by a fix.
    return !eligible.has(other.id) || ![candidate.edge.from, candidate.edge.to].some(id => (id === other.from || id === other.to) && distance(endpoint.coordinate!, installed!.nodes.get(id)!.coordinate) <= radius);
  }));
}
/** Earliest pending review boundary, including connectors and individual graph records. */
export function nextGraphExpiry(now = Date.now()): number | null {
  if (!installed) return null;
  const { pack } = installed;
  const expiry = Date.parse(pack.review.validUntil);
  if (expiry <= now) return expiry;
  return [...pack.nodes, ...pack.edges, ...pack.connectors].reduce((next, record) => { const time = Date.parse(record.review?.validUntil); return Number.isFinite(time) && time > now ? Math.min(next, time) : next; }, expiry);
}
export async function calculateWalkingRoute(origin: RouteEndpoint, destination: RouteEndpoint, profile: 'walking' = 'walking'): Promise<RouteResult> {
  const now = Date.now();
  if (profile !== 'walking') return failure('unsupported_profile', 'Only the reviewed walking profile is supported.');
  for (const [endpoint, side] of [[origin, 'origin'], [destination, 'destination']] as const) { const invalid = validateEndpoint(endpoint, side, now); if (invalid) return invalid; }
  if (!installed) return failure('missing_graph', lastInstallReason);
  const { pack, nodes } = installed;
  if (!validReview(pack.review, now)) return failure('review_expired', 'Offline walking graph review has expired.');
  const edges = eligibleEdges(pack, nodes, now).sort((a, b) => a.id.localeCompare(b.id));
  const eligible = new Set(edges.map(edge => edge.id));
  const starts = attachments(origin, 'origin', pack, edges, now); const ends = attachments(destination, 'destination', pack, edges, now);
  for (const [endpoint, candidates, side] of [[origin, starts, 'origin'], [destination, ends, 'destination']] as const) {
    if (!candidates.length) return failure(`no_${side}_attachment`, `No current approved ${side} connection; choose a point on an approved path or an eligible entrance.`);
    if (uncertainGps(endpoint, candidates, pack, eligible)) return failure('gps_inaccurate', 'Location uncertainty spans incompatible walking paths; confirm a manual point.');
  }
  const positions = new Map([...nodes].map(([id, node]) => [id, node.coordinate]));
  const splits = new Map<string, Attachment[]>();
  for (const candidate of [...starts, ...ends]) { const list = splits.get(candidate.edge.id) || []; list.push(candidate); splits.set(candidate.edge.id, list); positions.set(candidate.id, candidate.snap.coordinate); }
  const arcs = installed.arcs.filter(arc => eligible.has(arc.edgeId) && !splits.has(arc.edgeId)).map(arc => ({ ...arc }));
  for (const edge of edges) {
    const candidates = splits.get(edge.id); if (!candidates) continue;
    const length = lineLength(edge.coordinates);
    const points = [{ id: edge.from, snap: { coordinate: edge.coordinates[0]!, distanceM: 0, alongM: 0, segment: 0 } }];
    for (const candidate of candidates.sort((a, b) => a.snap.alongM - b.snap.alongM || a.id.localeCompare(b.id))) {
      const previous = points[points.length - 1]!;
      if (Math.abs(candidate.snap.alongM - previous.snap.alongM) < 1e-8) candidate.id = previous.id;
      else { if (Math.abs(candidate.snap.alongM - length) < 1e-8) candidate.id = edge.to; points.push(candidate); }
      if (!positions.has(candidate.id)) positions.set(candidate.id, candidate.snap.coordinate);
    }
    if (points[points.length - 1]!.id !== edge.to) points.push({ id: edge.to, snap: { coordinate: edge.coordinates[edge.coordinates.length - 1]!, distanceM: 0, alongM: length, segment: edge.coordinates.length - 2 } });
    for (let i = 1; i < points.length; i++) arcs.push(...edgeArcs(edge, points[i - 1]!.id, points[i]!.id, sliceLine(edge.coordinates, points[i - 1]!.snap, points[i]!.snap)));
  }
  // Installation allows centimetre endpoint tolerances; retain the distance bound.
  for (const arc of arcs) arc.cost = Math.max(arc.cost, distance(positions.get(arc.from)!, positions.get(arc.to)!));
  for (const [candidates, side] of [[starts, 'origin'], [ends, 'destination']] as const) {
    for (const candidate of candidates) arcs.push({ from: side === 'origin' ? '@origin' : candidate.id, to: side === 'origin' ? candidate.id : '@destination', geometry: side === 'origin' ? candidate.geometry : [...candidate.geometry].reverse(), cost: lineLength(candidate.geometry), edgeId: '', label: 'the verified walking connection', attachment: candidate.metadata });
  }
  // A place has several possible entrances, so its centroid cannot be an A* target.
  const goals = ends.map(end => ({ coordinate: positions.get(end.id)!, cost: lineLength(end.geometry) }));
  const estimate = (id: string) => id === '@origin' || id === '@destination' ? 0 : goals.reduce((best, goal) => Math.min(best, distance(positions.get(id)!, goal.coordinate) + goal.cost), Infinity);
  const result = search(arcs, positions, '@origin', '@destination', true, estimate);
  if (!result) return failure('disconnected', 'No connected approved walking route is available.');
  const coordinates: Coordinate[] = [];
  for (const point of result.arcs.flatMap(arc => arc.geometry)) if (!coordinates.length || !same(coordinates[coordinates.length - 1]!, point)) coordinates.push(point);
  const instructions = result.arcs.filter((arc, i) => arc.geometry.length > 1 && (!i || result.arcs[i - 1]!.edgeId !== arc.edgeId)).map(arc => `Follow ${arc.label}.`);
  instructions.push(`Arrive at ${destination.label || 'the destination'}.`);
  return { available: true, coordinates, lengthM: lineLength(coordinates), instructions, graphVersion: pack.version, scopeId: pack.scopeId, originAttachment: result.arcs[0]!.attachment, destinationAttachment: result.arcs[result.arcs.length - 1]!.attachment };
}
export async function route(origin: Origin, entrance: Entrance): Promise<RouteResult> {
  return calculateWalkingRoute(origin, { coordinate: entrance.coordinate, method: 'place', confirmed: true, label: entrance.label, entrances: [entrance] });
}
export function wheelchairRoutingAvailable(): false { return false; }
