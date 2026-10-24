import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Coordinate, Place } from '../contracts';
import landmarks from './landmarks.json';

const significantNames = new Set(landmarks.entries.map((entry) => entry.name));
// Original illustrated city palette: glass, stone and brick roofs; green is reserved for landscaping.
export const illustratedRoofColor: ExpressionSpecification = [
  'match',
  ['get', 'visual_family'],
  ['office', 'offices', 'glass-office'],
  '#5789B0',
  'midrise-office',
  '#7898B6',
  ['commercial', 'retail', 'lowrise-retail', 'mall', 'supermarket'],
  '#C8A17A',
  ['residential', 'apartments', 'mixed-use'],
  '#9B94B5',
  'hotel',
  '#A68BAA',
  ['school', 'university', 'college', 'institutional'],
  '#AD7370',
  ['hospital', 'healthcare'],
  '#8BAFC2',
  ['transportation', 'train_station', 'station'],
  '#7F91A1',
  ['parking', 'garages'],
  '#8B909A',
  ['civic', 'public', 'government'],
  '#C0AF95',
  // Decorative materials only: an unknown building's identity and height remain unknown.
  ['match', ['%', ['abs', ['to-number', ['get', 'osm_id'], 0]], 4],
    1, '#83A7C4', 2, '#D1C6AE', 3, '#B4A6C4', '#D8D5C9'],
];

/** Independent presentation revisions share exact geographic resources and layer order. */
export function renderMapStyle(activeStyle: string, flat: boolean, quiet: boolean): string {
  const style = JSON.parse(activeStyle);
  if (style.version !== 8 || !Array.isArray(style.layers) || !style.sources)
    throw new Error('Unsupported offline map style');
  style.metadata = {
    ...style.metadata,
    omniPresentation: flat ? 'flat-v1' : 'illustrated-v1',
    omniQuiet: quiet,
  };
  for (const layer of style.layers) {
    layer.paint = { ...layer.paint };
    if (layer.type === 'fill-extrusion') {
      // Constant opacity avoids native-version differences in animated extrusion opacity.
      layer.paint['fill-extrusion-opacity'] = 1;
      if (flat || quiet) layer.layout = { ...layer.layout, visibility: 'none' };
    }
    if (layer.id === 'canvas') layer.paint['background-color'] = flat ? '#DCDAD1' : '#E4E0D6';
    if (layer.id === 'gardens') layer.paint['fill-color'] = flat ? '#82AC57' : '#91B567';
    if (layer.id === 'garden-texture') {
      layer.minzoom = 15;
      layer.paint['fill-opacity'] = flat ? 0.55 : 0.4;
    }
    if (layer.id === 'plazas') {
      layer.paint['fill-color'] = '#D6CDBC';
      layer.paint['fill-outline-color'] = '#ADA69A';
    }
    if (layer.id === 'building-footprints') {
      layer.paint['fill-color'] = illustratedRoofColor;
      layer.paint['fill-outline-color'] = '#425062';
    }
    if (layer.id === 'building-edges') {
      layer.minzoom = 15;
      layer.paint['line-color'] = '#425062';
      layer.paint['line-width'] = [
        'interpolate',
        ['linear'],
        ['zoom'],
        15,
        0.5,
        19,
        flat ? 1.8 : 1.1,
      ];
    }
    if (layer.id === 'buildings-2.5D') {
      layer.minzoom = 14;
      delete layer.maxzoom;
      layer.paint['fill-extrusion-height'] = ['get', 'visual_height'];
      layer.paint['fill-extrusion-base'] = ['get', 'visual_base'];
      layer.paint['fill-extrusion-color'] = illustratedRoofColor;
      layer.paint['fill-extrusion-vertical-gradient'] = true;
    }
    if (layer.id === 'buildings-facades') layer.minzoom = 18;
    if (layer.id === 'building-roof-caps') {
      layer.minzoom = 14;
      layer.paint['fill-extrusion-color'] = illustratedRoofColor;
    }
    if (layer.id === 'street-edge') layer.paint['line-color'] = '#C8C6BE';
    if (layer.id === 'street') layer.paint['line-color'] = flat ? '#6D727A' : '#68727E';
    if (layer.id === 'path-edge') {
      layer.minzoom = 14.5;
      layer.paint['line-color'] = '#B4B1A8';
    }
    if (layer.id === 'walkways') {
      layer.minzoom = 14.5;
      layer.paint['line-color'] = [
        'match',
        ['get', 'surface'],
        'asphalt',
        '#949AA0',
        'concrete',
        '#DFDDD5',
        ['paving_stones', 'tiles'],
        '#D5CDBF',
        '#DDD6C8',
      ];
    }
    if (layer.id === 'source-crosswalks') {
      layer.minzoom = 17;
      layer.paint['line-width'] = ['interpolate', ['linear'], ['zoom'], 17, 4, 20, 12];
    }
    if (layer.id === 'source-trees') {
      layer.minzoom = 16;
      layer.layout = { ...layer.layout, 'icon-pitch-alignment': 'map' };
    }
    if (layer.id === 'road-labels') {
      layer.minzoom = 17;
      layer.layout = { ...layer.layout, 'text-size': 10, 'text-padding': 20 };
      layer.paint['text-color'] = '#364657';
      layer.paint['text-halo-color'] = '#F0EEE6';
    }
    if (
      quiet &&
      [
        'source-trees',
        'garden-texture',
        'plaza-paving',
        'source-pavement-pattern',
        'illustrative-pedestrians',
      ].includes(layer.id)
    )
      layer.layout = { ...layer.layout, visibility: 'none' };
  }
  return JSON.stringify(style);
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
