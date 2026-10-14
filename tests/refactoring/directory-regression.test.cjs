const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { loadTs } = require('../helpers/load-ts.cjs');

test('all 120 accepted directory observations retain exact deterministic payloads', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-r1-directory-'));
  try {
    execFileSync(process.execPath, ['tests/ai/deterministic-baseline.cjs', output], { cwd: path.resolve(__dirname, '../..') });
    const bytes = fs.readFileSync(path.join(output, 'deterministic-observations.jsonl'));
    assert.equal(bytes.toString().trim().split('\n').length, 120);
    // Frozen at 7b468f3 before refactoring; update only after explicit behavior review.
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '722068e60732a5c72da4416b353550ff765dd030bb14979ae7b3358296d98a30');
  } finally {
    assert.equal(path.dirname(path.resolve(output)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(output).startsWith('omni-r1-directory-'));
    fs.rmSync(output, { recursive: true, force: true });
  }
});

test('Explore NFC/category rules and Assistant NFKC/vocabulary remain distinct', () => {
  const explore = loadTs('apps/mobile/src/features/explore/directory.ts', { '../../../assets/generated/directory/places.json': [], './demoDirectory': { demoPlaces: [] } });
  const assistant = loadTs('apps/mobile/src/features/assistant/directory.ts', { '../explore/demoDirectory': { isDemoPlace: () => false } });
  const place = category => ({ id: 'TEST', name: 'Test coffee', category, aliases: [], menus: [], coordinate: null, citations: [], status: 'candidate', entrances: [] });
  const bakery = place('bakery');
  assert.equal(explore.matchesCategory(bakery, 'Coffee'), true);
  assert.equal(assistant.placeMatchesCategory(bakery, 'coffee'), false);
  assert.equal(explore.searchDirectory([place('Coffee')], 'ＣＯＦＦＥＥ', 'All').length, 0);
  assert.equal(assistant.answerDirectoryQuery('ＣＯＦＦＥＥ', [place('Coffee')], { placeIds: [], itinerary: [], startTime: null }).find(p => p.kind === 'places').total, 1);
  for (const [category, requested] of [['Restaurant', 'food'], ['CAFÉ', 'coffee'], ['Retail', 'shop'], ['Garden', 'park'], ['Public restroom', 'facility']]) assert.equal(assistant.placeMatchesCategory(place(category), requested), true);
  assert.equal(assistant.placeMatchesCategory(place(''), 'coffee'), false);
  assert.equal(assistant.placeMatchesCategory(place('unknown'), 'unsupported'), false);
});
