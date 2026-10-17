const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hookHarness } = require("../helpers/hooks.cjs");
const { loadTs } = require("../helpers/load-ts.cjs");
const flush = () => new Promise((resolve) => setImmediate(resolve));
const defer = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function setup({ delayedRuntime = false, restored = [] } = {}) {
  const hooks = hookHarness(),
    startup = defer(),
    turns = [],
    persisted = [],
    listeners = {};
  const counts = { cleared: 0, canceled: 0, closed: 0, commits: 0, previewsCleared: 0 };
  const service = {
    history: {
      load: async () => (counts.cleared ? [] : restored),
      append: async (records) => persisted.push(records),
      clear: async () => {
        counts.cleared++;
      },
    },
    initialize: async () => true,
    getManager: () => null,
    agent: {
      run: (text, options) => {
        const turn = defer();
        turns.push({ text, options, ...turn });
        return turn.promise;
      },
      cancel: () => {
        counts.canceled++;
      },
    },
    itineraryPreview: { clear() { counts.previewsCleared++; }, cancelPending() {} },
    close: async () => {
      counts.closed++;
    },
  };
  const saved = { placeIds: [], itinerary: [], startTime: null };
  const { useAssistantConversation } = loadTs(
    "apps/mobile/src/features/assistant/useAssistantConversation.ts",
    {
      react: hooks.React,
      "react-native": {
        AppState: {
          addEventListener: (name, cb) => {
            listeners[name] = cb;
            return { remove: () => delete listeners[name] };
          },
        },
      },
      "./directory": {
        answerDirectoryQuery: () => [
          { kind: "text", text: "Deterministic fixture response" },
        ],
      },
      "../food/assistant": { createFoodResearchAnswer: () => () => [] },
      "../food/directory": { foodResearch: {} },
      "../../ai/assistantRuntime": {
        createAssistantRuntime: () =>
          delayedRuntime ? startup.promise : Promise.resolve(service),
      },
      "../../data/store": { loadSaved: async () => saved },
    },
  );
  const render = () =>
    hooks.render(() => useAssistantConversation([], () => true));
  render();
  return {
    render,
    hooks,
    service,
    startup,
    turns,
    persisted,
    counts,
    listeners,
    async ready() {
      await flush();
      return render();
    },
  };
}
const result = (text = "Hello!", extra = {}) => ({
  status: "completed",
  payloads: [{ kind: "text", text }],
  results: [],
  ...extra,
});

test("actual async Assistant hook streams partial text then replaces and persists exactly one finalized response", async () => {
  const h = setup();
  let ui = await h.ready();
  assert.equal(ui.send("hello"), true);
  h.turns[0].options.onDelta("Hello");
  ui = h.render();
  assert.equal(ui.messages.filter((m) => m.payload.partial).length, 1);
  assert.equal(h.persisted.length, 0);
  h.turns[0].resolve(result("Hello!"));
  await flush();
  ui = h.render();
  assert.equal(ui.busy, false);
  assert.equal(ui.messages.filter((m) => m.payload.kind === "text").length, 1);
  assert.equal(ui.messages.at(-1).payload.partial, undefined);
  assert.equal(ui.messages.at(-1).payload.text, "Hello!");
  assert.equal(h.persisted.length, 1);
  assert.equal(h.persisted[0].length, 2);
  assert.equal(h.persisted[0][0].payload.kind, "user");
  h.hooks.dispose();
});
test("Stop suppresses stale native deltas/results and does not persist a partial as completed", async () => {
  const h = setup();
  let ui = await h.ready();
  ui.send("hello");
  h.turns[0].options.onDelta("Hello");
  ui = h.render();
  ui.cancel();
  h.turns[0].options.onDelta(" STALE");
  h.turns[0].resolve(result("STALE FINAL"));
  await flush();
  ui = h.render();
  assert.equal(ui.busy, false);
  assert.equal(ui.cancelled, true);
  assert.ok(!JSON.stringify(ui.messages).includes("STALE"));
  assert.equal(h.persisted.length, 0);
  h.hooks.dispose();
});
test("background invalidates active request, preview and late callbacks", async () => {
  const h = setup();
  let ui = await h.ready();
  ui.send("hello");
  h.listeners.change("background");
  assert.equal(h.turns[0].options.signal.aborted, true);
  h.turns[0].options.onDelta("STALE");
  h.turns[0].resolve(result("STALE"));
  await flush();
  ui = h.render();
  assert.equal(ui.busy, false);
  assert.equal(ui.pending, undefined);
  assert.ok(!JSON.stringify(ui.messages).includes("STALE"));
  assert.equal(h.persisted.length, 0);
  h.hooks.dispose();
});
test("clear before runtime initialization is applied to separate history before any restore", async () => {
  const h = setup({
    delayedRuntime: true,
    restored: [
      { id: "historic", payload: { kind: "text", text: "OLD HISTORY" } },
    ],
  });
  await h.render().clear();
  h.startup.resolve(h.service);
  await flush();
  const ui = h.render();
  assert.equal(h.counts.cleared, 1);
  assert.equal(ui.messages.length, 0);
  h.hooks.dispose();
});
test("clear during generation suppresses late completion and preserves empty chat/history", async () => {
  const h = setup();
  let ui = await h.ready();
  ui.send("hello");
  await h.render().clear();
  h.turns[0].resolve(result("STALE"));
  await flush();
  ui = h.render();
  assert.equal(ui.messages.length, 0);
  assert.equal(h.counts.cleared, 1);
  assert.equal(h.persisted.length, 0);
  h.hooks.dispose();
});
test("late runtime creation after unmount closes runtime without updating disposed hook", async () => {
  const h = setup({ delayedRuntime: true });
  h.hooks.dispose();
  const before = h.hooks.updates();
  h.startup.resolve(h.service);
  await flush();
  assert.equal(h.counts.closed, 1);
  assert.equal(h.hooks.updates(), before);
});
test("superseded completed turn cannot pollute canonical reference IDs for a later turn", async () => {
  const h = setup();
  let ui = await h.ready();
  ui.send("hello");
  ui = h.render();
  ui.cancel();
  ui = h.render();
  ui.send("hello");
  h.turns[0].resolve(
    result("STALE", {
      results: [
        { status: "ok", authority: "approved", sourceRecordIds: ["STALE_ID"] },
      ],
    }),
  );
  await flush();
  h.turns[1].resolve(result("Fresh"));
  await flush();
  ui = h.render();
  ui.send("hello");
  assert.equal(h.turns[2].options.resolvedPlaceIds.length, 0);
  h.turns[2].resolve(result());
  await flush();
  h.hooks.dispose();
});
test("legacy confirmation results cannot expose a persistence action", async () => {
  const h = setup();
  let ui = await h.ready();
  ui.send("save");
  h.turns[0].resolve(result("", { status: "needs_confirmation", results: [{ status: "needs_confirmation", data: { pendingId: "OLD" } }] }));
  await flush(); ui = h.render();
  assert.equal(ui.confirm, undefined);
  assert.equal(ui.pending, undefined);
  assert.equal(h.counts.commits, 0);
  h.hooks.dispose();
});

test("superseded rejected turn cannot disable the current native-ready conversation", async () => {
  const h = setup();
  let ui = await h.ready();
  ui.send("hello");
  ui = h.render();
  ui.cancel();
  ui = h.render();
  ui.send("hello");
  h.turns[0].reject(new Error("STALE PROVIDER ERROR"));
  await flush();
  h.turns[1].resolve(result("Fresh"));
  await flush();
  ui = h.render();
  ui.send("hello");
  assert.equal(h.turns.length, 3);
  h.turns[2].resolve(result());
  await flush();
  h.hooks.dispose();
});

test("hook preserves actual displayed collection order across action-only turns and attaches fresh source snapshots", async () => {
  const h = setup();
  let ui = await h.ready();
  ui.send("Find coffee places");
  const first = "00000000-0000-4000-8000-000000000001",
    second = "00000000-0000-4000-8000-000000000002";
  const places = [
    { id: first, name: "Current approved first name", coordinate: [0.1, 0.2] },
    {
      id: second,
      name: "Current approved second name",
      coordinate: [0.3, 0.4],
    },
  ];
  h.turns[0].resolve(
    result("", {
      payloads: [
        {
          kind: "places",
          title: "Current",
          placeIds: [second, first],
          total: 2,
        },
      ],
      places,
      results: [
        {
          status: "ok",
          authority: "approved",
          sourceRecordIds: [first, "ITEM_ID", second],
        },
      ],
    }),
  );
  await flush();
  ui = h.render();
  const cards = ui.messages.find(
    (message) => message.payload.kind === "places",
  );
  assert.equal(cards.sourcePlaces[0].name, places[0].name);
  ui.send("Show the second one on map");
  assert.deepEqual(Array.from(h.turns[1].options.resolvedPlaceIds), [
    second,
    first,
  ]);
  h.turns[1].resolve(
    result("Focused", {
      places: [],
      results: [{ status: "ok", authority: "ui", sourceRecordIds: [first] }],
    }),
  );
  await flush();
  ui = h.render();
  ui.send("Save the second one");
  assert.deepEqual(Array.from(h.turns[2].options.resolvedPlaceIds), [
    second,
    first,
  ]);
  h.turns[2].resolve(result());
  await flush();
  h.hooks.dispose();
});

test("actual tool progress updates source-checking/composition status and stale progress cannot alter it", async () => {
  const h = setup();
  let ui = await h.ready();
  ui.send("Find coffee");
  h.turns[0].options.onTool("find_places", "running");
  ui = h.render();
  assert.match(ui.status, /Checking local sources/);
  h.turns[0].options.onTool("find_places", "complete");
  ui = h.render();
  assert.match(ui.status, /Composing verified results/);
  ui.cancel();
  const stopped = h.render().status;
  h.turns[0].options.onTool("find_places", "running");
  assert.equal(h.render().status, stopped);
  h.turns[0].resolve(result());
  await flush();
  h.hooks.dispose();
});


test('temporary preview can be dismissed and never enters later native conversation context',async()=>{
 const h=setup();let ui=await h.ready();ui.send('Preview a visit');
 h.turns[0].resolve(result('',{payloads:[{kind:'itinerary-preview',preview:{stops:[{placeId:'TEST',name:'PRIVATE_DRAFT_NAME',durationMinutes:25}],totalVisitMinutes:25}}]}));await flush();ui=h.render();
 assert.ok(ui.messages.some(m=>m.payload.kind==='itinerary-preview'));ui.send('Hello');
 assert.ok(!JSON.stringify(h.turns[1].options.recentMessages).includes('PRIVATE_DRAFT_NAME'));
 ui=h.render();ui.dismissItineraryPreview();ui=h.render();assert.equal(ui.messages.some(m=>m.payload.kind==='itinerary-preview'),false);assert.equal(h.counts.previewsCleared,1);
 h.turns[1].resolve(result('STALE'));await flush();assert.ok(!JSON.stringify(h.render().messages).includes('STALE'));assert.equal(h.counts.commits,0);h.hooks.dispose();
});

test('temporary preview order becomes the bounded live reference order and dismiss clears references',async()=>{
 const h=setup();let ui=await h.ready();ui.send('Preview a visit');
 const places=[{id:'FIRST',name:'First source',status:'approved'},{id:'SECOND',name:'Second source',status:'approved'}];
 h.turns[0].resolve(result('',{payloads:[{kind:'itinerary-preview',preview:{stops:[{placeId:'SECOND',name:'Second source',durationMinutes:15},{placeId:'FIRST',name:'First source',durationMinutes:20}],totalVisitMinutes:35}}],places}));
 await flush();ui=h.render();const card=ui.messages.find(m=>m.payload.kind==='itinerary-preview');assert.equal(card.sourcePlaces.length,2);
 ui.send('Show the second one on map');assert.deepEqual(Array.from(h.turns[1].options.resolvedPlaceIds),['SECOND','FIRST']);h.turns[1].resolve(result('Focused'));await flush();
 ui=h.render();ui.dismissItineraryPreview();ui=h.render();ui.send('Show the second one on map');assert.deepEqual(Array.from(h.turns[2].options.resolvedPlaceIds),[]);
 h.turns[2].resolve(result());await flush();h.hooks.dispose();
});
