const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("../helpers/load-ts.cjs");
const { createUnifiedRetrieval } = loadTs("apps/mobile/src/ai/retrieval.ts");
const { createToolExecutor } = loadTs("apps/mobile/src/ai/toolExecutor.ts");
const { ItineraryPreviewOwner } = loadTs(
  "apps/mobile/src/ai/itineraryPreview.ts",
);
const { decodeToolProposal, toolDefinitions, TOOL_CONTRACT_REVISION } = loadTs(
  "apps/mobile/src/ai/tools.ts",
);
const { composeGroundedAnswer, revalidateToolResult } = loadTs(
  "apps/mobile/src/ai/answerComposer.ts",
);
const { toolObservation } = loadTs("apps/mobile/src/ai/prompt.ts");
const { AgentOrchestrator } = loadTs("apps/mobile/src/ai/AgentOrchestrator.ts");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stop = (n, durationMinutes = 30) => ({ placeId: id(n), durationMinutes });
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
  citations: [{ ...citation }],
});
const proposal = (name, args = {}) => ({ version: 1, name, arguments: args });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function fixture() {
  const available = new Map([1, 2, 3].map((n) => [id(n), place(n)]));
  const retained = {
    placeIds: [id(90)],
    itinerary: [stop(91, 45)],
    startTime: "10:30",
  };
  const original = JSON.stringify(retained);
  let savedReads = 0,
    nextResolver;
  const resolve = async (key) => {
    if (nextResolver) {
      const handler = nextResolver;
      nextResolver = undefined;
      return handler(key);
    }
    return available.get(key) ?? null;
  };
  const owner = new ItineraryPreviewOwner(resolve);
  const retrieval = createUnifiedRetrieval({
    findPlaces: async () => [...available.values()],
    getPlaceDetails: resolve,
    findMenuItems: async () => [],
    loadSaved: async () => {
      savedReads++;
      throw Error("Removed saved feature must not be read");
    },
    searchOffices: () => ({ items: [], total: 0 }),
    getOfficeDetails: () => null,
  });
  const executor = createToolExecutor(retrieval, {
    getItineraryPreview: (signal) => owner.read(signal),
    previewItinerary: (stops, requestId, operation, signal) =>
      owner.preview(stops, requestId, operation, signal),
    cancelPending: () => owner.cancelPending(),
  });
  const context = {
    requestId: "HOST_REQUEST",
    researchEnabled: false,
    resolvedPlaceIds: new Set(),
  };
  return {
    available,
    owner,
    retrieval,
    executor,
    context,
    retained,
    original,
    get savedReads() {
      return savedReads;
    },
    nextResolve: (handler) => {
      nextResolver = handler;
    },
  };
}
async function call(f, name, args = {}) {
  return f.executor.execute(proposal(name, args), "HOST", f.context);
}

test("v2 registry rejects removed saved tools and permanent settings in preview schemas", () => {
  assert.equal(TOOL_CONTRACT_REVISION, "omni-local-tools-v2");
  const names = toolDefinitions().map((x) => x.name);
  assert.ok(names.includes("get_itinerary_preview"));
  assert.ok(
    !names.includes("get_saved_places") &&
      !names.includes("preview_saved_change"),
  );
  for (const bad of [
    proposal("get_saved_places"),
    proposal("preview_saved_change", { placeId: id(1), operation: "save" }),
    proposal("get_itinerary_preview", { saved: true }),
    proposal("preview_itinerary_change", {
      stops: [stop(1)],
      startTime: "10:30",
    }),
    proposal("preview_itinerary_change", { stops: [stop(1, 1441)] }),
    proposal("preview_itinerary_change", {
      stops: [stop(1)],
      operation: "commit",
    }),
  ])
    assert.throws(() => decodeToolProposal(bad, "HOST"), {
      code: "TOOL_PROTOCOL_INVALID",
    });
});

test("draft operations use only session memory, exact tuples and no confirmation or saved-state read", async () => {
  const f = fixture();
  assert.equal((await call(f, "get_itinerary_preview")).data.stops.length, 0);
  assert.equal(
    (await call(f, "preview_itinerary_change", { stops: [stop(1)] })).status,
    "denied",
  );
  await call(f, "find_places");
  await call(f, "preview_itinerary_change", {
    stops: [stop(1, 20), stop(2, 30)],
  });
  const added = await call(f, "preview_itinerary_change", {
    operation: "append",
    stops: [stop(1, 45)],
  });
  assert.equal(added.data.totalVisitMinutes, 95);
  const reordered = await call(f, "preview_itinerary_change", {
    operation: "reorder",
    stops: [stop(1, 45), stop(2, 30), stop(1, 20)],
  });
  assert.deepEqual(
    Array.from(reordered.data.stops, (x) => x.durationMinutes),
    [45, 30, 20],
  );
  const removed = await call(f, "preview_itinerary_change", {
    operation: "remove",
    stops: [stop(1, 20)],
  });
  assert.deepEqual(
    Array.from(removed.data.stops, (x) => x.durationMinutes),
    [45, 30],
  );
  assert.equal(removed.status, "ok");
  assert.ok(!("confirm" in f.owner));
  assert.equal(f.savedReads, 0);
  assert.equal(JSON.stringify(f.retained), f.original);
  assert.equal(
    (
      await new ItineraryPreviewOwner(async (key) =>
        f.available.get(key),
      ).read()
    ).stops.length,
    0,
  );
});

test("invalid tuple edits and oversized drafts retain prior draft; duplicate multiplicity stays exact", async () => {
  const f = fixture();
  await call(f, "find_places");
  await call(f, "preview_itinerary_change", {
    stops: [stop(1, 20), stop(2, 30)],
  });
  for (const args of [
    { operation: "remove", stops: [stop(1, 21)] },
    { operation: "remove", stops: [stop(1, 20), stop(1, 20)] },
    { operation: "reorder", stops: [stop(1, 20)] },
    { operation: "reorder", stops: [stop(1, 30), stop(2, 20)] },
  ])
    assert.equal(
      (await call(f, "preview_itinerary_change", args)).status,
      "unavailable",
    );
  const before = JSON.stringify(await f.owner.read());
  await assert.rejects(
    f.owner.preview(
      Array.from({ length: 20 }, (_, i) => ({
        placeId: id(i + 1),
        durationMinutes: 1,
      })),
      "HOST",
      "append",
    ),
  );
  assert.equal(JSON.stringify(await f.owner.read()), before);
  await f.owner.preview([stop(1, 20)], "HOST");
  await f.owner.preview([stop(1, 20)], "HOST", "append");
  await f.owner.preview([stop(1, 20), stop(1, 20)], "HOST", "reorder");
  assert.equal(
    (await f.owner.preview([stop(1, 20)], "HOST", "remove")).stops.length,
    1,
  );
  await assert.rejects(
    f.owner.preview([stop(1, 20), stop(1, 20)], "HOST", "remove"),
  );
});

test("fresh names and revoked eligibility are checked before reading, editing and rendering", async () => {
  const f = fixture();
  await call(f, "find_places");
  const earlier = await call(f, "preview_itinerary_change", {
    stops: [stop(1, 20)],
  });
  f.available.get(id(1)).name = "Renamed approved source";
  assert.equal(
    (await revalidateToolResult(earlier, f.retrieval)).data.stops[0].name,
    "Renamed approved source",
  );
  assert.equal((await f.owner.read()).stops[0].name, "Renamed approved source");
  f.available.get(id(1)).status = "stale";
  assert.equal((await call(f, "get_itinerary_preview")).status, "unavailable");
  assert.equal(
    (
      await call(f, "preview_itinerary_change", {
        operation: "reorder",
        stops: [stop(1, 20)],
      })
    ).status,
    "unavailable",
  );
  const revoked = await revalidateToolResult(earlier, f.retrieval);
  assert.equal(revoked.status, "unavailable");
  assert.ok(
    !composeGroundedAnswer([revoked]).some(
      (x) => x.kind === "itinerary-preview",
    ),
  );
});

test("cancel and clear invalidate in-flight writes while completed draft survives cancel", async () => {
  const f = fixture();
  await f.owner.preview([stop(1, 20)], "HOST");
  const held = deferred();
  f.nextResolve(() => held.promise);
  const pending = f.owner.preview([stop(2, 40)], "HOST");
  f.owner.cancelPending();
  held.resolve(f.available.get(id(2)));
  await assert.rejects(pending, /changed/);
  assert.equal((await f.owner.read()).stops[0].placeId, id(1));
  const again = deferred();
  f.nextResolve(() => again.promise);
  const clearing = f.owner.preview([stop(2, 40)], "HOST");
  f.owner.clear();
  again.resolve(f.available.get(id(2)));
  await assert.rejects(clearing, /changed/);
  assert.equal((await f.owner.read()).stops.length, 0);
});

test("concurrent CAS rejects late draft replacement; abort and detached objects preserve state", async () => {
  const f = fixture(),
    held = deferred();
  f.nextResolve(() => held.promise);
  const older = f.owner.preview([stop(1, 20)], "HOST_OLD");
  await f.owner.preview([stop(2, 45)], "HOST_NEW");
  held.resolve(f.available.get(id(1)));
  await assert.rejects(older, /changed/);
  assert.equal((await f.owner.read()).stops[0].placeId, id(2));
  const waiting = deferred(),
    controller = new AbortController();
  f.nextResolve(() => waiting.promise);
  const aborted = f.owner.preview(
    [stop(1)],
    "HOST",
    "replace",
    controller.signal,
  );
  controller.abort();
  waiting.resolve(f.available.get(id(1)));
  await assert.rejects(aborted, { name: "AbortError" });
  const input = [stop(1, 15)],
    result = await f.owner.preview(input, "HOST");
  input[0].durationMinutes = 500;
  result.stops[0].durationMinutes = 900;
  assert.equal((await f.owner.read()).totalVisitMinutes, 15);
});

test("orchestration returns grounded ephemeral preview; removed save/routes never reach provider", async () => {
  const f = fixture();
  let calls = 0;
  const provider = {
    id: "CONTROLLED_NO_MODEL",
    getCapabilities: async () => ({ supportedContextTokens: 4096 }),
    cancel: async () => ({ accepted: true, nativeQuiescent: false }),
    stream: async (input) => ({
      requestId: input.requestId,
      epoch: input.epoch,
      nativeQuiescent: true,
      finishReason: "complete",
      text: "",
      toolProposals: calls++
        ? []
        : [proposal("preview_itinerary_change", { stops: [stop(1, 25)] })],
    }),
  };
  const agent = new AgentOrchestrator(provider, f.executor);
  const turn = await agent.run("Preview the first place in my itinerary", {
    resolvedPlaceIds: [id(1)],
  });
  assert.equal(turn.status, "completed");
  assert.equal(
    turn.payloads.find((x) => x.kind === "itinerary-preview").preview
      .totalVisitMinutes,
    25,
  );
  const observation = JSON.parse(toolObservation(turn.results[0]));
  assert.equal(observation.data.temporary, true);
  assert.equal(observation.data.stops[0].durationMinutes, 25);
  const prior = calls;
  for (const query of [
    "Show my saved places",
    "Save the first one",
    "Show favorites",
    "Walking directions to a cafe",
  ]) {
    const denied = await agent.run(query);
    assert.equal(denied.status, "unavailable");
    assert.equal(denied.results.length, 0);
  }
  assert.equal(calls, prior);
  assert.equal(f.savedReads, 0);
});

test("final preview hydration refreshes names and blocks a place revoked after initial revalidation", async () => {
  for (const revoked of [false, true]) {
    const f = fixture();
    const originalRead = f.retrieval.getPlaceDetails;
    let reads = 0,
      rounds = 0;
    f.retrieval.getPlaceDetails = async (key) => {
      if (++reads === 4) {
        if (revoked) f.available.get(id(1)).status = "stale";
        else f.available.get(id(1)).name = "Latest approved name";
      }
      return originalRead(key);
    };
    const provider = {
      id: "CONTROLLED_NO_MODEL",
      getCapabilities: async () => ({ supportedContextTokens: 4096 }),
      cancel: async () => ({ accepted: true, nativeQuiescent: false }),
      stream: async (input) => ({
        requestId: input.requestId,
        epoch: input.epoch,
        nativeQuiescent: true,
        finishReason: "complete",
        text: "",
        toolProposals: rounds++
          ? []
          : [proposal("preview_itinerary_change", { stops: [stop(1, 25)] })],
      }),
    };
    const turn = await new AgentOrchestrator(provider, f.executor).run(
      "Preview the first place in my itinerary",
      { resolvedPlaceIds: [id(1)] },
    );
    const payload = turn.payloads.find((x) => x.kind === "itinerary-preview");
    if (revoked) {
      assert.equal(payload, undefined);
      assert.equal(turn.places.length, 0);
      assert.equal(turn.results[0].status, "unavailable");
    } else {
      assert.equal(payload.preview.stops[0].name, "Latest approved name");
      assert.equal(turn.places[0].id, id(1));
    }
  }
});
