import type { Coordinate } from '../contracts';

export function categorySprite(category: string): string {
  const value = category.toLowerCase();
  if (/restaurant|food|dining|eat|bakery/.test(value)) return 'marker-food';
  if (/cafe|café|coffee/.test(value)) return 'marker-cafe';
  if (/shop|mall|retail/.test(value)) return 'marker-shop';
  if (/parking/.test(value)) return 'marker-parking';
  if (/park|garden|green/.test(value)) return 'marker-park';
  if (/transit|bus|station/.test(value)) return 'marker-transit';
  if (/hotel|lodging/.test(value)) return 'marker-hotel';
  if (/hospital|clinic|health|pharmacy/.test(value)) return 'marker-health';
  if (/office|work|building/.test(value)) return 'marker-work';
  if (/landmark|museum|civic/.test(value)) return 'marker-landmark';
  return 'marker-more';
}
export function coordinateBounds(coordinates: readonly Coordinate[]): [number, number, number, number] | null {
  const valid = coordinates.filter(c => Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90);
  if (!valid.length) return null;
  const xs = valid.map(c => c[0]); const ys = valid.map(c => c[1]);
  const west = Math.min(...xs); const south = Math.min(...ys);
  const east = Math.max(...xs); const north = Math.max(...ys);
  // A nonzero envelope makes single-stop itineraries safe for native bounds fitting.
  return [west - (west === east ? 0.00015 : 0), south - (south === north ? 0.00015 : 0), east + (west === east ? 0.00015 : 0), north + (south === north ? 0.00015 : 0)];
}
