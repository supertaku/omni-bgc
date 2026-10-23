import type { Coordinate } from '../contracts';
import registry from './reviewed-scopes.json';
import coverage from '../../assets/generated/context/coverage.json';

export type ScopeGeometry =
  | {
      type: 'Polygon';
      coordinates: Coordinate[][];
    }
  | {
      type: 'MultiPolygon';
      coordinates: Coordinate[][][];
    };
export type MapScope = {
  id: string;
  manifestSha256: string;
  geometry: ScopeGeometry;
  contextGeometry?: ScopeGeometry;
  defaultView: { center: Coordinate; zoom: number; pitch: number; bearing: number };
  bounds: [Coordinate, Coordinate];
  navigationEligible: false;
};

/** Display extent is independent of approved place facts and future walking graphs. */
export type MapCoverage = {
  id: string;
  sourceScopeId: string;
  sourceScopeManifestSha256: string;
  sha256: string;
  serviceGeometry: ScopeGeometry;
  renderGeometry: ScopeGeometry;
  bounds: [Coordinate, Coordinate];
  buffer: { metres: number; crs: string; quadSegments: number };
  navigationEligible: false;
  placeFactsEligible: false;
};

export const bgcMapCoverage = coverage as unknown as MapCoverage;

function position(value: unknown): value is Coordinate {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v)) &&
    Math.abs(value[0] as number) <= 180 &&
    Math.abs(value[1] as number) <= 90
  );
}

/** Inclusive segment check with rounding tolerance only; never a snapping operation. */
function onSegment(p: Coordinate, a: Coordinate, b: Coordinate): boolean {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const px = p[0] - a[0],
    py = p[1] - a[1];
  const epsilon = Number.EPSILON * 32;
  return (
    Math.abs(dx * py - dy * px) <= epsilon * Math.max(Math.abs(dx), Math.abs(dy)) &&
    p[0] >= Math.min(a[0], b[0]) - epsilon &&
    p[0] <= Math.max(a[0], b[0]) + epsilon &&
    p[1] >= Math.min(a[1], b[1]) - epsilon &&
    p[1] <= Math.max(a[1], b[1]) + epsilon
  );
}

function ringMembership(point: Coordinate, ring: Coordinate[]): 'inside' | 'boundary' | 'outside' {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j]!,
      b = ring[i]!;
    if (onSegment(point, a, b)) return 'boundary';
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

/** Python/Shapely covers semantics: exterior and hole boundaries are inclusive. */
export function coversCoordinate(geometry: ScopeGeometry, point: Coordinate): boolean {
  if (!position(point)) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => {
    const outer = ringMembership(point, rings[0]!);
    if (outer === 'outside') return false;
    if (outer === 'boundary') return true;
    for (const hole of rings.slice(1)) {
      const state = ringMembership(point, hole);
      if (state === 'boundary') return true;
      if (state === 'inside') return false;
    }
    return true;
  });
}

export function coverageAt(scope: MapScope, point: Coordinate): 'service' | 'context' | 'outside' {
  if (coversCoordinate(scope.geometry, point)) return 'service';
  if (scope.contextGeometry && coversCoordinate(scope.contextGeometry, point)) return 'context';
  return 'outside';
}

/** The registry is compiled locally. Never adopt a polygon from a downloaded style. */
export function reviewedScope(id: unknown, manifestSha256?: unknown): MapScope {
  const scopes = registry.scopes as unknown as MapScope[];
  const scope = scopes.find((s) => s.id === id);
  if (
    !scope ||
    (manifestSha256 !== undefined && scope.manifestSha256 !== manifestSha256) ||
    (scope.id !== 'omni-bgc:service-area:high-street-pilot-v1' &&
      manifestSha256 !== scope.manifestSha256)
  ) {
    throw new Error('Map scope is not bound to the locally reviewed registry');
  }
  return scope;
}

export const pilotScope = reviewedScope('omni-bgc:service-area:high-street-pilot-v1');

export function scopeForStyle(
  style: string,
  expectedScopeId?: string,
  expectedHash?: string,
): MapScope {
  const parsed = JSON.parse(style) as {
    metadata?: { scopeId?: unknown; scopeManifestSha256?: unknown };
  };
  const id = parsed.metadata?.scopeId ?? expectedScopeId ?? pilotScope.id;
  const hash = parsed.metadata?.scopeManifestSha256 ?? expectedHash;
  if (expectedScopeId !== undefined && id !== expectedScopeId)
    throw new Error('Style and pack scope differ');
  if (expectedHash !== undefined && hash !== expectedHash)
    throw new Error('Style and pack scope hashes differ');
  if (
    id !== pilotScope.id &&
    (parsed.metadata?.scopeId === undefined || parsed.metadata?.scopeManifestSha256 === undefined)
  )
    throw new Error('Expanded style lacks scope binding');
  return reviewedScope(id, hash);
}
