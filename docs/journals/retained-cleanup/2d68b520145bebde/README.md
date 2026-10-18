# Synthetic offline Assistant evaluation contract

These authored CC0 fixtures test engineering behavior. Every name, price, source and relationship is synthetic; there are no coordinates or real BGC accuracy claims. App code never imports this directory. `author-fixtures.cjs` reproducibly writes the two JSON fixtures; source hashes cover the UTF-8 strings in `synthetic-directory.json.rawDocuments`. Conflict is fixture metadata on a **candidate** record, preserving installed `Place`/`Citation` status enums.

Run with the installed Node executable, without installing packages:

```powershell
node tests/ai/evaluate.cjs
node --test tests/ai/evaluate.test.cjs
node tests/ai/deterministic-baseline.cjs
node tests/ai/evaluate.cjs docs/evaluations/offline-ai/deterministic-observations.jsonl
```

The suite contains 120 questions: 10 per topic, with 48 English, 36 Filipino and 36 Taglish labels. Default discovery is approved-only. An explicit request for a demo can return fictional records with disclosure. Stale/conflicting records can be returned only for evidence inspection, with a visible warning; never as current recommendations/prices. A request with several plausible branches or no referent requires clarification. For budget fixtures, `under` means **at or below** the stated PHP amount, matching the existing shell's inclusive behavior; prices remain exact decimal strings.

The future adapter receives a question, its `history`, `untrustedContext`, and the synthetic directory. It must execute the real parser/retrieval boundary and record actual calls/results, without access to `expected`. Store one JSON object per line for every question; duplicate, unknown, absent or malformed observations fail evaluation. Keep a separate raw transcript/tool trace for reviewer audit.

Each observation uses schema v1:

```json
{"schemaVersion":1,"questionId":"branches-01","action":"find_places","entityIds":["syn-blue"],"itemRefs":[],"citations":[],"warnings":[],"toolCalls":[{"name":"search_places","effect":"read_only","arguments":{"query":"Synthetic Café Blue","branchId":"syn-blue"}}],"text":"Synthetic test result"}
```

Actions: `find_places`, `find_menu`, `answer_evidence`, `clarify`, `unavailable`, `list_saved`. Item references contain `entityId` and `itemId`. Citation objects must include the fixture's `sourceId`, `factId`, `snapshotId`, `evidenceId`, `rawSha256`, `locator`, `status`, and associated `entityId` plus `itemId` when applicable. The scorer checks all citation associations, exact ID sets, required source IDs and warning labels. Warning labels are expected in `questions.json`; the adapter derives them from the actual structured warning state, not from the expected answer.

Allowed tool envelopes are read-only: `search_places` arguments `query` (required), `category`, `branchId`; `search_menu` arguments `query`, `placeId`, `budgetPHP` (query or placeId required); `get_evidence` arguments `entityId` (required), `itemId`; and `list_saved` with empty arguments. All supplied values are nonempty strings, limited to 512 query characters, 64 category characters and 128 other characters. `budgetPHP` is a nonnegative decimal with at most two places. IDs must exactly match the fixture dictionary, and item IDs must belong to the given entity. Synthetic `syn-*` and `sample-*` IDs are explicit **test-only** exceptions; a production parser must enforce the canonical UUID ID contract and explicit demo exceptions. Unknown argument keys, null envelopes, write effects, unsupported tools, fabricated citations and cross-branch items fail. These names define an evaluation adapter contract, not an installed app API, production dispatcher or proof of a production parser's security.

`qualityGate` always remains `NOT_EVALUATED`: structural scoring cannot establish prose truth, correct actual tool execution, native latency, or UI quality. Self-reported warnings/calls can be fabricated by a model; a trusted adapter must derive them from runtime events. Every question includes a manual rubric; human review must inspect prose, original trace, citation rendering and language fluency. Do not infer safety from a zero structural-violation count or from an oracle self-test.

The desktop baseline adapts the **existing literal `answerDirectoryQuery`** using installed TypeScript; it does not consume history/untrusted documents or invoke a model. It reads warning labels only from actual shell text, and attaches only menu citations actually present in shell payloads. It intentionally does not invent missing warnings, evidence answers or citations to improve scores. Place-card citation rendering is outside this baseline. The comparison is a gap inventory against proposed semantics; it is not a regression gate for the earlier UI shell.
