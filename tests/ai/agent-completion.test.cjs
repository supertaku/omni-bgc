const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("../helpers/load-ts.cjs");
const { safeGeneralText } = loadTs("apps/mobile/src/ai/answerComposer.ts");
const { composeGroundedAnswer } = loadTs(
  "apps/mobile/src/ai/answerComposer.ts",
);
test("general model prose cannot claim any user transaction completed, regardless of pronoun", () => {
  for (const text of [
    "Saved your favorite.",
    "Removed the stop.",
    "Deleted it.",
    "Booked your table.",
    "Reserved a seat.",
    "Scheduled your visit.",
    "Purchased the item.",
    "Paid the bill.",
    "Confirmed your change.",
    "Added the place.",
    "Updated your list.",
    "Done!",
    "Completed.",
  ])
    assert.equal(safeGeneralText(text), false, text);
  for (const text of [
    "Persistent changes require your confirmation.",
    "You can save places after confirmation.",
    "Favorites are available.",
    "I can give route directions.",
  ])
    assert.equal(safeGeneralText(text), false, text);
  assert.equal(
    safeGeneralText("I can show temporary visit-list previews."),
    true,
  );
});

test("friendly empty replies preserve approved-office and research boundaries without model facts", () => {
  const result = (name, authority) => ({
    name,
    callId: "HOST",
    status: "empty",
    authority,
    sourceRecordIds: [],
    citations: [],
    appliedFilters: {},
    warnings: [],
    sourceFingerprint: "",
    data: [],
  });
  const office = JSON.stringify(
    composeGroundedAnswer(
      [result("find_approved_offices", "approved")],
      "FAKE OFFICE OPEN NOW",
      "Find offices",
    ),
  );
  assert.match(office, /couldn’t find an office match/i);
  assert.ok(!office.includes("FAKE OFFICE"));
  const research = JSON.stringify(
    composeGroundedAnswer(
      [result("search_food_research", "research")],
      "FAKE VERIFIED PRICE",
      "Show research",
    ),
  );
  assert.match(research, /couldn’t find a menu match/i);
  assert.ok(!research.includes("FAKE VERIFIED"));
});
