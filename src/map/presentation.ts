import type { Coordinate, Place } from '../contracts';
import landmarks from './landmarks.json';

const significantNames = new Set(landmarks.entries.map((entry) => entry.name));
const facadeTextures = [
  'facade-glass-office',
  'fort-facade-glass-blue',
  'facade-glass-office-alt',
  'fort-facade-glass-teal',
  'facade-midrise-office',
  'fort-facade-glass-blue',
  'facade-midrise-office-alt',
  'fort-facade-glass-teal',
  'facade-residential',
  'fort-facade-residential-warm',
  'facade-residential-alt',
  'fort-facade-residential-cool',
  'facade-mixed-use',
  'fort-facade-mixed-sand',
  'facade-mixed-use-alt',
  'fort-facade-retail-bronze',
  'facade-commercial',
  'fort-facade-retail-bronze',
  'facade-commercial-alt',
  'fort-facade-mixed-sand',
  'facade-lowrise-retail',
  'fort-facade-retail-bronze',
  'facade-lowrise-retail-alt',
  'fort-facade-mixed-sand',
  'facade-mall',
  'fort-facade-mixed-sand',
  'facade-mall-alt',
  'fort-facade-retail-bronze',
  'facade-civic',
  'fort-facade-masonry-light',
  'facade-civic-alt',
  'fort-facade-masonry-light',
  'facade-hotel',
  'fort-facade-hotel-slate',
  'facade-hotel-alt',
  'fort-facade-hotel-slate',
  'facade-unknown',
  'fort-facade-neutral-slate',
  'facade-unknown-alt',
  'fort-facade-neutral-sand',
];

/** Presentation mode only; retain exact resource/source fields and layer order. */
export function renderMapStyle(activeStyle: string, flat: boolean, quiet: boolean): string {
  const style = JSON.parse(activeStyle);
  let changed = false;
  for (const layer of style.layers ?? []) {
    if (!flat && !quiet && layer.type === 'fill-extrusion' && layer.id === 'buildings-2.5D') {
      // Keep the full source-derived massing at overview zooms instead of
      // flattening buildings between z15 and z16. Facades take over at z15.5.
      layer.minzoom = Math.min(layer.minzoom ?? 14, 14);
      layer.maxzoom = 15.5;
      layer.paint = {
        ...layer.paint,
        'fill-extrusion-height': ['get', 'visual_height'],
        'fill-extrusion-base': ['get', 'visual_base'],
        'fill-extrusion-vertical-gradient': true,
      };
      changed = true;
    }
    if (!flat && !quiet && layer.id === 'buildings-facades') {
      layer.minzoom = 15.5;
      layer.paint = {
        ...layer.paint,
        'fill-extrusion-pattern': [
          'match',
          ['get', 'facade_pattern'],
          ...facadeTextures,
          'fort-facade-neutral-slate',
        ],
        'fill-extrusion-vertical-gradient': false,
      };
      changed = true;
    }
    if (!flat && !quiet && layer.id === 'building-roof-caps') {
      layer.minzoom = 15.5;
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
