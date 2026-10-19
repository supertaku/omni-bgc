import type { Coordinate, Place } from '../contracts';

/** Presentation mode only; retain exact resource/source fields and layer order. */
export function renderMapStyle(activeStyle: string, flat: boolean, quiet: boolean): string {
  const style = JSON.parse(activeStyle);
  let changed = false;
  for (const layer of style.layers ?? []) {
    if (!flat && !quiet && layer.type === 'fill-extrusion' && layer.id === 'buildings-2.5D') {
      // Keep the full source-derived massing at overview zooms instead of
      // flattening buildings between z15 and z16. Facades take over at z16.
      layer.minzoom = Math.min(layer.minzoom ?? 14, 14);
      layer.paint = {
        ...layer.paint,
        'fill-extrusion-height': ['get', 'visual_height'],
        'fill-extrusion-base': ['get', 'visual_base'],
      };
      changed = true;
    }
    if (
      ((flat || quiet) && layer.type === 'fill-extrusion') ||
      (quiet &&
        [
          'source-trees',
          'garden-texture',
          'plaza-paving',
          'source-pavement-pattern',
          'source-crosswalks',
          'illustrative-pedestrians',
        ].includes(layer.id))
    ) {
      layer.layout = { ...layer.layout, visibility: 'none' };
      changed = true;
    }
  }
  return changed ? JSON.stringify(style) : activeStyle;
}

export function placeFeatureCollection(places: Place[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: places
      .filter((p) => p.coordinate)
      .map((p) => ({
        type: 'Feature',
        id: p.id,
        properties: {
          id: p.id,
          name: p.name,
          category: p.category,
          marker: categorySprite(p.category),
        },
        geometry: { type: 'Point', coordinates: [...p.coordinate!] },
      })),
  };
}

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
export function coordinateBounds(
  coordinates: readonly Coordinate[],
): [number, number, number, number] | null {
  const valid = coordinates.filter(
    (c) =>
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1]) &&
      Math.abs(c[0]) <= 180 &&
      Math.abs(c[1]) <= 90,
  );
  if (!valid.length) return null;
  const xs = valid.map((c) => c[0]);
  const ys = valid.map((c) => c[1]);
  const west = Math.min(...xs);
  const south = Math.min(...ys);
  const east = Math.max(...xs);
  const north = Math.max(...ys);
  // A nonzero envelope makes single-stop itineraries safe for native bounds fitting.
  return [
    west - (west === east ? 0.00015 : 0),
    south - (south === north ? 0.00015 : 0),
    east + (west === east ? 0.00015 : 0),
    north + (south === north ? 0.00015 : 0),
  ];
}
