# Private minimal chat candidate — 2026-10-18

Parent review is required before integration. Candidate base: `39478430bce57324a631a0402fc760bb1980fec6`. This agent made no root source, Git index, device or dataset changes; parent-owned independent merges may coexist.

The mirrored candidate removes visible chat header words, keeping an accessible Back arrow and Models gear with 48 dp targets. The Models page keeps its title, with only an arrow for Back. Normal Import remains absent. Chat results are simple numbered place/dish names; only the name is linked to the existing guarded `onOpenPlace` path. No result cards, new modal, source disclosure, candidate badge or verification metadata is rendered. Unknown IDs have no link. Price evidence gates remain; estimates, starting prices, availability caveats, stale notes and fictional-example notes preserve their meaning. The existing user bubble width/padding is unchanged.

`SourceDisclosure` is removed from the assistant barrel export because its renderer no longer exists. Underlying evidence payloads and citations are retained without rendering their disclosure UI. No approval status, conversation persistence rule, tool contract or native inference behavior changes.

Friendly source-checking progress appears only while the actual hook reports a source read: “Looking through the menus…” for menu queries and “Looking for a few matches…” otherwise. Other work uses “One moment…”, with no internal tool or CPU text.

## Merge instructions

1. Verify every current root file matches `base_sha256` in `base-receipts.json`; a null base means a new file and must still be absent. Exact candidate hashes and sizes are in `handoff.json`.
2. After U3n build/artifact acceptance, copy the five mirrored production files plus updated `ui-v2.test.cjs` and new `tests/ai/minimal-chat.test.cjs`. Do not copy private validation scripts, this README, or private receipts into production source.
3. Merge QA separately. In `AssistantScreen.tsx`, add only QA hook destructuring and ModelScreen callback props. In `ModelScreen.tsx`, add only compile/package-gated hidden QA state, heading gesture, explicit QA consent and EvaluationScreen branch; preserve the current icon-only Back and removed normal Import. Preserve muted disabled-Remove polish if provided by the QA candidate. Do not overwrite either screen wholesale with the older QA mirror.
4. Merge the independent Details candidate and price-range changes separately; these paths do not overlap this candidate. Fresh source and approval guards remain parent responsibilities.
5. Run merged host checks, inspect the exact diff, then build and review a fresh APK before physical tests. This private candidate has no Android layout or model-quality acceptance.

## Verification

- 6 new behavior tests pass: exact ID handoff, missing-ID denial, price qualifiers, hidden evidence without data mutation, temporary itinerary semantics and icon-only accessible headers/progress.
- 13 updated UI interaction tests pass, preserving cancellation, draft, map controls, sheet sizing and legacy route suppression.
- Full project TypeScript passes with an in-memory source overlay (`node .g/ai-m10/minimal-chat-candidate/validate.cjs`).
- Focused ESLint passes using real root file identities (`node .g/ai-m10/minimal-chat-candidate/lint.cjs`). Direct linting of `.g` files is ignored by project configuration and is not claimed as validation.
- Five candidate source files pass Prettier with the mobile config and an explicit empty private ignore file.

To rerun candidate tests from repository root, set `OMNI_UI_CANDIDATE=.g/ai-m10/minimal-chat-candidate` and execute both mirrored test files with `node --test`. After integration, omit that variable so the new tests read root source.

The React best-practices skill review found no new effects or resource ownership, state mutation, dependency, or component-remount issue. The new name component is hoisted; render paths are bounded by existing payload limits. Physical long-name wrapping, landscape/font scale, link target readability, real search progress timing and native response quality remain to be tested on the next APK.
