const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("../helpers/load-ts.cjs");
const { AgentOrchestrator } = loadTs("apps/mobile/src/ai/AgentOrchestrator.ts");
const { createToolExecutor } = loadTs("apps/mobile/src/ai/toolExecutor.ts");
const { createUnifiedRetrieval } = loadTs("apps/mobile/src/ai/retrieval.ts");

function harness(
  firstProposal = {
    version: 1,
    name: "find_menu_items",
    arguments: { query: "Synthetic pasta" },
  },
) {
  const reads = [];
  const inputs = [];
  const retrieval = createUnifiedRetrieval({
    findPlaces: async () => [],
    getPlaceDetails: async () => null,
    findMenuItems: async (args) => {
      reads.push(args);
      return [];
    },
    loadSaved: async () => ({ placeIds: [], itinerary: [], startTime: null }),
    searchOffices: () => ({ items: [], total: 0 }),
    getOfficeDetails: () => null,
  });
  const provider = {
    getCapabilities: async () => ({ supportedContextTokens: 4096 }),
    cancel: async () => ({}),
    stream: async (input) => {
      inputs.push(input);
      return {
        requestId: input.requestId,
        epoch: input.epoch,
        text: "",
        toolProposals: inputs.length === 1 ? [firstProposal] : [],
        nativeQuiescent: true,
        finishReason: "complete",
      };
    },
  };
  return {
    reads,
    inputs,
    agent: new AgentOrchestrator(provider, createToolExecutor(retrieval)),
  };
}

test("price questions and follow-ups can reach the approved menu service", async () => {
  for (const question of [
    "How much is Synthetic pasta?",
    "How much is it?",
    "Show prices for Synthetic pasta",
    "Show menus",
    "Show dishes",
    "Magkano ang Synthetic pasta?",
    "Magkano iyon?",
    "How much is it? Do not include research or candidates.",
  ]) {
    const { agent, reads, inputs } = harness();
    const turn = await agent.run(question, {
      recentMessages: [{ role: "user", text: "Find Synthetic pasta." }],
    });
    assert.equal(turn.status, "completed", question);
    assert.ok(reads.length >= 1, question);
    assert.ok(
      reads.every((args) => args.query === "Synthetic pasta"),
      question,
    );
    assert.equal(turn.results[0].name, "find_menu_items", question);
    assert.ok(
      inputs[0].allowedCapabilities.includes("find_menu_items"),
      question,
    );
    const researchExpected = !question.includes("Do not include research");
    assert.equal(inputs[0].allowedCapabilities.includes("search_food_research"), researchExpected, question);
    assert.equal(inputs[0].allowedCapabilities.includes("get_food_research_details"), researchExpected, question);
  }
});

test("a price question does not authorize explicitly excluded research", async () => {
  const { agent, reads, inputs } = harness({
    version: 1,
    name: "search_food_research",
    arguments: {},
  });
  const turn = await agent.run(
    "How much is it? Do not include research or candidates.",
  );
  assert.equal(turn.status, "denied");
  assert.equal(reads.length, 0);
  assert.ok(inputs[0].allowedCapabilities.includes("find_menu_items"));
  assert.ok(!inputs[0].allowedCapabilities.includes("search_food_research"));
  assert.ok(
    !inputs[0].allowedCapabilities.includes("get_food_research_details"),
  );
});

test("general chat still denies an unsolicited menu proposal", async () => {
  const { agent, reads, inputs } = harness();
  const turn = await agent.run("Hello");
  assert.equal(turn.status, "denied");
  assert.equal(reads.length, 0);
  assert.ok(!inputs[0].allowedCapabilities.includes("find_menu_items"));
});
