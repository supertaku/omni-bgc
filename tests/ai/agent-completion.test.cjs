const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("../helpers/load-ts.cjs");
const { safeGeneralText } = loadTs("apps/mobile/src/ai/answerComposer.ts");
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
  assert.equal(
    safeGeneralText("Persistent changes require your confirmation."),
    true,
  );
});
