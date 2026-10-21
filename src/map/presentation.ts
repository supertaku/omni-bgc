import type { Coordinate, Place } from '../contracts';
import landmarks from './landmarks.json';

const significantNames = new Set(landmarks.entries.map((entry) => entry.name));
/** Presentation mode only; retain exact resource/source fields and layer order. */
export function renderMapStyle(activeStyle: string, flat: boolean, quiet: boolean): string {
  const style = JSON.parse(activeStyle);
  let changed = false;
  for (const layer of style.layers ?? []) {
    if (!flat && !quiet && layer.type === 'fill-extrusion' && layer.id === 'buildings-2.5D') {
      layer.minzoom = 14;
      delete layer.maxzoom;
      layer.paint = {
        ...layer.paint,
        'fill-extrusion-height': ['get', 'visual_height'],
        'fill-extrusion-base': ['get', 'visual_base'],
        'fill-extrusion-color': [
          'match', ['get', 'visual_family'],
          'office', '#B9C7C9', 'commercial', '#C9C4B8',
          'residential', '#C8BFB2', 'mixed-use', '#C5C3B8',
          'retail', '#CDBFAE', 'hotel', '#B8C1C8',
          'civic', '#C6C8C2', '#BEC5C4',
        ],
        'fill-extrusion-vertical-gradient': true,
      };
      changed = true;
    }
    if (!flat && !quiet && layer.id === 'buildings-facades') {
      layer.layout = { ...layer.layout, visibility: 'none' };
      changed = true;
    }
    if (!flat && !quiet && layer.id === 'building-roof-caps') {
      layer.minzoom = 17;
      layer.paint = {
        ...layer.paint,
        'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 17, 0, 19, 1],
      };
      changed = true;
    }
    if (layer.id === 'road-labels') {
      layer.minzoom = 18;
      layer.layout = { ...layer.layout, 'text-size': 10, 'text-padding': 20 };
      changed = true;
    }
    if (layer.id === 'street-edge') {
      layer.paint = { ...layer.paint, 'line-color': '#A9AAA3' };
      changed = true;
    }
    if (layer.id === 'street') {
      layer.paint = {
        ...layer.paint,
        'line-color': [
          'match',
          ['get', 'highway'],
          'primary',
          '#505E68',
          'secondary',
          '#596671',
          'tertiary',
          '#63717A',
          'residential',
          '#6B7880',
          'service',
          '#879198',
          '#66737C',
        ],
      };
      changed = true;
    }
    if (layer.id === 'path-edge') {
      layer.minzoom = 14.5;
      changed = true;
    }
    if (layer.id === 'walkways') {
      layer.minzoom = 14.5;
      layer.paint = {
        ...layer.paint,
        'line-color': [
          'match',
          ['get', 'surface'],
          'asphalt',
          '#92999A',
          'concrete',
          '#E5E1D8',
          'paving_stones',
          '#DCCFBB',
          'tiles',
          '#DCCFBB',
          '#E3DAC9',
        ],
      };
      changed = true;
    }
    if (layer.id === 'source-crosswalks') {
      layer.minzoom = 17;
      layer.paint = {
        ...layer.paint,
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['linear'], ['zoom'], 17, 4, 20, 12],
        'line-dasharray': [0.8, 0.9],
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
          important:
            significantNames.has(p.name) ||
            /hospital|health|mall|park|garden|transit|station|landmark|museum|civic/i.test(
              p.category,
            ),
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
