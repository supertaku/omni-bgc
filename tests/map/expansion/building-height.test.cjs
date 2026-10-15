const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadTs } = require('../../helpers/load-ts.cjs');
const { renderMapStyle } = loadTs('apps/mobile/src/map/presentation.ts');

test('reviewed district buildings retain full height throughout overview zooms and facade transition', () => {
  const input = fs.readFileSync('apps/mobile/src/map/expanded-style.json', 'utf8');
  const source = JSON.parse(input);
  const rendered = JSON.parse(renderMapStyle(input, false, false));
  const feature = { visual_height: 118.5, visual_base: 24 };
  const evaluate = expression => typeof expression === 'number'
    ? expression
    : expression[0] === 'get' ? feature[expression[1]]
      : expression[0] === '+' ? evaluate(expression[1]) + evaluate(expression[2])
        : assert.fail('Building height must not vary with camera zoom');
  for (const zoom of [14, 14.9, 15, 15.2, 15.9, 16, 18, 20]) {
    const body = rendered.layers.filter(layer => ['buildings-2.5D', 'buildings-facades'].includes(layer.id)
      && (layer.minzoom ?? 0) <= zoom && (layer.maxzoom ?? Infinity) > zoom);
    assert.equal(body.length, 1, `one building body at z${zoom}`);
    assert.equal(evaluate(body[0].paint['fill-extrusion-height']), 118.5, `full height at z${zoom}`);
    assert.equal(evaluate(body[0].paint['fill-extrusion-base']), 24, `full base at z${zoom}`);
  }
  assert.deepEqual(rendered.sources, source.sources);
  assert.equal(rendered.sprite, source.sprite);
  assert.equal(rendered.glyphs, source.glyphs);
  assert.deepEqual(rendered.metadata, source.metadata);
  assert.deepEqual(rendered.layers.map(layer => layer.id), source.layers.map(layer => layer.id));
  for (const layer of source.layers.filter(layer => layer.id !== 'buildings-2.5D')) {
    assert.deepEqual(rendered.layers.find(result => result.id === layer.id), layer);
  }
  assert.equal(fs.readFileSync('apps/mobile/src/map/expanded-style.json', 'utf8'), input);
});

test('explicit flat and navigation modes continue to hide all building extrusions', () => {
  const input = fs.readFileSync('apps/mobile/src/map/expanded-style.json', 'utf8');
  for (const [flat, quiet] of [[true, false], [false, true], [true, true]]) {
    const rendered = JSON.parse(renderMapStyle(input, flat, quiet));
    assert.ok(rendered.layers.filter(layer => layer.type === 'fill-extrusion')
      .every(layer => layer.layout.visibility === 'none'));
  }
});
