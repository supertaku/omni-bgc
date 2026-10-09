import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Deliberately narrow M0 contract: no sources or external resources of any kind.
export function assertLocalStyle(style) {
  for (const key of Object.keys(style)) assert.ok(['version', 'name', 'sources', 'layers'].includes(key), `unsupported M0 root key: ${key}`);
  assert.equal(style.version, 8);
  assert.equal(Object.keys(style.sources).length, 0, 'M0 accepts only an empty local map');
  assert.equal(style.glyphs, undefined, 'external/local glyph delivery belongs to M5');
  assert.equal(style.sprite, undefined, 'sprite delivery belongs to M5');
  assert.equal(style.layers.length, 1);
  assert.equal(style.layers[0].type, 'background');
  for (const key of Object.keys(style.layers[0])) assert.ok(['id', 'type', 'paint'].includes(key), `unsupported M0 layer key: ${key}`);
  assert.deepEqual(Object.keys(style.layers[0].paint), ['background-color']);
  assert.match(style.layers[0].paint['background-color'], /^#[0-9a-f]{6}$/i);
  assert.ok(!JSON.stringify(style).match(/(?:https?:|mapbox:|pmtiles:|file:)/i));
}
const style = JSON.parse(readFileSync(new URL('../fixtures/local-style.json', import.meta.url), 'utf8'));
assertLocalStyle(style);
for (const invalid of [
  { ...style, sources: { demo: { type: 'vector', url: 'https://example.invalid/tiles' } } },
  { ...style, glyphs: 'https://example.invalid/{fontstack}/{range}.pbf' },
  { ...style, sprite: 'https://example.invalid/sprite' },
]) assert.throws(() => assertLocalStyle(invalid));
console.log('PASS: local background style; external source/glyph/sprite negative cases rejected');
