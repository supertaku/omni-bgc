const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("../helpers/load-ts.cjs");
const { createUnifiedRetrieval } = loadTs("apps/mobile/src/ai/retrieval.ts");
const { createToolExecutor } = loadTs("apps/mobile/src/ai/toolExecutor.ts");
const { composeGroundedAnswer, revalidateToolResult } = loadTs(
  "apps/mobile/src/ai/answerComposer.ts",
);
const { AgentOrchestrator } = loadTs("apps/mobile/src/ai/AgentOrchestrator.ts");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const citation = {
  sourceId: "SYNTHETIC",
  label: "Test only",
  license: "CC0-1.0",
  status: "approved",
  factId: "TEST",
  snapshotId: "TEST",
  evidenceId: "TEST",
  locator: "TEST",
  verificationMethod: "TEST",
  rawSha256: "a".repeat(64),
  observedAt: "2026-01-01T00:00:00Z",
  verifiedAt: "2026-01-02T00:00:00Z",
};
const entrance = {
  id: id(2),
  label: "Synthetic eligible entrance",
  coordinate: [0.1, 0.2],
  eligible: true,
  floor: "Synthetic ground floor",
};
const approved = () => ({
  id: id(1),
  name: "Synthetic approved place",
  status: "approved",
  category: "test",
  coordinate: null,
  menus: [],
  aliases: [],
  entrances: [entrance],
  citations: [citation],
});
function fixture() {
  let record = approved();
  const retrieval = createUnifiedRetrieval({
    findPlaces: async () => (record ? [record] : []),
    getPlaceDetails: async (key) => (record?.id === key ? record : null),
    findMenuItems: async () => [],
    loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }),
    searchOffices: () => ({ items: [], total: 0 }),
    getOfficeDetails: () => null,
  });
  return {
    retrieval,
    set: (value) => {
      record = value;
    },
  };
}
test("entrance tool excludes missing/candidate/stale places and invalid/ineligible source geometry", async () => {
  const f = fixture();
  assert.equal(
    (await f.retrieval.getVerifiedEntrances(id(99))).status,
    "empty",
  );
  for (const status of ["candidate", "stale"]) {
    f.set({ ...approved(), status });
    const result = await f.retrieval.getVerifiedEntrances(id(1));
    assert.equal(result.data.entrances.length, 0);
    assert.equal(result.citations.length, 0);
  }
  f.set({
    ...approved(),
    entrances: [
      entrance,
      { ...entrance, id: "invented" },
      { ...entrance, id: id(3), eligible: false },
      { ...entrance, id: id(4), coordinate: null },
      { ...entrance, id: id(5), coordinate: [NaN, 0] },
      { ...entrance, id: id(6), coordinate: [181, 0] },
    ],
  });
  const result = await f.retrieval.getVerifiedEntrances(id(1));
  assert.equal(result.data.entrances.length, 1);
  assert.equal(result.data.entrances[0].id, id(2));
});
test("explicit entrance reads return only source coordinates/labels with lineage, reject model coordinates and revalidate before display", async () => {
  const f = fixture(),
    executor = createToolExecutor(f.retrieval),
    context = {
      requestId: "HOST",
      researchEnabled: false,
      resolvedPlaceIds: new Set(),
    };
  const raw = {
    version: 1,
    name: "get_verified_entrances",
    arguments: { placeId: id(1) },
  };
  const result = await executor.execute(raw, "HOST_CALL", context);
  assert.equal(result.status, "ok");
  assert.deepEqual(Array.from(result.data.entrances[0].coordinate), [0.1, 0.2]);
  assert.equal(result.citations[0].sourceId, citation.sourceId);
  const payloads = composeGroundedAnswer([result]);
  assert.match(payloads[0].text, /Synthetic eligible entrance/);
  assert.match(payloads[0].text, /do not provide walking directions/);
  assert.ok(payloads.some((payload) => payload.kind === "evidence"));
  await assert.rejects(
    executor.execute(
      { ...raw, arguments: { placeId: id(1), coordinate: [121, 14] } },
      "HOST_BAD",
      context,
    ),
    { code: "TOOL_PROTOCOL_INVALID" },
  );
  let emitted = false;
  const provider = {
    getCapabilities: async () => ({ supportedContextTokens: 4096 }),
    cancel: async () => ({}),
    stream: async (input) => ({
      requestId: input.requestId,
      epoch: input.epoch,
      text: "",
      finishReason: "complete",
      nativeQuiescent: true,
      toolProposals: emitted ? [] : ((emitted = true), [raw]),
    }),
  };
  const agent = new AgentOrchestrator(provider, executor);
  assert.equal((await agent.run("Find coffee places")).status, "denied");
  emitted = false;
  assert.equal(
    (await agent.run("Show recorded entrances for this place")).status,
    "completed",
  );
  f.set(null);
  const refreshed = await revalidateToolResult(result, f.retrieval);
  assert.equal(refreshed.status, "empty");
  assert.ok(
    !JSON.stringify(composeGroundedAnswer([refreshed])).includes(
      "Synthetic eligible entrance",
    ),
  );
});
