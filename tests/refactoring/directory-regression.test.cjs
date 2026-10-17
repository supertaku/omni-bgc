const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { loadTs } = require('../helpers/load-ts.cjs');

test('all 120 directory cases retain reviewed U3 payloads and historical evidence fields', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-r1-directory-'));
  try {
    execFileSync(process.execPath, ['tests/ai/deterministic-baseline.cjs', output], { cwd: path.resolve(__dirname, '../..') });
    const bytes = fs.readFileSync(path.join(output, 'deterministic-observations.jsonl'));
    assert.equal(bytes.toString().trim().split('\n').length, 120);
    // Reviewed U3: casual copy, model-required itinerary previews and removed saves.
    // Preserve the original 7b468f3 snapshot/hash; evidence and warnings still carry over.
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '2daac1a9c7d5bfe2afc51cb3a7ca5275bcb41e7eace5091b288e277be4f04b2b');
    const historicalText = fs.readFileSync(path.resolve(__dirname, '../../docs/evaluations/offline-ai/deterministic-observations.jsonl'), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(crypto.createHash('sha256').update(historicalText).digest('hex'), '722068e60732a5c72da4416b353550ff765dd030bb14979ae7b3358296d98a30');
    const historical = historicalText.trim().split('\n').map(line => JSON.parse(line));
    const current = bytes.toString().trim().split('\n').map(line => JSON.parse(line));
    const removedSaveCases = new Set(['followups-09', 'followups-10', 'prompt_injection-03']);
    const withoutProse = observation => Object.fromEntries(Object.entries(observation).filter(([key]) => key !== 'text'));
    for (let index = 0; index < historical.length; index++) {
      const before = historical[index], after = current[index];
      assert.equal(after.questionId, before.questionId);
      const expected = withoutProse(before);
      if (removedSaveCases.has(before.questionId)) {
        assert.equal(before.action, 'list_saved');
        assert.deepEqual(before.entityIds, ['syn-blue']);
        expected.action = 'unavailable';
        expected.entityIds = [];
      }
      assert.deepEqual(withoutProse(after), expected, `${before.questionId}: preserve warnings, lineage, items and remaining actions`);
    }
  } finally {
    assert.equal(path.dirname(path.resolve(output)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(output).startsWith('omni-r1-directory-'));
    fs.rmSync(output, { recursive: true, force: true });
  }
});

test('Explore NFC/category rules and Assistant NFKC/vocabulary remain distinct', () => {
  const explore = loadTs('apps/mobile/src/features/explore/directory.ts', { '../../../assets/generated/directory/places.json': [], './demoDirectory': { demoPlaces: [] }, '../food/directory': { foodPlaces: [], foodSearchText: () => [] } });
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
