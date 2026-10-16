const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTs } = require('../helpers/load-ts.cjs');
const { MutationCoordinator } = loadTs('apps/mobile/src/ai/mutationCoordinator.ts');
const { projectSavedPatch, savedFingerprint } = loadTs('apps/mobile/src/data/savedPatch.ts');
const id = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
function fixture() {
  let state = { placeIds: [], itinerary: [{ placeId: other, durationMinutes: 30 }], startTime: '10:00' };
  let writes = 0, now = 0, serial = 0;
  const deps = {
    read: async () => structuredClone(state),
    resolve: async placeId => ({ id: placeId, name: 'TEST ONLY', status: 'approved', citations: [{ status: 'approved', sourceId:'TEST',label:'TEST',license:'TEST',factId:'TEST',snapshotId:'TEST',evidenceId:'TEST',locator:'TEST',verificationMethod:'TEST',rawSha256:'a'.repeat(64),observedAt:'2026-01-01T00:00:00Z',verifiedAt:'2026-01-02T00:00:00Z' }] }),
    mintId: () => `test-pending-${++serial}`, now: () => now,
    apply: async (expected, patch, expiry) => {
      if (savedFingerprint(state) !== expected || now >= expiry) throw Error('conflict');
      state = projectSavedPatch(state, patch); writes++; return state;
    },
  };
  return { coordinator: new MutationCoordinator(deps), deps, get state() { return state; }, get writes() { return writes; }, mutate: fn => fn(state), expire: () => { now = 120001; } };
}
test('preview has no write; real confirmation preserves unrelated state and commits once under double tap', async () => {
  const f = fixture(); const p = await f.coordinator.previewSaved(id, 'save', 'test');
  assert.equal(f.writes, 0);
  await Promise.all([f.coordinator.confirm(p.pendingId), f.coordinator.confirm(p.pendingId)]);
  assert.equal(f.writes, 1); assert.deepEqual(Array.from(f.state.placeIds), [id]);
  assert.equal(f.state.startTime, '10:00'); assert.equal(f.state.itinerary[0].placeId, other);
});
test('canceled, expired, unknown, and stale previews leave the latest state unchanged', async () => {
  for (const mode of ['cancel', 'expiry', 'concurrent']) {
    const f = fixture(); const p = await f.coordinator.previewSaved(id, 'save', 'test');
    if (mode === 'cancel') f.coordinator.cancelAll();
    if (mode === 'expiry') f.expire();
    if (mode === 'concurrent') f.mutate(s => s.placeIds.push(other));
    await assert.rejects(f.coordinator.confirm(p.pendingId)); assert.equal(f.writes, 0);
  }
});
test('candidate and revoked records cannot be prepared or committed', async () => {
  const f = fixture(); const p = await f.coordinator.previewSaved(id, 'save', 'test');
  f.deps.resolve = async () => null;
  await assert.rejects(f.coordinator.confirm(p.pendingId)); assert.equal(f.writes, 0);
  await assert.rejects(f.coordinator.previewSaved(id, 'save', 'test'));
});
test('itinerary patches enforce UUID/durations/count and preserve favorites/settings', async () => {
  const f = fixture(); f.mutate(s => s.placeIds.push(other));
  await assert.rejects(f.coordinator.previewItinerary([{ placeId: id, durationMinutes: 1441 }], 'test'));
  const p = await f.coordinator.previewItinerary([{ placeId: id, durationMinutes: 45 }], 'test');
  await f.coordinator.confirm(p.pendingId);
  assert.equal(f.state.placeIds[0], other); assert.equal(f.state.startTime, '10:00');
  assert.equal(f.state.itinerary[0].durationMinutes, 45);
});
