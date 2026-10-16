const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("../helpers/load-ts.cjs");
const { createUnifiedRetrieval } = loadTs("apps/mobile/src/ai/retrieval.ts");
const { createToolExecutor } = loadTs("apps/mobile/src/ai/toolExecutor.ts");
const { createFoodResearchService } = loadTs(
  "apps/mobile/src/features/food/service.ts",
);
const { decodeToolProposal } = loadTs("apps/mobile/src/ai/tools.ts");
const { safeGeneralText, isGeneralConversation, composeGroundedAnswer } =
  loadTs("apps/mobile/src/ai/answerComposer.ts");
const { toolObservation } = loadTs("apps/mobile/src/ai/prompt.ts");
const { AgentOrchestrator } = loadTs("apps/mobile/src/ai/AgentOrchestrator.ts");
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const proposal = (name, args = {}) => ({ version: 1, name, arguments: args });
const deps = {
  findPlaces: async () => [],
  getPlaceDetails: async () => null,
  findMenuItems: async () => [],
  loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }),
  searchOffices: () => ({ items: [], total: 0 }),
  getOfficeDetails: () => null,
};
test("rejects ambiguous duplicate JSON keys, escaped duplicates and structured key-byte overflow", () => {
  for (const raw of [
    '{"name":"get_saved_places","name":"find_places","arguments":{}}',
    '{"name":"find_places","arguments":{"query":"one","qu\\u0065ry":"two"}}',
    proposal("find_places", { ["k".repeat(9000)]: false }),
  ])
    assert.throws(() => decodeToolProposal(raw, "HOST"), {
      code: "TOOL_PROTOCOL_INVALID",
    });
});
test("explicit food research retains estimate/starting/branch/date/rights and no canonical geo", async () => {
  const r = {
    id: id(50),
    externalId: "TEST-ONLY",
    origin: "research",
    name: "Synthetic research listing",
    type: "restaurant",
    zone: null,
    building: null,
    floor: null,
    locationOriginal: null,
    locationSpecificity: null,
    locationSourceUrl: null,
    menuStatus: "research",
    menuBranch: "Unknown test branch",
    notes: null,
    researchDate: "2026-01-01",
    hours: {
      text: "Synthetic delivery schedule",
      kind: "delivery",
      evidence: "synthetic",
      sourceUrl: null,
      venueText: null,
      venueSourceUrl: null,
      weeklySchedule: null,
    },
    items: [],
  };
  r.items = ["estimated", "published-starting"].map((priceEvidence, i) => ({
    id: id(60 + i),
    restaurantId: r.id,
    origin: "research",
    name: `Synthetic dish ${i}`,
    section: null,
    category: null,
    tags: [],
    description: null,
    amount: i ? "500.01" : "500.00",
    currency: "PHP",
    priceEvidence,
    priceSourceUrl: null,
    estimationBasis: "Synthetic test fixture",
    menuSourceUrl: null,
    branch: "Unknown test branch",
    researchStatus: "research",
    researchDate: "2026-01-01",
  }));
  const research = createFoodResearchService({
    version: "food-research-v1",
    restaurants: [
      r,
      {
        ...r,
        id: id(51),
        externalId: "TEST-EMPTY",
        name: "Synthetic no menu research",
        items: [],
      },
    ],
  });
  assert.equal(research.available, true);
  const retrieval = createUnifiedRetrieval({ ...deps, foodResearch: research });
  const executor = createToolExecutor(retrieval),
    context = {
      requestId: "HOST",
      researchEnabled: true,
      resolvedPlaceIds: new Set(),
    };
  const result = await executor.execute(
    proposal("search_food_research", { maxPhp: "500.00" }),
    "HOST",
    context,
  );
  assert.equal(result.authority, "research");
  assert.equal(result.citations.length, 0);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].items[0].priceEvidence, "estimated");
  assert.equal(result.data[0].evidence.rightsReview, "pending");
  assert.equal(result.data[0].evidence.branch, "Unknown test branch");
  assert.equal(result.data[0].restaurant.coordinate, undefined);
  assert.equal(context.resolvedPlaceIds.size, 0);
  const detail = await executor.execute(
    proposal("get_food_research_details", {
      restaurantId: id(50),
      offset: 1,
      limit: 1,
    }),
    "HOST",
    context,
  );
  assert.equal(detail.data[0].items[0].priceEvidence, "published-starting");
  const payloads = composeGroundedAnswer([detail]);
  assert.ok(
    payloads.some(
      (p) => p.kind === "food-hours" && p.hours.kind === "delivery",
    ),
  );
  assert.ok(!payloads.some((p) => p.kind === "places" || p.kind === "menus"));
  const listing = await executor.execute(
    proposal("search_food_research", { query: "no menu" }),
    "HOST",
    context,
  );
  assert.equal(listing.data.length, 1);
  assert.equal(listing.data[0].items.length, 0);
});
test("negative research request never enables research or candidate tool capabilities", async () => {
  const calls = [];
  const provider = {
    getCapabilities: async () => ({ supportedContextTokens: 4096 }),
    cancel: async () => ({}),
    stream: async (input) => {
      calls.push(input);
      return {
        requestId: input.requestId,
        epoch: input.epoch,
        text: "",
        toolProposals: [proposal("search_food_research")],
        nativeQuiescent: true,
        finishReason: "complete",
      };
    },
  };
  const result = await new AgentOrchestrator(
    provider,
    createToolExecutor(createUnifiedRetrieval(deps)),
  ).run("Only approved coffee places, do not include research or candidates.");
  assert.equal(result.status, "denied");
  assert.ok(!calls[0].allowedCapabilities.includes("search_food_research"));
});
test("ordinary local location/hours prose is rejected without depending on BGC or currency keyword", () => {
  for (const text of [
    "Cafe Example at 10th Avenue is open until midnight.",
    "Acme operates in Example Tower.",
    "The restaurant has vegan options.",
    "This shop has stock today.",
  ])
    assert.equal(safeGeneralText(text), false);
  assert.equal(safeGeneralText("Hello! I can help with this app."), true);
  assert.equal(isGeneralConversation("Tell me about Uptown Mall"), false);
  assert.equal(isGeneralConversation("Hello, what can you do?"), true);
});
test("bounded tool observations stay valid JSON and never truncate structural delimiters", () => {
  const rows = Array.from({ length: 20 }, (_, n) => ({
    restaurant: {
      id: id(n),
      name: "x".repeat(1000),
      category: "x".repeat(1000),
    },
    items: Array.from({ length: 4 }, () => ({
      id: id(n + 100),
      name: "y".repeat(1000),
      category: "y".repeat(1000),
    })),
  }));
  const observation = toolObservation({
    callId: "HOST",
    name: "search_food_research",
    status: "ok",
    authority: "research",
    warnings: ["Research"],
    data: rows,
  });
  assert.ok(observation.length <= 5000);
  assert.equal(JSON.parse(observation).observationType, "UNTRUSTED_LOCAL_DATA");
});

test("production office adapters refresh active source packs on each search/detail and honor revocation immediately", async () => {
  const officeRules = loadTs("apps/mobile/src/features/offices/service.ts");
  const events = [];
  let rightsActive = true,
    cache = [];
  const office = {
    placeId: id(80),
    organizationId: id(81),
    organizationName: "Synthetic organization",
    name: "Synthetic approved office",
    aliases: [],
    industry: null,
    district: "test-only",
    address: "Synthetic address",
    buildingId: null,
    building: null,
    floor: null,
    presence: "operating",
    state: "operating",
    locationKind: "unknown",
    coordinate: null,
    verifiedAt: "2026-01-02T00:00:00Z",
    validUntil: "2099-01-01T00:00:00Z",
    citations: [
      {
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
      },
    ],
  };
  const { createAppRetrieval } = loadTs("apps/mobile/src/ai/retrieval.ts", {
    "../data/retrieval": {
      findPlaces: async () => [],
      getPlaceDetails: async () => null,
      findMenuItems: async () => [],
    },
    "../data/store": {
      loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }),
      loadPlaces: async () => {
        events.push("refresh");
        cache = rightsActive ? [office] : [];
        return [];
      },
    },
    "../features/offices/service": {
      operatingOffice: officeRules.operatingOffice,
      searchOffices: () => {
        events.push("search");
        return { items: cache, total: cache.length };
      },
      getOfficeDetails: () => {
        events.push("detail");
        return cache[0] ?? null;
      },
    },
    "../features/food/directory": { foodResearch: undefined },
  });
  const retrieval = await createAppRetrieval();
  assert.equal((await retrieval.findApprovedOffices()).data.length, 1);
  assert.equal((await retrieval.getOfficeDetails(id(80))).data.placeId, id(80));
  rightsActive = false;
  assert.equal((await retrieval.findApprovedOffices()).status, "empty");
  assert.equal((await retrieval.getOfficeDetails(id(80))).data, null);
  assert.deepEqual(events, [
    "refresh",
    "search",
    "refresh",
    "detail",
    "refresh",
    "search",
    "refresh",
    "detail",
  ]);
});
