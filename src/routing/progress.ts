/** Pure in-memory progress matching; callers own ephemeral state. No GPS storage. */
import { distance, lineLength, projectOnLine, validCoordinate, type Coordinate } from './engine';
export type ProgressState = { routeVersion: string; alongM: number; segment: number; offRoute: boolean; offRouteFixes: number; onRouteFixes: number; lastObservedAt?: string };
export type ProgressFix = { coordinate: Coordinate; accuracyM: number; observedAt: string };
export type ProgressResult = { state: ProgressState; accepted: boolean; reason: string | null; remainingM: number };
export function matchProgress(coordinates: readonly Coordinate[], version: string, fix: ProgressFix, previous: ProgressState | null = null, now = Date.now()): ProgressResult {
  const initial: ProgressState = previous?.routeVersion === version ? { ...previous } : { routeVersion: version, alongM: 0, segment: 0, offRoute: false, offRouteFixes: 0, onRouteFixes: 0 };
  const length = coordinates.length >= 2 && coordinates.every(validCoordinate) ? lineLength(coordinates) : 0;
  const refused = (reason: string): ProgressResult => ({ state: initial, accepted: false, reason, remainingM: Math.max(0, length - initial.alongM) });
  if (coordinates.length < 2 || !coordinates.every(validCoordinate) || !validCoordinate(fix.coordinate)) return refused('Invalid route or position.');
  const observed = Date.parse(fix.observedAt);
  if (!Number.isFinite(fix.accuracyM) || fix.accuracyM < 0 || fix.accuracyM > 20 || !Number.isFinite(observed) || now - observed > 60000 || observed > now + 5000) return refused('Position is stale or inaccurate.');
  if (initial.lastObservedAt && observed <= Date.parse(initial.lastObservedAt)) return refused('Position is a duplicate or older fix.');
  // Local progress window avoids jumping between geometrically close parallel legs.
  const candidates = [];
  let cumulative = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const segment = [coordinates[i - 1]!, coordinates[i]!] as const;
    const p = projectOnLine(fix.coordinate, segment);
    const alongM = cumulative + p.alongM;
    if (!previous || previous.routeVersion !== version || (alongM >= initial.alongM - 10 && alongM <= initial.alongM + 80)) candidates.push({ ...p, alongM, segment: i - 1 });
    cumulative += distance(segment[0], segment[1]);
  }
  candidates.sort((a, b) => a.distanceM - b.distanceM || Math.abs(a.alongM - initial.alongM) - Math.abs(b.alongM - initial.alongM) || a.segment - b.segment);
  const match = candidates[0];
  const threshold = Math.max(8, Math.min(15, fix.accuracyM));
  const onRoute = Boolean(match && match.distanceM <= threshold);
  const state = { ...initial, lastObservedAt: fix.observedAt, offRouteFixes: onRoute ? 0 : initial.offRouteFixes + 1, onRouteFixes: onRoute ? initial.onRouteFixes + 1 : 0 };
  if (state.offRouteFixes >= 3) state.offRoute = true;
  if (state.onRouteFixes >= 2) state.offRoute = false;
  if (onRoute && match) {
    // Accepted local backward jitter never decreases reported progress.
    state.alongM = Math.max(initial.alongM, match.alongM);
    state.segment = match.segment;
  }
  return { state, accepted: true, reason: state.offRoute ? 'Position is off the approved route.' : null, remainingM: Math.max(0, length - state.alongM) };
}
