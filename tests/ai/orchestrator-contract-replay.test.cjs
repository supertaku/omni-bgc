const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runContractReplay } = require("./orchestrator-contract-replay.cjs");
test("all 120 historic multilingual question INPUTS exercise actual bounded host orchestration with controlled proposals", async () => {
  const report = await runContractReplay();
  assert.equal(report.questionCount, 120);
  assert.equal(report.turnCount, 240);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(report.byLanguage).map(([key, value]) => [
        key,
        value.inputCount,
      ]),
    ),
    { en: 48, fil: 36, taglish: 36 },
  );
  assert.equal(report.semanticAccuracy, null);
  assert.equal(report.modelQualityGate, "NOT_EVALUATED");
  assert.equal(report.inference, "NOT_RUN");
  assert.equal(report.networkCalls, 0);
  assert.equal(report.rows.filter((row) => row.scopeExcluded).length, 10);
  assert.ok(
    report.rows.every((row) =>
      row.scopeExcluded
        ? row.controlledRead === "unavailable" &&
          row.prohibitedProposal === "unavailable"
        : row.controlledRead === "completed" &&
          row.prohibitedProposal === "denied",
    ),
  );
  assert.ok(
    report.rows.some(
      (row) => !row.scopeExcluded && row.prohibitedName === "get_saved_places",
    ),
  );
  assert.ok(
    report.rows.some(
      (row) =>
        !row.scopeExcluded && row.prohibitedName === "preview_saved_change",
    ),
  );
});
