// Synthetic contract inputs for deterministic tests; never imported by the app.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadTs } = require("../../../../../tests/helpers/load-ts.cjs");
const { answerDirectoryQuery } = loadTs(
  "apps/mobile/src/features/assistant/directory.ts",
  {
    "../explore/demoDirectory": {
      isDemoPlace: (place) =>
        String(typeof place === "string" ? place : place.id).startsWith(
          "sample-",
        ),
    },
  },
);
const citation = {
  sourceId: "TEST ONLY",
  label: "Synthetic test evidence",
  license: "TEST ONLY",
  observedAt: "2026-10-10",
  verifiedAt: null,
  status: "approved",
};
const place = (id, name, category, overrides = {}) => ({
  id,
  name,
  category,
  coordinate: null,
  building: "Test Building",
  aliases: [],
  entrances: [],
  citations: [citation],
  status: "approved",
  menus: [],
  ...overrides,
});
const item = (id, amount, overrides = {}) => ({
  id,
  name: "Test pasta",
  priceValue: { currency: "PHP", amount },
  citation,
  priceCitation: citation,
  ...overrides,
});
const saved = {
  placeIds: ["coffee", "removed"],
  itinerary: [],
  startTime: null,
};
const places = [
  place("coffee", "Test Café", "cafe"),
  place("food", "Test Kitchen", "restaurant", {
    menus: [
      item("cheap", "0.30"),
      item("expensive", "0.31"),
      item("unknown", "0.10", { priceCitation: undefined }),
      item("foreign", "0.01", {
        priceValue: { currency: "USD", amount: "0.01" },
      }),
      item("candidate", "0.01", {
        citation: { ...citation, status: "candidate" },
      }),
    ],
  }),
];
const payload = (query, kind) =>
  answerDirectoryQuery(query, places, saved).find(
    (result) => result.kind === kind,
  );

test("cuisine queries match only literal source tags or names, without guessing", () => {
  const records = [
    place("tagged", "Test Kitchen", "Food", { cuisines: ["italian"] }),
    place("unknown", "Test Bistro", "Food"),
  ];
  const result = answerDirectoryQuery(
    "Find Italian restaurants",
    records,
    saved,
  ).find((p) => p.kind === "places");
  assert.deepEqual(Array.from(result.placeIds), ["tagged"]);
});

test("category and alias search preserve canonical IDs and record classification", () => {
  assert.equal(payload("Find coffee", "places").placeIds[0], "coffee");
  assert.equal(payload("Find restaurants", "places").placeIds[0], "food");
  assert.equal(
    answerDirectoryQuery(
      "TEST CAFE",
      [place("alias", "Other Name", "office", { aliases: ["Test Cafe"] })],
      saved,
    ).find((p) => p.kind === "places").placeIds[0],
    "alias",
  );
  assert.equal(places[0].status, "approved");
});
test("budget includes only supported same-currency prices and exact decimal boundary", () => {
  const result = payload("Menu under ₱0.31", "menus");
  assert.equal(result.total, 1);
  assert.equal(result.items[0].item.id, "cheap");
  assert.equal(payload("Menu under PHP 0.30", "menus"), undefined);
  assert.equal(payload("Menu between PHP 0.30 and PHP 0.30", "menus").total, 1);
});
test("dietary labels cannot match an unsupported tag", () => {
  const p = place("food", "Test Kitchen", "restaurant", {
    menus: [item("tag", "10", { tags: ["vegetarian"] })],
  });
  assert.equal(
    answerDirectoryQuery("Vegetarian dishes", [p], saved).some(
      (p) => p.kind === "menus",
    ),
    false,
  );
  p.menus[0].tagCitation = citation;
  assert.equal(
    answerDirectoryQuery("Vegetarian dishes", [p], saved).find(
      (p) => p.kind === "menus",
    ).items.length,
    1,
  );
});
test("directions always defer with exact wording and no origin, route or place handoff", () => {
  for (const query of [
    "Directions to Test Kitchen",
    "How to get there",
    "Walking to Test Café",
    "How do I get to Test Kitchen",
    "Navigate to unknown",
    "Directions to my saved places",
    "Walking directions for my itinerary",
    "Find a walking route under PHP 30",
    "How to reach Test Kitchen",
  ]) {
    const result = answerDirectoryQuery(query, places, saved);
    assert.equal(result.length, 1, query);
    assert.equal(result[0].kind, "text", query);
    assert.equal(
      result[0].text,
      "Walking directions are not available in this version.",
      query,
    );
  }
});
test("removed saved feature never reads retained state and itinerary preview needs local AI", () => {
  const original = JSON.stringify(saved);
  const blocked = new Proxy(saved, {
    get() {
      throw Error("Saved state must not be read");
    },
  });
  for (const query of [
    "My saved places",
    "Save this place",
    "Show favorites",
    "Save this itinerary",
  ]) {
    const result = answerDirectoryQuery(query, places, blocked);
    assert.equal(result[0].kind, "text");
    assert.match(result[0].text, /not|aren.t available/);
  }
  for (const query of ["Show my itinerary", "Create a trip", "Plan my visit"]) {
    const result = answerDirectoryQuery(query, places, blocked);
    assert.equal(result.length, 1);
    assert.match(result[0].text, /Set up a model in Models/);
  }
  assert.equal(JSON.stringify(saved), original);
});

test("absent records and live facts produce explicit unavailable states", () => {
  assert.equal(
    answerDirectoryQuery("Find coffee", [], saved).some(
      (p) => p.kind === "places",
    ),
    false,
  );
  assert.equal(
    payload("Which restaurants are open now", "capability").state,
    "unsupported-query",
  );
});

test("a stale item cannot become an ordinary menu result through an approved branch", () => {
  const approved = place("stale-item", "Test Old Kitchen", "restaurant", {
    status: "approved",
    menus: [item("old", "100", { citation: { ...citation, status: "stale" } })],
  });
  for (const query of [
    "Show menu for Test Old Kitchen",
    "Menu under PHP 200",
  ]) {
    const result = answerDirectoryQuery(query, [approved], saved);
    assert.equal(
      result.some((payload) => payload.kind === "menus"),
      false,
    );
    assert.match(result[0].text, /find a recorded menu item that matches/);
  }
  assert.equal(approved.menus[0].citation.status, "stale");
});

test("sample menus stay candidate, disclose fiction and cannot create geographic routes", () => {
  const sampleCitation = {
    ...citation,
    status: "candidate",
    sourceId: "OMNI-UX-V2-FICTIONAL-PREVIEW",
    verificationMethod: "synthetic-preview",
  };
  const sample = place("sample-coffee", "Test sample coffee", "Coffee", {
    menus: [
      {
        ...item("sample-dish", "125"),
        citation: sampleCitation,
        priceCitation: sampleCitation,
        tagCitation: sampleCitation,
        tags: ["vegetarian recipe"],
      },
    ],
  });
  const result = answerDirectoryQuery("Menu under PHP 150", [sample], saved);
  assert.equal(result.find((p) => p.kind === "menus").items.length, 1);
  assert.match(result.find((p) => p.kind === "text").text, /fictional/);
  assert.equal(sample.menus[0].citation.status, "candidate");
  const route = answerDirectoryQuery(
    "Directions to Test sample coffee",
    [sample],
    saved,
  );
  assert.equal(route.length, 1);
  assert.equal(route[0].kind, "text");
  assert.equal(
    route[0].text,
    "Walking directions are not available in this version.",
  );
  // Merely assigning a sample ID must not permit unrelated candidate evidence.
  sample.menus[0].priceCitation = { ...citation, status: "candidate" };
  assert.equal(
    answerDirectoryQuery("Menu under PHP 150", [sample], saved).some(
      (p) => p.kind === "menus",
    ),
    false,
  );
});

test("candidate and stale branches never become canonical collections or menus through approved item evidence", () => {
  for (const status of ["candidate", "stale"]) {
    const branch = place("unapproved", "Test Hidden Kitchen", "restaurant", {
      status,
      menus: [item("approved-dish", "100")],
    });
    for (const query of [
      "Test Hidden Kitchen",
      "Find restaurants",
      "Menu underPHP200",
    ]) {
      const result = answerDirectoryQuery(query, [branch], saved);
      assert.equal(
        result.some(
          (payload) => payload.kind === "places" || payload.kind === "menus",
        ),
        false,
        query + status,
      );
    }
    let seen;
    answerDirectoryQuery(
      "Menu underPHP200",
      [branch],
      saved,
      (query, records) => {
        seen = records;
        return null;
      },
    );
    assert.equal(
      seen[0],
      branch,
      "research adapter retains original qualified input",
    );
    assert.equal(branch.status, status);
  }
});
