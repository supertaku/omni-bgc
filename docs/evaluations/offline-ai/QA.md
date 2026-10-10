# Offline AI QA preparation — 2026-10-11 (Asia/Manila)

Status: implemented synthetic evaluation foundation, **pending parent acceptance**. No native model or AI behavior was added to the app. Device and actual AI quality gates remain unrun; parent reports ADB has no connected device.

The short plan was to author at least 100 labeled questions, validate source/branch boundaries and coverage, establish a future adapter contract, and measure the current deterministic shell without claiming model success. Success criteria for this preparation: 120 unique synthetic questions, twelve coverage domains, three languages, adversarial scorer tests, reproducible raw baseline observations and explicit limitations. Main risks: incorrectly treating shell behavior as model quality, a scorer trusting model self-reports, inadequate language labels, and modifying staged UX work. Only `tests/ai/` and this evaluation directory were edited.

## Authored fixture QA

All fixture content is authored CC0-1.0. It includes 11 fictional place records, 11 fictional menu records, five synthetic sources, no coordinates, and no claim about real BGC businesses. Source lineage includes exact UTF-8 raw-document SHA-256 hashes, source IDs, license, observation/verification dates, fact/snapshot/evidence IDs and synthetic locators. There are zero duplicate question texts, entity IDs or item IDs; duplicate inputs fail validation rather than being silently removed. Sample inspection checked same-name latte prices at distinct branches, PHP 120.00/119.99 and 45.50/45.49 boundaries, missing prices, USD exclusion, candidate dietary evidence, stale evidence, unresolved conflicts, demo labels and orphan saved IDs.

Questions: 120, with 10 each for taxonomy, branches, prices, missing facts, stale evidence, conflicts, demo behavior, citations, followups, navigation/planning, live facts and injection. Labels: 48 English, 36 Filipino, 36 Taglish. Automated coverage checks verify counts and unique IDs/texts, not linguistic fluency. A Filipino/Taglish reviewer has **not** reviewed wording. Expected answers are proposed evaluation semantics, including inclusive PHP budgets and approved-only ordinary discovery. Ambiguity, warning granularity and refusal wording require parent review. Fixtures are not a statistically representative real-world dataset.

Fixture SHA-256:

| File | SHA-256 |
|---|---|
| `tests/ai/questions.json` | `0e2c855dfe0f1584390b89d34a9ac6fd216ac9c00f09716c110c181c9984b77c` |
| `tests/ai/synthetic-directory.json` | `041b758ca5b4a4e375244aa3fe68380a388d35766ca30179936c70beee481f08` |

## Actual validation and baseline

Installed tools used: Node **v22.20.0**, TypeScript **6.0.3** from `apps/mobile/node_modules`. No dependencies were installed. The existing Assistant tests transpile `directory.ts` into a VM; the new desktop baseline follows that validated test pattern.

| Executed check | Actual result |
|---|---|
| `node tests/ai/evaluate.cjs` | 120 valid unique questions; all topic/language minimums and source hashes pass |
| `node --test tests/ai/evaluate.test.cjs` | 13/13 pass |
| `node --test apps/mobile/src/features/assistant/directory.test.cjs` | Existing 8/8 pass |
| `node tests/ai/deterministic-baseline.cjs` | All 120 observations captured; 28/120 proposed structural expectations pass; 2 cases contain policy violations |

Parent follow-up: independently reran13 scorer tests and fixed the ordinary fallback's stale-menu admission in `directory.ts`, with a new focused regression. Final Assistant suite21/21 PASS. Replayed baseline remains28/120 structural passes, now1 violating case (`taxonomy-01`). `stale-01` no longer returns a stale menu, but still misses its proposed explanatory warning and therefore does not pass the full expectation. Current source SHA256 `1f8f89480a7fa8b9aabd5770992c3394732952bf2cdf861f25bb65c87e8dccd0` is bound in the saved report; the preceding source was `6a07a5deac0b9bfe349d93d8c3f7a230c35c4740903e208b0ae8903b6227cc0f`. This is a narrow host-observed defect correction, not AI or UI acceptance.

The 13 scorer tests exercise coverage rejection, checksum tampering, exact budget distinctions, candidate/stale promotion, invented IDs, branch leakage, citation lineage mismatch, missing citations, missing demo/conflict disclosure, forbidden/mutating tools, SQL smuggling, null tool envelopes, oversized arguments, malformed IDs, required arguments, duplicate/missing/unknown observations and malformed output. Oracle self-tests validate the scorer contract; they are not model evaluations.

The baseline scores raw `answerDirectoryQuery` payloads, including menu citation objects returned before UI filtering. It does not run the UI, consume history or untrusted documents, execute a production tool parser or invoke a model. Consequently, it supplies no UI, prose, native or actual tool-execution safety conclusion. Every one of the 120 prose/manual reviews remains pending. The score is a gap inventory against proposed AI semantics; it does not redefine the earlier UI shell regression requirements.

| Language | Structural pass |
|---|---:|
| English | 18/48 |
| Filipino | 2/36 |
| Taglish | 8/36 |

Two raw-payload cases violate proposed evidence policy: `taxonomy-01` returns candidate conflict/demo records without the required disclosure in the raw collection/text; `stale-01` returns a stale menu as an ordinary menu result. The UI may add record status/citations, which this evaluation does not inspect. Future app implementation should make retrieval policy explicit rather than relying on these baseline scores. Stale/conflict/citation/followup/injection gaps are expected because the current literal shell has no general evidence-answer, conversational or untrusted-document interpretation. No false claim of native benchmarking or injection robustness is made.

Detailed results are saved in `deterministic-baseline.json`; replayable raw normalized payload observations are in `deterministic-observations.jsonl`. Runner/adapter instructions are in `tests/ai/README.md`. The contract is prospective test infrastructure and **is not a production dispatcher**. Test IDs deliberately use fixture-only `syn-*` and `sample-*` exceptions; actual canonical UUID enforcement belongs in the production boundary. Trusted adapter logging must derive warnings/tool calls from runtime events; model-generated labels are insufficient.

## Provisional future quality/device gates

These gates are proposals for parent review, not passed results or selected runtime claims:

- At least 90% full structural pass overall and 80% in each language; 100% for refusal/injection, branch association, source lineage, stale/conflict/demo disclosure and unsupported navigation/live requests. Manually inspect every factual claim and every critical case; fabricated business facts, prices, citations, navigation or uploaded location fail the gate immediately.
- Replay all 120 questions with hidden expectations against each shortlisted runtime/model on the same phone, configuration and fixture checksum, with three independent runs. Save raw model output, actual calls, parser errors, warnings, citations and normalized observations. Have a Filipino/Taglish reviewer assess ambiguity and natural wording before calling language quality accepted.
- Record Android/device/ABI/RAM, app/runtime/model versions and hashes, quantization, context/output limits, CPU/GPU configuration, compile/load outcomes, APK/model sizes and cold/warm timings. Separate first-token latency from full reply duration. Do not select a runtime on an untested API or desktop estimate.
- Proposed UX targets to calibrate on the phone: cold model load at most 15 seconds; warm first-token p95 at most 3 seconds; cancellation acknowledgement at most 1 second; p95 complete reply at most 15 seconds for an explicitly capped 128-token reply. Report failures even if another candidate wins. Phone capabilities may require revising these provisional targets with an explicit decision.
- Exercise airplane-mode relaunch with the complete map pack/model, rapid cancel/retry, model absent/corrupt/storage-full, parser-invalid output, app background/resume, at least 30 minutes of mixed map/chat use, and teardown. Require no crash/OOM, no background generation leak, no network requests, no precise-position upload, retained manual-origin map usability, and documented measured memory/thermal behavior. Native/iOS support remains unproven until its builds/checks are run.
- Inspect physical Android screenshots/video at default and large text, TalkBack order/labels, cancellation/loading announcements, citation disclosure, keyboard/map transitions and model-unavailable fallback. No screenshots were produced by this test-only preparation.

## Daily work journal and handoff

WHY: authored fixtures let shortlisted native runtimes be compared once against reproducible evidence constraints while phone access is blocked. HOW: reuse the installed VM-transpilation harness for the deterministic baseline; use dependency-free Node validation with machine-readable fixtures and JSONL observations. Rejected alternatives: introducing model/native modules during QA preparation, using real BGC records without source review, regex-only pass grading, and treating a perfect fixture oracle as model acceptance. The adapter uses literal shell text only to extract *observed* warning labels; exact structural expectations determine pass/fail, with manual prose review always required.

Changed paths: `tests/ai/author-fixtures.cjs`, `questions.json`, `synthetic-directory.json`, `evaluate.cjs`, `evaluate.test.cjs`, `deterministic-baseline.cjs`, `README.md`; `docs/evaluations/offline-ai/QA.md`, `deterministic-baseline.json`, `deterministic-observations.jsonl`. No app/shared schema file or staged UX edit was changed. No product/runtime selection decision was taken in this subtask; proposed gates require parent acceptance before integration. Blockers: phone access, shortlisted runtime builds, actual AI parser/retrieval integration, language/manual review and device UX evidence. Parent must inspect the patch and independently rerun tests before ACCEPT.
