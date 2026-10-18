const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("../helpers/load-ts.cjs");
const { parseUserPhpPriceBounds, checkedPhpBounds } = loadTs(
  "apps/mobile/src/domain/priceBounds.ts",
);
const { decodeToolProposal, toolDefinitions, TOOL_CONTRACT_REVISION } = loadTs(
  "apps/mobile/src/ai/tools.ts",
);
const { filterMenuItems } = loadTs("apps/mobile/src/data/retrieval.ts", {
  "./store": {},
});
const { createUnifiedRetrieval } = loadTs("apps/mobile/src/ai/retrieval.ts");
const { createToolExecutor } = loadTs("apps/mobile/src/ai/toolExecutor.ts");
const { revalidateToolResult } = loadTs("apps/mobile/src/ai/answerComposer.ts");
const { AgentOrchestrator } = loadTs("apps/mobile/src/ai/AgentOrchestrator.ts");
const { createFoodResearchService } = loadTs(
  "apps/mobile/src/features/food/service.ts",
);
const { createFoodResearchAnswer } = loadTs(
  "apps/mobile/src/features/food/assistant.ts",
);
const { answerDirectoryQuery } = loadTs(
  "apps/mobile/src/features/assistant/directory.ts",
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const citation = {
  sourceId: "SYNTHETIC-PRICE-RANGE",
  label: "Authored test only",
  license: "CC0-1.0",
  observedAt: "2026-01-01T00:00:00Z",
  verifiedAt: "2026-01-02T00:00:00Z",
  status: "approved",
  factId: id(80),
  snapshotId: id(81),
  evidenceId: id(82),
  rawSha256: "a".repeat(64),
  locator: "fixture://price-range",
  verificationMethod: "authored-test",
};
const item = (n, amount, extra = {}) => ({
  id: id(n),
  name: "Synthetic ramen",
  citation,
  relationshipCitations: [citation, citation],
  priceCitation: citation,
  priceValue: { currency: "PHP", amount },
  ...extra,
});
const place = {
  id: id(1),
  name: "Synthetic approved branch",
  category: "Food",
  status: "approved",
  coordinate: null,
  aliases: [],
  entrances: [],
  citations: [citation],
  menus: [],
};
const prices = () => [
  item(10, "299.99"),
  item(11, "300.00"),
  item(12, "499.99"),
  item(13, "500.00"),
  item(14, "500.01"),
  item(15, "1.00", { priceValue: undefined }),
  item(16, "1.00", { priceValue: { currency: "USD", amount: "1.00" } }),
  item(17, "400.00", { priceCitation: { ...citation, status: "candidate" } }),
  item(18, "400.00", { relationshipCitations: [citation] }),
];
const deps = {
  findPlaces: async () => [place],
  getPlaceDetails: async (key) => (key === place.id ? place : null),
  findMenuItems: async () => [],
  loadSaved: async () => {
    throw Error("NO SAVED READS");
  },
  searchOffices: () => ({ items: [], total: 0 }),
  getOfficeDetails: () => null,
};
const proposal = (name, args = {}) => ({ version: 1, name, arguments: args });
const context = (extra) => ({
  requestId: "HOST",
  researchEnabled: true,
  resolvedPlaceIds: new Set(),
  ...extra,
});
const ids = (rows) => Array.from(rows, (row) => row.item.id).sort();
function researchService() {
  const restaurant = {
    id: id(50),
    externalId: "TEST-ONLY",
    origin: "research",
    name: "Synthetic research ramen",
    type: "restaurant",
    zone: null,
    building: null,
    floor: null,
    locationOriginal: null,
    locationSpecificity: null,
    locationSourceUrl: null,
    menuStatus: "research",
    menuBranch: "Test branch qualifier",
    notes: null,
    researchDate: "2026-01-01",
    hours: {
      text: null,
      kind: "unknown",
      evidence: "test",
      sourceUrl: null,
      venueText: null,
      venueSourceUrl: null,
      weeklySchedule: null,
    },
    items: [],
  };
  restaurant.items = ["299.99", "300.00", "499.99", "500.00", "500.01"].map(
    (amount, n) => ({
      id: id(60 + n),
      restaurantId: restaurant.id,
      origin: "research",
      name: "Synthetic ramen",
      section: null,
      category: "ramen",
      tags: [],
      description: null,
      amount,
      currency: "PHP",
      priceEvidence: n % 2 ? "published-starting" : "estimated",
      priceSourceUrl: null,
      estimationBasis: "Authored test estimate",
      menuSourceUrl: null,
      branch: "Test branch qualifier",
      researchStatus: "research",
      researchDate: "2026-01-01",
    }),
  );
  return createFoodResearchService({
    version: "food-research-v1",
    restaurants: [restaurant],
  });
}
function controlled(calls, capture) {
  let round = 0;
  return {
    id: "CONTROLLED_NO_MODEL",
    getCapabilities: async () => ({ supportedContextTokens: 4096 }),
    cancel: async () => ({ accepted: true, nativeQuiescent: false }),
    stream: async (input) => {
      capture.push(input);
      return {
        requestId: input.requestId,
        epoch: input.epoch,
        nativeQuiescent: true,
        finishReason: "complete",
        text: "",
        toolProposals: calls[round++] ?? [],
      };
    },
  };
}

test("shared parser keeps strict under/below and inclusive between semantics without float rounding", () => {
  for (const [query, expected] of [
    ["ramen under500", { maxPhp: "499.99" }],
    ["ramen below PHP 500.01", { maxPhp: "500.00" }],
    [
      "ramen between PHP 300 and PHP 500",
      { minPhp: "300.00", maxPhp: "500.00" },
    ],
    [
      "ramen between 300.01 to 500.01 pesos",
      { minPhp: "300.01", maxPhp: "500.01" },
    ],
    ["ramen between 500-500", { minPhp: "500.00", maxPhp: "500.00" }],
    ["ramen at least 300", { minPhp: "300.00" }],
    ["hindi hihigit sa 120 piso", { maxPhp: "120.00" }],
    ["under PHP 999999999999.99", { maxPhp: "999999999999.98" }],
  ]) {
    const parsed = parseUserPhpPriceBounds(query);
    assert.equal(parsed.kind, "valid", query);
    assert.equal(
      JSON.stringify(parsed.bounds),
      JSON.stringify(expected),
      query,
    );
  }
  for (const query of [
    "hello",
    "Between Blue and Amber, which branch?",
    "The cafe below the office",
    "Find restaurant between 5th and 7th street",
    "Find a cafe between 5 and 7 Main Street",
    "Find dinner for 2 people",
    "a visit for 2 hours",
    "Find a table for 4",
  ])
    assert.equal(parseUserPhpPriceBounds(query).kind, "none", query);
  for (const query of [
    "ramen under PHP -1",
    "ramen under PHP 1.001",
    "ramen under PHP 1,000",
    "ramen between 500 and 300",
    "ramen between 300 and",
    "ramen between these prices",
    "ramen under 1e3",
    "ramen under USD 500",
    "ramen under 500 USD",
    "ramen under 500-600",
    "ramen under 500 or between 600 and 700",
    "ramen between 300 and 500 or 700",
    "ramen not under500",
    "ramen not below PHP500",
    "ramen below PHP0",
    "ramen under$500",
  ])
    assert.equal(parseUserPhpPriceBounds(query).kind, "invalid", query);
  assert.equal(
    parseUserPhpPriceBounds("ramen under500, please").bounds.maxPhp,
    "499.99",
  );
  assert.equal(
    parseUserPhpPriceBounds("seafood under500 pesos.").bounds.maxPhp,
    "499.99",
  );
  assert.equal(
    parseUserPhpPriceBounds("ramen under500.").bounds.maxPhp,
    "499.99",
  );
  assert.equal(
    parseUserPhpPriceBounds("ramen between 300 and 500, please").bounds.maxPhp,
    "500.00",
  );
});

test("v3 tool bounds reject malformed/unordered values without float rounding", () => {
  assert.equal(TOOL_CONTRACT_REVISION, "omni-local-tools-v3");
  assert.ok(
    toolDefinitions().find((x) => x.name === "find_menu_items").parameters
      .properties.minPricePhp,
  );
  for (const name of ["find_menu_items", "search_food_research"]) {
    const [min, max] =
      name === "find_menu_items"
        ? ["minPricePhp", "maxPricePhp"]
        : ["minPhp", "maxPhp"];
    assert.equal(
      decodeToolProposal(
        proposal(name, { [min]: "300.01", [max]: "500.01" }),
        "HOST",
      ).arguments[min],
      "300.01",
    );
    for (const args of [
      { [min]: "-1" },
      { [min]: "0.001" },
      { [min]: 300 },
      { [min]: "500.01", [max]: "500.00" },
    ])
      assert.throws(() => decodeToolProposal(proposal(name, args), "HOST"), {
        code: "TOOL_PROTOCOL_INVALID",
      });
  }
  const checked = checkedPhpBounds("999999999999.98", "999999999999.99");
  assert.equal(checked.max - checked.min, 1n);
});

test("pure production menu filter and weak-adapter facade enforce both edges and lineage", async () => {
  const branch = { ...place, menus: prices() };
  const filters = {
    query: "ramen",
    minPricePhp: "300.00",
    maxPricePhp: "500.00",
  };
  assert.deepEqual(ids(filterMenuItems([branch], filters)), [
    id(11),
    id(12),
    id(13),
  ]);
  assert.deepEqual(ids(filterMenuItems([branch], { minPricePhp: "500.00" })), [
    id(13),
    id(14),
  ]);
  assert.throws(() =>
    filterMenuItems([branch], { minPricePhp: "500.01", maxPricePhp: "500.00" }),
  );
  const retrieval = createUnifiedRetrieval({
    ...deps,
    findMenuItems: async (passed) => {
      passed.minPricePhp = "0";
      passed.maxPricePhp = "999999";
      return prices().map((item) => ({
        branchId: place.id,
        branchName: place.name,
        item,
      }));
    },
  });
  const found = await retrieval.findMenuItems(filters);
  assert.deepEqual(ids(found.data), [id(11), id(12), id(13)]);
  assert.equal(found.appliedFilters.minPricePhp, "300.00");
  assert.equal(found.appliedFilters.maxPricePhp, "500.00");
  assert.deepEqual(
    ids(
      (
        await revalidateToolResult(
          { ...found, callId: "HOST", name: "find_menu_items" },
          retrieval,
        )
      ).data,
    ),
    [id(11), id(12), id(13)],
  );
});

test("real food service uses minimum-only menu path; facade excludes bad weak-service amounts", async () => {
  const service = researchService();
  assert.equal(service.available, true);
  let establishments = 0,
    menus = 0;
  const weak = {
    ...service,
    searchFoodEstablishments: (f) => {
      establishments++;
      return service.searchFoodEstablishments(f);
    },
    searchFoodMenuItems: (f) => {
      menus++;
      const rows = service.searchFoodMenuItems({ query: "ramen" });
      return {
        ...rows,
        results: [
          ...rows.results,
          {
            ...rows.results[0],
            item: { ...rows.results[0].item, id: id(70), amount: "unknown" },
          },
          {
            ...rows.results[0],
            item: { ...rows.results[0].item, id: id(71), currency: "USD" },
          },
        ],
      };
    },
  };
  const retrieval = createUnifiedRetrieval({ ...deps, foodResearch: weak });
  const found = await retrieval.searchFoodResearch({
    query: "ramen",
    minPhp: "300.00",
    maxPhp: "500.00",
  });
  assert.deepEqual(
    Array.from(found.data, (row) => row.items[0].amount).sort(),
    ["300.00", "499.99", "500.00"],
  );
  const minimum = await retrieval.searchFoodResearch({ minPhp: "500.00" });
  assert.deepEqual(
    Array.from(minimum.data, (row) => row.items[0].amount).sort(),
    ["500.00", "500.01"],
  );
  assert.equal(establishments, 0);
  assert.equal(menus, 2);
  await assert.rejects(
    retrieval.searchFoodResearch({ minPhp: "500", maxPhp: "300" }),
  );
});

test("executor applies authoritative user range without mutating raw model proposals or effective revalidation", async () => {
  const retrieval = createUnifiedRetrieval({
    ...deps,
    findMenuItems: async () =>
      prices().map((item) => ({
        branchId: place.id,
        branchName: place.name,
        item,
      })),
  });
  const executor = createToolExecutor(retrieval);
  const raw = proposal("find_menu_items", {
    query: "ramen",
    minPricePhp: "0",
    maxPricePhp: "999999",
  });
  const original = JSON.stringify(raw);
  const found = await executor.execute(
    raw,
    "HOST",
    context({ userPriceBounds: { minPhp: "300.00", maxPhp: "500.00" } }),
  );
  assert.equal(JSON.stringify(raw), original);
  assert.deepEqual(ids(found.data), [id(11), id(12), id(13)]);
  assert.equal(found.appliedFilters.minPricePhp, "300.00");
  assert.equal(found.appliedFilters.maxPricePhp, "500.00");
  const upperOnly = await executor.execute(
    proposal("find_menu_items", { minPricePhp: "499.99", maxPricePhp: "900" }),
    "HOST",
    context({ userPriceBounds: { maxPhp: "500.00" } }),
  );
  assert.equal(upperOnly.appliedFilters.minPricePhp, undefined);
  assert.deepEqual(ids(upperOnly.data), [id(10), id(11), id(12), id(13)]);
});

test("actual orchestration enforces omitted and widened native menu filters and clarifies invalid ranges before provider", async () => {
  for (const args of [
    { query: "ramen" },
    { query: "ramen", minPricePhp: "0", maxPricePhp: "999999" },
  ]) {
    const captures = [],
      raw = proposal("find_menu_items", args);
    const retrieval = createUnifiedRetrieval({
      ...deps,
      findMenuItems: async () =>
        prices().map((item) => ({
          branchId: place.id,
          branchName: place.name,
          item,
        })),
    });
    const turn = await new AgentOrchestrator(
      controlled([[raw], []], captures),
      createToolExecutor(retrieval),
    ).run("Find ramen between PHP 300 and PHP 500");
    assert.equal(turn.status, "completed");
    assert.deepEqual(ids(turn.results[0].data), [id(11), id(12), id(13)]);
    assert.equal(turn.results[0].appliedFilters.minPricePhp, "300.00");
    const transcriptCall = captures[1].messages.find(
      (message) => message.toolCalls,
    )?.toolCalls[0];
    assert.equal(
      JSON.stringify(transcriptCall.arguments),
      JSON.stringify(args),
    );
  }
  const calls = [],
    agent = new AgentOrchestrator(
      controlled([[]], calls),
      createToolExecutor(createUnifiedRetrieval(deps)),
    );
  const invalid = await agent.run("Find ramen between PHP 500 and PHP 300");
  assert.equal(calls.length, 0);
  assert.equal(invalid.status, "unavailable");
  assert.match(invalid.payloads[0].text, /lower price first/);
});

test("ordinary menu query reads qualified recorded food DB but opt-outs and greetings cannot enable that lane", async () => {
  const service = researchService();
  const retrieval = createUnifiedRetrieval({
    ...deps,
    findPlaces: async () => [],
    getPlaceDetails: async () => null,
    foodResearch: service,
  });
  const captures = [],
    raw = proposal("search_food_research", {
      query: "ramen",
      minPhp: "0",
      maxPhp: "999999",
    });
  const turn = await new AgentOrchestrator(
    controlled([[raw], []], captures),
    createToolExecutor(retrieval),
  ).run("Find ramen between PHP 300 and PHP 500");
  const result = turn.results[0];
  assert.equal(result.authority, "research");
  assert.equal(result.citations.length, 0);
  assert.deepEqual(
    Array.from(result.data, (row) => row.items[0].amount).sort(),
    ["300.00", "499.99", "500.00"],
  );
  assert.equal(result.appliedFilters.minPhp, "300.00");
  assert.equal(result.data[0].evidence.rightsReview, "pending");
  assert.equal(result.data[0].items[0].branch, "Test branch qualifier");
  assert.ok(
    result.data.some(
      (row) => row.items[0].priceEvidence === "published-starting",
    ),
  );
  assert.ok(
    result.data.some((row) => row.items[0].priceEvidence === "estimated"),
  );
  assert.ok(turn.payloads.some((payload) => payload.kind === "food-menus"));
  assert.ok(
    !turn.payloads.some(
      (payload) => payload.kind === "menus" || payload.kind === "places",
    ),
  );
  for (const query of [
    "Find approved only ramen under500",
    "Find verified only ramen under500",
    "Find ramen under500 without research",
    "Find ramen under500 no estimates",
    "Find ramen under500 using approved records only",
    "Use verified results only for ramen under500",
    "Find ramen under500, approved lang",
    "hello",
    "What is the weather?",
  ]) {
    const inputs = [];
    await new AgentOrchestrator(
      controlled(
        [[proposal("search_food_research", { query: "ramen" })]],
        inputs,
      ),
      createToolExecutor(retrieval),
    ).run(query);
    assert.ok(
      inputs.every(
        (input) =>
          !input.tools.some((tool) => tool.name === "search_food_research"),
      ),
      query,
    );
  }
});

test("no-model fallback respects source opt-outs and approved generic dish matches take precedence", () => {
  const askResearch = createFoodResearchAnswer(researchService());
  const researchPlace = {
    id: id(50),
    name: "Synthetic research ramen",
    status: "candidate",
    aliases: [],
    menus: [],
    entrances: [],
    citations: [],
    coordinate: null,
    category: "Food",
  };
  const approved = {
    ...place,
    menus: [item(11, "300.00"), item(13, "500.00")],
  };
  let delegated = 0;
  const answer = answerDirectoryQuery(
    "Find ramen under500",
    [approved, researchPlace],
    undefined,
    (...args) => {
      delegated++;
      return askResearch(...args);
    },
  );
  assert.equal(delegated, 0);
  assert.equal(
    answer.find((payload) => payload.kind === "menus").items[0].item.id,
    id(11),
  );
  assert.ok(!answer.some((payload) => payload.kind === "food-menus"));
  for (const query of [
    "Find Synthetic research ramen menu under500 approved records only",
    "Find Synthetic research ramen menu under500 verified results only",
    "Find ramen under500, approved lang",
    "Find ramen under500 without research",
    "Find ramen under500 no estimates",
  ]) {
    assert.equal(askResearch(query, [researchPlace]), null, query);
    assert.ok(
      !answerDirectoryQuery(
        query,
        [researchPlace],
        undefined,
        askResearch,
      ).some(
        (payload) => payload.kind === "food-menus" || payload.kind === "places",
      ),
      query,
    );
  }
  const restricted = answerDirectoryQuery(
    "Find ramen under500 using approved records only",
    [approved, researchPlace],
    undefined,
    askResearch,
  );
  assert.equal(
    restricted.find((payload) => payload.kind === "menus").items[0].item.id,
    id(11),
  );
  const inclusive = answerDirectoryQuery(
    "Menu ramen between500 and500",
    [approved],
    undefined,
  );
  assert.equal(
    inclusive.find((payload) => payload.kind === "menus").items[0].item.id,
    id(13),
  );
});

test("ordinary menu search retrieves a later matching dish instead of sampling unrelated first items", async () => {
  const restaurant = JSON.parse(
    JSON.stringify(researchService().restaurants[0]),
  );
  restaurant.items.push({
    ...restaurant.items[0],
    id: id(90),
    name: "Synthetic late special",
  });
  const service = createFoodResearchService({
    version: "food-research-v1",
    restaurants: [restaurant],
  });
  const retrieval = createUnifiedRetrieval({ ...deps, foodResearch: service });
  const found = await createToolExecutor(retrieval).execute(
    proposal("search_food_research", { query: "special" }),
    "HOST",
    context({ ordinaryMenuResearch: true }),
  );
  assert.equal(found.status, "ok");
  assert.deepEqual(
    Array.from(found.data, (row) => row.items[0].id),
    [id(90)],
  );
  assert.equal(found.appliedFilters.menuItemsOnly, true);
});

test("ordinary research dispatch yields to actual approved matches; explicit research remains distinct", async () => {
  let researchReads = 0;
  const service = researchService(),
    observed = {
      ...service,
      searchFoodMenuItems: (f) => {
        researchReads++;
        return service.searchFoodMenuItems(f);
      },
    };
  const retrieval = createUnifiedRetrieval({
    ...deps,
    foodResearch: observed,
    findMenuItems: async () => [
      { branchId: place.id, branchName: place.name, item: item(11, "300.00") },
    ],
  });
  const executor = createToolExecutor(retrieval),
    raw = proposal("search_food_research", { query: "ramen" });
  const ordinary = await executor.execute(
    raw,
    "HOST",
    context({
      ordinaryMenuResearch: true,
      userPriceBounds: { minPhp: "300", maxPhp: "500" },
    }),
  );
  assert.equal(ordinary.status, "unavailable");
  assert.doesNotMatch(ordinary.warnings.join(' '), /find_menu_items|approved|research/);
  assert.equal(researchReads, 0);
  const detailsFirst = await executor.execute(
    proposal("get_food_research_details", { restaurantId: id(50) }),
    "HOST",
    context({ ordinaryMenuResearch: true }),
  );
  assert.equal(detailsFirst.status, "unavailable");
  assert.equal(researchReads, 0);
  const explicit = await executor.execute(
    raw,
    "HOST",
    context({
      ordinaryMenuResearch: false,
      userPriceBounds: { minPhp: "300", maxPhp: "500" },
    }),
  );
  assert.equal(explicit.authority, "research");
  assert.equal(researchReads, 1);
});

test("ordinary research details require a current qualifying search and never become approved action identities", async () => {
  const retrieval = createUnifiedRetrieval({
    ...deps,
    foodResearch: researchService(),
  });
  const executor = createToolExecutor(retrieval),
    ctx = context({
      ordinaryMenuResearch: true,
      userPriceBounds: { maxPhp: "499.99" },
    });
  const first = await executor.execute(
    proposal("get_food_research_details", { restaurantId: id(50) }),
    "HOST",
    ctx,
  );
  assert.equal(first.status, "unavailable");
  const search = await executor.execute(
    proposal("search_food_research", { query: "ramen" }),
    "HOST",
    ctx,
  );
  assert.equal(search.status, "ok");
  assert.ok(ctx.resolvedResearchRestaurantIds.has(id(50)));
  assert.equal(ctx.resolvedPlaceIds.size, 0);
  const details = await executor.execute(
    proposal("get_food_research_details", { restaurantId: id(50) }),
    "HOST",
    ctx,
  );
  assert.equal(details.authority, "research");
  assert.ok(
    details.data[0].items.every(
      (item) => item.amount !== "500.00" && item.amount !== "500.01",
    ),
  );
  assert.equal(
    (
      await executor.execute(
        proposal("focus_map_place", { placeId: id(50) }),
        "HOST",
        ctx,
      )
    ).status,
    "denied",
  );
});

test("native orchestration and no-model food fallback share strict under and inclusive range endpoints", async () => {
  const service = researchService();
  const ask = createFoodResearchAnswer(service),
    displayRecords = [
      {
        id: id(50),
        status: "candidate",
        name: "Synthetic research ramen",
        aliases: [],
      },
    ];
  const retrieval = createUnifiedRetrieval({ ...deps, foodResearch: service });
  for (const [query, expected] of [
    ["Find ramen under500", ["299.99", "300.00", "499.99"]],
    ["Find ramen below PHP500.01", ["299.99", "300.00", "499.99", "500.00"]],
    ["Find ramen between300 and500", ["300.00", "499.99", "500.00"]],
    ["Find ramen for500 pesos", ["299.99", "300.00", "499.99", "500.00"]],
  ]) {
    const capture = [];
    const turn = await new AgentOrchestrator(
      controlled(
        [[proposal("search_food_research", { query: "ramen" })], []],
        capture,
      ),
      createToolExecutor(retrieval),
    ).run(query);
    assert.deepEqual(
      Array.from(turn.results[0].data, (row) => row.items[0].amount).sort(),
      expected,
      query,
    );
    const fallback = ask(query, displayRecords).find(
      (payload) => payload.kind === "food-menus",
    );
    assert.ok(fallback, query);
    assert.deepEqual(
      Array.from(fallback.items, (row) => row.item.amount).sort(),
      expected,
      query,
    );
    assert.ok(
      fallback.items.every((row) => row.evidence.rightsReview === "pending"),
    );
  }
  for (const query of [
    "ramen between500 and300",
    "ramen under -1",
    "ramen not under500",
  ])
    assert.match(ask(query, displayRecords)[0].text, /lower price first/);
});

test("research details cannot bypass explicit price range during initial dispatch or final render revalidation", async () => {
  const retrieval = createUnifiedRetrieval({
    ...deps,
    foodResearch: researchService(),
  });
  const result = await createToolExecutor(retrieval).execute(
    proposal("get_food_research_details", { restaurantId: id(50) }),
    "HOST",
    context({ userPriceBounds: { minPhp: "300", maxPhp: "500" } }),
  );
  const amounts = (r) =>
    Array.from(r.data[0].items, (item) => item.amount).sort();
  assert.deepEqual(amounts(result), ["300.00", "499.99", "500.00"]);
  assert.deepEqual(amounts(await revalidateToolResult(result, retrieval)), [
    "300.00",
    "499.99",
    "500.00",
  ]);
});
