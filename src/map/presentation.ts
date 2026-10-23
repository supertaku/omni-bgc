import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Coordinate, Place } from '../contracts';
import landmarks from './landmarks.json';

const significantNames = new Set(landmarks.entries.map((entry) => entry.name));
// Original game-map palette; source families choose styling, never geographic identity.
export const illustratedRoofColor: ExpressionSpecification = [
  'match',
  ['get', 'visual_family'],
  ['office', 'offices'],
  '#397B78',
  ['commercial', 'retail', 'mall', 'supermarket'],
  '#C18A48',
  ['residential', 'apartments', 'mixed-use'],
  '#527345',
  'hotel',
  '#984C51',
  ['school', 'university', 'college', 'institutional'],
  '#426F50',
  ['hospital', 'healthcare'],
  '#759BA0',
  ['transportation', 'train_station', 'station'],
  '#947A56',
  ['parking', 'garages'],
  '#727A82',
  ['civic', 'public', 'government'],
  '#927251',
  '#4C796B',
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
    if (layer.id === 'canvas') layer.paint['background-color'] = flat ? '#D8DAB5' : '#EAE1C8';
    if (layer.id === 'gardens') layer.paint['fill-color'] = flat ? '#82AC57' : '#91B567';
    if (layer.id === 'garden-texture') {
      layer.minzoom = 15;
      layer.paint['fill-opacity'] = flat ? 0.55 : 0.4;
    }
    if (layer.id === 'plazas') {
      layer.paint['fill-color'] = '#E3CB96';
      layer.paint['fill-outline-color'] = '#B49E76';
    }
    if (layer.id === 'building-footprints') {
      layer.paint['fill-color'] = illustratedRoofColor;
      layer.paint['fill-outline-color'] = '#304E45';
    }
    if (layer.id === 'building-edges') {
      layer.minzoom = 15;
      layer.paint['line-color'] = '#304E45';
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
    if (layer.id === 'street-edge') layer.paint['line-color'] = '#C5BEA6';
    if (layer.id === 'street') layer.paint['line-color'] = flat ? '#666D68' : '#626E70';
    if (layer.id === 'path-edge') {
      layer.minzoom = 14.5;
      layer.paint['line-color'] = '#AEAA90';
    }
    if (layer.id === 'walkways') {
      layer.minzoom = 14.5;
      layer.paint['line-color'] = [
        'match',
        ['get', 'surface'],
        'asphalt',
        '#929A90',
        'concrete',
        '#E3DEC7',
        ['paving_stones', 'tiles'],
        '#DCCC9C',
        '#E4D3A5',
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
      layer.paint['text-color'] = '#30473C';
      layer.paint['text-halo-color'] = '#F2EDD9';
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
