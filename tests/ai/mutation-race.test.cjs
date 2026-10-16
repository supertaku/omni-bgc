const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("../helpers/load-ts.cjs");
const { MutationCoordinator } = loadTs(
  "apps/mobile/src/ai/mutationCoordinator.ts",
);
const id = "00000000-0000-4000-8000-000000000001";
const approved = () => ({
  id,
  name: "Synthetic test place",
  category: "test",
  coordinate: null,
  status: "approved",
  citations: [
    {
      status: "approved",
      sourceId: "SYNTHETIC",
      label: "Test fixture",
      license: "CC0-1.0",
      factId: "TEST",
      snapshotId: "TEST",
      evidenceId: "TEST",
      locator: "TEST",
      verificationMethod: "TEST",
      rawSha256: "a".repeat(64),
      observedAt: "2026-01-01T00:00:00Z",
      verifiedAt: "2026-01-02T00:00:00Z",
    },
  ],
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function fixture() {
  let writes = 0;
  const deps = {
    read: async () => ({ placeIds: [], itinerary: [], startTime: null }),
    resolve: async () => approved(),
    mintId: () => "HOST_PENDING",
    apply: async () => {
      writes++;
      return { placeIds: [id], itinerary: [], startTime: null };
    },
  };
  return {
    deps,
    coordinator: new MutationCoordinator(deps),
    get writes() {
      return writes;
    },
  };
}
test("cancellation while asynchronous preview resolves cannot install a late pending operation", async () => {
  const f = fixture(),
    gate = deferred();
  f.deps.resolve = () => gate.promise;
  const preparing = f.coordinator.previewSaved(id, "save", "HOST_REQUEST");
  f.coordinator.cancelAll();
  gate.resolve(approved());
  await assert.rejects(preparing, /cancel/i);
  await assert.rejects(f.coordinator.confirm("HOST_PENDING"));
  assert.equal(f.writes, 0);
});
test("cancellation while confirmation source revalidation resolves cannot dispatch a write", async () => {
  const f = fixture(),
    pending = await f.coordinator.previewSaved(id, "save", "HOST_REQUEST"),
    gate = deferred();
  f.deps.resolve = () => gate.promise;
  const confirming = f.coordinator.confirm(pending.pendingId);
  f.coordinator.cancelAll();
  gate.resolve(approved());
  await assert.rejects(confirming, /cancel/i);
  assert.equal(f.writes, 0);
});
test("changed approved citation receipt requires a fresh preview rather than silently changing the target evidence", async () => {
  const f = fixture(),
    pending = await f.coordinator.previewSaved(id, "save", "HOST_REQUEST");
  f.deps.resolve = async () => {
    const p = approved();
    p.citations[0].rawSha256 = "b".repeat(64);
    return p;
  };
  await assert.rejects(f.coordinator.confirm(pending.pendingId), /source/i);
  assert.equal(f.writes, 0);
});
