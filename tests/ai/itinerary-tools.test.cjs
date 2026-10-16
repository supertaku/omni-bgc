const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("../helpers/load-ts.cjs");
const { createUnifiedRetrieval } = loadTs("apps/mobile/src/ai/retrieval.ts");
const { createToolExecutor } = loadTs("apps/mobile/src/ai/toolExecutor.ts");
const { MutationCoordinator } = loadTs(
  "apps/mobile/src/ai/mutationCoordinator.ts",
);
const { savedFingerprint, projectSavedPatch } = loadTs(
  "apps/mobile/src/data/savedPatch.ts",
);
const { composeGroundedAnswer } = loadTs(
  "apps/mobile/src/ai/answerComposer.ts",
);
const { toolObservation } = loadTs("apps/mobile/src/ai/prompt.ts");
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
const place = (n) => ({
  id: id(n),
  name: `Synthetic approved ${n}`,
  category: "test",
  status: "approved",
  coordinate: null,
  aliases: [],
  entrances: [],
  menus: [],
  citations: [citation],
});
const proposal = (name, arguments = {}) => ({ version: 1, name, arguments });
function fixture() {
  let state = {
      placeIds: [id(1)],
      itinerary: [
        { placeId: id(2), durationMinutes: 30 },
        { placeId: id(3), durationMinutes: 45 },
      ],
      startTime: "10:30",
    },
    writes = 0,
    serial = 0;
  const available = new Map([1, 2, 4].map((n) => [id(n), place(n)]));
  const resolve = async (key) => available.get(key) ?? null;
  const read = async () => structuredClone(state);
  const retrieval = createUnifiedRetrieval({
    findPlaces: async () => [...available.values()],
    getPlaceDetails: resolve,
    findMenuItems: async () => [],
    loadSaved: read,
    searchOffices: () => ({ items: [], total: 0 }),
    getOfficeDetails: () => null,
  });
  const coordinator = new MutationCoordinator({
    read,
    resolve,
    mintId: () => `HOST-${++serial}`,
    apply: async (expected, patch) => {
      if (savedFingerprint(state) !== expected) throw Error("CAS conflict");
      state = projectSavedPatch(state, patch);
      writes++;
      return state;
    },
  });
  const executor = createToolExecutor(retrieval, {
    previewItinerary: (stops, requestId, operation) =>
      coordinator.previewItinerary(stops, requestId, operation),
  });
  const context = {
    requestId: "HOST_REQUEST",
    researchEnabled: false,
    resolvedPlaceIds: new Set(),
  };
  return {
    retrieval,
    coordinator,
    executor,
    context,
    get state() {
      return state;
    },
    get writes() {
      return writes;
    },
    change: (fn) => fn(state),
  };
}
test("saved tools expose current itinerary/start setting and retain unresolved tuples without promoting them", async () => {
  const f = fixture();
  const result = await f.executor.execute(
    proposal("get_saved_places"),
    "HOST",
    f.context,
  );
  assert.equal(result.status, "ok");
  assert.equal(result.data.startTime, "10:30");
  assert.equal(result.data.totalItinerary, 2);
  assert.equal(result.data.unresolvedItinerary, 1);
  assert.equal(result.data.itinerary[1].placeId, id(3));
  assert.equal(result.data.itinerary[1].durationMinutes, 45);
  assert.equal(result.data.itinerary[1].name, null);
  assert.equal(result.data.itinerary[1].status, "unavailable");
  assert.ok(f.context.resolvedPlaceIds.has(id(2)));
  assert.ok(!f.context.resolvedPlaceIds.has(id(3)));
  const observation = JSON.parse(toolObservation(result));
  assert.equal(observation.data.itinerary[1].placeId, id(3));
  assert.equal(observation.data.itinerary[1].status, "unavailable");
  const output = JSON.stringify(composeGroundedAnswer([result]));
  assert.match(output, /10:30/);
  assert.match(output, /45 minutes planned visit/);
  assert.match(output, /retained, source unavailable/);
  assert.match(output, /no walking route or travel-time estimate/i);
});
test("actual executor append previews only, then confirmation preserves unknown old visits/preferences and commits once", async () => {
  const f = fixture();
  await f.executor.execute(proposal("find_places"), "HOST_READ", f.context);
  const preview = await f.executor.execute(
    proposal("preview_itinerary_change", {
      operation: "append",
      stops: [{ placeId: id(4), durationMinutes: 60 }],
    }),
    "HOST_APPEND",
    f.context,
  );
  assert.equal(preview.status, "needs_confirmation");
  assert.equal(f.writes, 0);
  assert.equal(f.state.itinerary.length, 2);
  assert.match(preview.data.summary, /Unavailable saved record/);
  await Promise.all([
    f.coordinator.confirm(preview.data.pendingId),
    f.coordinator.confirm(preview.data.pendingId),
  ]);
  assert.equal(f.writes, 1);
  assert.deepEqual(
    Array.from(f.state.itinerary, (stop) => stop.placeId),
    [id(2), id(3), id(4)],
  );
  assert.equal(f.state.startTime, "10:30");
  assert.equal(f.state.placeIds[0], id(1));
});
test("actual executor removes an exact unresolved local stop without hiding or replacing retained visits", async () => {
  const f = fixture();
  const preview = await f.executor.execute(
    proposal("preview_itinerary_change", {
      operation: "remove",
      stops: [{ placeId: id(3), durationMinutes: 45 }],
    }),
    "HOST_REMOVE",
    f.context,
  );
  assert.equal(preview.status, "needs_confirmation");
  assert.equal(f.writes, 0);
  await f.coordinator.confirm(preview.data.pendingId);
  assert.equal(f.state.itinerary.length, 1);
  assert.equal(f.state.itinerary[0].placeId, id(2));
  assert.equal(f.state.itinerary[0].durationMinutes, 30);
});
test("actual executor reorders exact current ID/duration multiset including unavailable retained stop", async () => {
  const f = fixture();
  const stops = structuredClone(f.state.itinerary).reverse();
  const preview = await f.executor.execute(
    proposal("preview_itinerary_change", { operation: "reorder", stops }),
    "HOST_REORDER",
    f.context,
  );
  assert.equal(preview.status, "needs_confirmation");
  await f.coordinator.confirm(preview.data.pendingId);
  assert.deepEqual(
    Array.from(f.state.itinerary, (stop) => [
      stop.placeId,
      stop.durationMinutes,
    ]),
    [
      [id(3), 45],
      [id(2), 30],
    ],
  );
});
test("invalid reorder/drop/duration, invented removal and unknown appended stop make no preview or write", async () => {
  const f = fixture();
  for (const arguments of [
    { operation: "reorder", stops: [{ placeId: id(2), durationMinutes: 30 }] },
    {
      operation: "reorder",
      stops: [
        { placeId: id(3), durationMinutes: 46 },
        { placeId: id(2), durationMinutes: 30 },
      ],
    },
    { operation: "remove", stops: [{ placeId: id(99), durationMinutes: 30 }] },
    { operation: "append", stops: [{ placeId: id(3), durationMinutes: 45 }] },
  ])
    assert.equal(
      (
        await f.executor.execute(
          proposal("preview_itinerary_change", arguments),
          "HOST_BAD",
          f.context,
        )
      ).status,
      "denied",
    );
  assert.equal(f.writes, 0);
  await assert.rejects(f.coordinator.confirm("HOST-1"));
  await assert.rejects(
    f.executor.execute(
      proposal("preview_itinerary_change", {
        operation: "delete_all_data",
        stops: [],
      }),
      "HOST",
      f.context,
    ),
    { code: "TOOL_PROTOCOL_INVALID" },
  );
});
test("omitted itinerary operation remains replace and changed latest user state rejects prepared append", async () => {
  const f = fixture();
  await f.executor.execute(proposal("find_places"), "HOST_READ", f.context);
  const replace = await f.executor.execute(
    proposal("preview_itinerary_change", {
      stops: [{ placeId: id(4), durationMinutes: 10 }],
    }),
    "HOST_REPLACE",
    f.context,
  );
  assert.match(replace.data.summary, /replace visit list/);
  const append = await f.executor.execute(
    proposal("preview_itinerary_change", {
      operation: "append",
      stops: [{ placeId: id(4), durationMinutes: 10 }],
    }),
    "HOST_APPEND",
    f.context,
  );
  f.change((state) => (state.startTime = "11:00"));
  await assert.rejects(
    f.coordinator.confirm(append.data.pendingId),
    /conflict/i,
  );
  assert.equal(f.writes, 0);
});

test("itinerary-only unresolved saved state survives the full orchestration/display pipeline", async () => {
  const f = fixture();
  f.change((state) => {
    state.placeIds = [];
    state.itinerary = [{ placeId: id(3), durationMinutes: 45 }];
    state.startTime = null;
  });
  const { AgentOrchestrator } = loadTs(
    "apps/mobile/src/ai/AgentOrchestrator.ts",
  );
  let calls = 0;
  const provider = {
    getCapabilities: async () => ({ supportedContextTokens: 4096 }),
    cancel: async () => ({}),
    stream: async (input) => ({
      requestId: input.requestId,
      epoch: input.epoch,
      finishReason: "complete",
      nativeQuiescent: true,
      text: "",
      toolProposals: calls++ ? [] : [proposal("get_saved_places")],
    }),
  };
  const turn = await new AgentOrchestrator(provider, f.executor).run(
    "Show my itinerary",
  );
  assert.equal(turn.status, "completed");
  assert.equal(turn.results[0].status, "ok");
  assert.equal(turn.results[0].data.itinerary.length, 1);
  const output = JSON.stringify(turn.payloads);
  assert.match(output, /45 minutes planned visit/);
  assert.match(output, /retained, source unavailable/);
  assert.equal(turn.places.length, 0);
});

test("oversized legacy itinerary remains fully readable and action limit is an explicit nonmutating result", async () => {
  const f = fixture();
  f.change((state) => {
    state.itinerary = Array.from({ length: 21 }, () => ({
      placeId: id(3),
      durationMinutes: 1,
    }));
  });
  const read = await f.executor.execute(
    proposal("get_saved_places"),
    "HOST_READ",
    f.context,
  );
  assert.equal(read.data.itinerary.length, 21);
  const observation = JSON.parse(toolObservation(read));
  assert.equal(observation.data.totalItinerary, 21);
  assert.equal(observation.data.itineraryTruncated, true);
  const edit = await f.executor.execute(
    proposal("preview_itinerary_change", {
      operation: "remove",
      stops: [{ placeId: id(3), durationMinutes: 1 }],
    }),
    "HOST_REMOVE",
    f.context,
  );
  assert.equal(edit.status, "unavailable");
  assert.match(edit.warnings[0], /20-stop.*retained/);
  assert.equal(f.writes, 0);
  assert.equal(f.state.itinerary.length, 21);
});

test("remove binds exact duration and occurrence count instead of deleting every repeated place ID", async () => {
  const f = fixture();
  f.change((state) => {
    state.itinerary = [
      { placeId: id(2), durationMinutes: 30 },
      { placeId: id(3), durationMinutes: 45 },
      { placeId: id(2), durationMinutes: 30 },
    ];
  });
  const wrong = await f.executor.execute(
    proposal("preview_itinerary_change", {
      operation: "remove",
      stops: [{ placeId: id(2), durationMinutes: 31 }],
    }),
    "HOST_WRONG",
    f.context,
  );
  assert.equal(wrong.status, "denied");
  const preview = await f.executor.execute(
    proposal("preview_itinerary_change", {
      operation: "remove",
      stops: [{ placeId: id(2), durationMinutes: 30 }],
    }),
    "HOST_ONCE",
    f.context,
  );
  await f.coordinator.confirm(preview.data.pendingId);
  assert.deepEqual(
    Array.from(f.state.itinerary, (stop) => [
      stop.placeId,
      stop.durationMinutes,
    ]),
    [
      [id(3), 45],
      [id(2), 30],
    ],
  );
  const excess = await f.executor.execute(
    proposal("preview_itinerary_change", {
      operation: "remove",
      stops: [
        { placeId: id(2), durationMinutes: 30 },
        { placeId: id(2), durationMinutes: 30 },
      ],
    }),
    "HOST_EXCESS",
    f.context,
  );
  assert.equal(excess.status, "denied");
  assert.equal(f.writes, 1);
  const g = fixture();
  g.change((state) => {
    state.itinerary = [
      { placeId: id(2), durationMinutes: 30 },
      { placeId: id(3), durationMinutes: 45 },
      { placeId: id(2), durationMinutes: 30 },
    ];
  });
  const both = await g.executor.execute(
    proposal("preview_itinerary_change", {
      operation: "remove",
      stops: [
        { placeId: id(2), durationMinutes: 30 },
        { placeId: id(2), durationMinutes: 30 },
      ],
    }),
    "HOST_TWICE",
    g.context,
  );
  assert.equal(both.status, "needs_confirmation");
  await g.coordinator.confirm(both.data.pendingId);
  assert.equal(g.state.itinerary.length, 1);
  assert.equal(g.state.itinerary[0].placeId, id(3));
});
