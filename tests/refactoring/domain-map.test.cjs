const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { parsePhpCentavos } = loadTs('apps/mobile/src/domain/money.ts');
const { renderMapStyle, placeFeatureCollection } = loadTs('apps/mobile/src/map/presentation.ts');

test('PHP uses integer centavos at all supported boundaries and rejects unsupported syntax', () => {
  for (const [value, expected] of [['0', 0n], ['1', 100n], ['01.2', 120n], ['0.30', 30n], ['999999999999.99', 99999999999999n]]) assert.equal(parsePhpCentavos(value), expected);
  for (const value of ['', '-1', '+1', '.30', '1.', '1.001', '1e3', 'NaN', 'Infinity', '1,000', 'PHP 1', '₱1', 'USD 1', ' 1', '1 ', '１', '9'.repeat(13), '9'.repeat(10000), null, 1]) assert.equal(parsePhpCentavos(value), null);
});

test('style display modes preserve resources, ordering, paint and independent layout properties', () => {
  const style = { version: 8, glyphs: 'file:///TEST/glyphs/{fontstack}/{range}.pbf', sprite: 'file:///TEST/sprites', sources: { TEST: { type: 'vector', url: 'pmtiles://file:///TEST/tiles.pmtiles' } }, layers: [{ id: 'canvas', type: 'background' }, { id: 'illustrative-pedestrians', type: 'symbol', layout: { 'icon-size': 0.5 } }, { id: 'building', type: 'fill-extrusion', paint: { 'fill-extrusion-height': 10 }, layout: { visibility: 'visible' } }] };
  const input = JSON.stringify(style);
  assert.equal(renderMapStyle(input, false, false), input);
  for (const [flat, quiet] of [[true, false], [false, true], [true, true]]) {
    const result = JSON.parse(renderMapStyle(input, flat, quiet));
    assert.deepEqual(result.sources, style.sources); assert.equal(result.glyphs, style.glyphs); assert.equal(result.sprite, style.sprite);
    assert.deepEqual(result.layers.map(layer => layer.id), style.layers.map(layer => layer.id));
    assert.deepEqual(result.layers[2].paint, style.layers[2].paint); assert.equal(result.layers[2].layout.visibility, 'none');
    assert.equal(result.layers[1].layout['icon-size'], 0.5); assert.equal(result.layers[1].layout.visibility, quiet ? 'none' : undefined);
  }
  assert.equal(JSON.stringify(style), input);
});

test('POI features retain order/identity and copy coordinates without creating locations', () => {
  const places = [{ id: 'TEST1', name: 'TEST coffee', category: 'Coffee', coordinate: [0.125, 0.25] }, { id: 'TEST2', name: 'Unlocated TEST', category: 'Food', coordinate: null }, { id: 'TEST3', name: 'TEST shop', category: 'Shops', coordinate: [-0.25, -0.125] }];
  const result = JSON.parse(JSON.stringify(placeFeatureCollection(places)));
  assert.equal(result.type, 'FeatureCollection'); assert.deepEqual(result.features.map(f => f.id), ['TEST1', 'TEST3']);
  assert.equal(result.features[0].properties.marker, 'marker-cafe'); assert.equal(result.features[1].properties.marker, 'marker-shop');
  assert.deepEqual(result.features[0].geometry.coordinates, places[0].coordinate);
  result.features[0].geometry.coordinates[0] = 99; assert.equal(places[0].coordinate[0], 0.125);
});
