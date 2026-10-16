# Independent M6 / M8 review — 2026-10-16

Reviewer: retrieval/orchestration owner, independent of the parent-authored persistence, mutation and Assistant UI implementation. Parent retains milestone acceptance authority.

Inspected `src/data/savedPatch.ts`, `src/data/store.ts` atomic patch path, `src/ai/{mutationCoordinator,conversationStore,assistantRuntime}.ts`, Assistant hook, confirmation/model/history controls, and the canonical snapshot display contract.

## Findings and repairs verified

1. In-flight preview could finish after cancellation and reinstall pending state. Parent added cancellation epochs to preview preparation and confirmation source revalidation. Independent `mutation-race.test.cjs` proves late preview/canceled source revalidation dispatch no writes.
2. Confirmation initially checked source status without complete lineage, and source validity could change while waiting for local DB ownership. Parent added full approved-evidence fingerprints, checks both preview and confirm, and rechecks current canonical SQL inside the serialized DB mutation transaction before writes. Source receipt change requires a new preview. Existing local favorites/settings/visit state is checked by CAS and unrelated state is preserved.
3. Stale completed and rejected model turns could overwrite canonical reference IDs or disable the current native-ready conversation. Parent added immediate live/epoch/abort fences before updating state/ref ownership. Reviewer reproduced the rejected-turn failure (8 hook tests passed, one failed), then verified the repair (all hook tests pass).
4. Clear before runtime creation could restore old history afterward. Parent added deferred clear plus initialization-epoch fencing. Independent hook regression verifies old history is cleared before loading.
5. Text-only history discarded factual result cards completely, leaving user questions without assistant answers. Parent now projects bounded explicitly historical summaries for structured cards/evidence and stores bounded canonical references in a separate relational table. Source snapshots/proposals/confirmation tokens remain nonpersistent. Earlier answers are explicitly historical and require a new current-source query.
6. Startup place arrays could render stale names/coordinates despite current retrieval. Parent now attaches nonpersistent current canonical snapshots to messages; retrieval owner supplies final current display records and citation lineage. Actual displayed card order, rather than mixed tool/source/item IDs, supplies next-turn reference order. Independent hook/orchestrator regressions verify current snapshot fields and ordinal continuity across action-only turns.

## Independent commands and exact results

`node --test tests/ai/agent-security.test.cjs tests/ai/agent-research.test.cjs tests/ai/assistant-ui.test.cjs tests/ai/mutation-race.test.cjs tests/ai/mutation.test.cjs tests/ai/persistence.test.cjs apps/mobile/src/features/assistant/ui-v2.test.cjs`

Exit 0: **54 passed, 0 failed, 0 skipped**. Of these, M6/M8-focused coverage includes 12 accepted legacy screen/layout contracts, 10 actual asynchronous Assistant-hook contracts, 4 mutation contracts, 3 independent cancellation/source-change races and 3 real host SQLite persistence scenarios. The remaining 22 exercise integrated retrieval/tool/grounding contracts.

`apps/mobile/node_modules/.bin/tsc.cmd --noEmit -p apps/mobile/tsconfig.json` — exit 0 after current integration.

The legacy screen harness now explicitly mocks the new hook through the old deterministic hook for layout/interaction assertions; it does not masquerade as native/provider execution. Separate `assistant-ui.test.cjs` executes the real new hook with controlled runtime dependencies and tests partial/final persistence, Stop, background, Clear, late startup/unmount, stale success/failure, same-tick double confirmation, current source snapshots and rendered-reference order.

## Final itinerary and progress review addendum

Reviewed the final root operation-aware patch/coordinator/store code: append preserves the full prior prefix, reorder preserves the exact ID/duration multiset, and remove creates an ordered subsequence by removing only requested exact tuple occurrences. New-source guards apply to appended/replacement stops; retained unavailable local tuples remain user-owned and explicitly labeled. Complete before/after preview and saved-state CAS still gate the actual write. The 20-stop existing-list action limit rejects preview explicitly; larger lists remain fully readable and unchanged. Tool-running/composition UI progress contains no raw source content and cannot override epoch ownership.

Reran the command above with `tests/ai/itinerary-tools.test.cjs`, `tests/ai/entrance-tools.test.cjs` and `tests/ai/agent-completion.test.cjs` added: exit 0, **69 passed, 0 failed, 0 skipped**. This includes nine new real executor → coordinator → patch itinerary tests (controlled persistence adapter), two bounded entrance/source tests, the general false-completion gate, and the real SQLite coverage from the parent suite. Full TypeScript check and focused authored AI ESLint also passed before the final evidence-only update. The operation-aware host tests do not establish real model interpretation or Android persistence success.

## Disposition and limits

No remaining blocking issue was identified in the reviewed M6/M8 host contracts after these repairs. Recommend parent acceptance of these focused host contracts, subject to its full integration/native-build/UI evidence gates. This is **not ACCEPT_DEVICE**. Real SQLite here is the host adapter, not Android expo-sqlite runtime proof. Element/hook tests do not demonstrate physical layout, TalkBack, device lifecycle, real model proposals or POCO map gestures. M10 must validate persistent mutations across force-stop/restart, current-source map handoff, streaming/Stop/background behavior and memory/thermal coexistence. Confirmation receipts are bounded live-session receipts; retry-after-crash is deliberately unsupported and confirmation tokens do not survive restart.
