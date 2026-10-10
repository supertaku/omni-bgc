# UX V2.1 Assistant handoff — 2026-10-10, Asia/Manila

Status: implemented and host-tested; awaiting independent parent ACCEPT and native visual/accessibility evidence.

## Assignment and task plan

Own the Assistant H/I/D lane. Success means a compact directory conversation, direct truthful place handoffs, exact walking-direction deferral, no itinerary or navigation action, retained typed references/citations and synthetic isolation, stable conversation and unsent composer. Steps: inspect the existing contracts; defer excluded query/render paths; compact the header/results/messages; strengthen event and data-safety regression coverage; hand off actual evidence. Risks: element stubs cannot prove native geometry, TalkBack order, keyboard behavior or scroll position across an animated screen change.

## Changed paths and resulting behavior

- `apps/mobile/src/features/assistant/AssistantScreen.tsx`: visible Back to Map, Assistant title, short local/AI status; redundant branding/settings removed. Welcome appears only before conversation. Suggestions contain discovery and saved-place reads, collapse automatically on send and reopen explicitly. Menu suggestion requires an actual menu. Suggestion searches retain an unrelated unsent composer draft. Timer cleanup, cancel control, existing mounted state, ScrollView and source-backed directory execution remain.
- `apps/mobile/src/features/assistant/cards.tsx`: 30dp category artwork and wrapping name/category/building/floor; direct View on Map for located records, View details for unlocated records, explicit View sample and fictional/no-location label for samples. No duplicate result-chevron action or repeated message avatar. Disclosure retains record classification, license, observed/verified dates, locator and source identity. Source count counts unique source IDs while all fact citations remain available. Menu handoffs use compact labels. Legacy typed route/itinerary payloads render deferral text without instructions or actions.
- `apps/mobile/src/features/assistant/styles.ts`: reduced timeline/message spacing and compact result/header styling. Touch controls retain 48dp minimum targets; text is allowed to wrap and scale.
- `apps/mobile/src/features/assistant/directory.ts`: direction intent is handled before any destination, saved or menu lookup and returns exactly `Walking directions are not available in this version.` as a single text payload. Visit planning/itinerary queries return a deferral without opening stored planning UI. Saved-place read access remains; empty state no longer instructs users to tap an excluded Save button. Existing category/dish/branch search, exact decimal budgets and evidence gates remain intact.
- `apps/mobile/src/features/assistant/contracts.ts`: typed route/itinerary/source/place payloads retained; legacy settings/itinerary callbacks optional and unused by this UI. Existing App callers remain compatible.
- `apps/mobile/src/features/assistant/directory.test.cjs`, `ui-v2.test.cjs`: replacement coverage for the approved navigation deferral plus new safety/state tests. Per mobile owner's coordination request, the shared MapChrome test now checks the separately rendered `FloatingChatButton`, verifies a single Chat control, preserves category/selection/no-tab/touch-area coverage, and asserts no redundant Chat in MapChrome. Sheet/RouteWorkflowPreview tests remain intact.

No directory records, fixture facts, canonical IDs, SQLite data, routing modules, schema, permissions, dependencies or app entry point were changed by this lane.

## Host validation

Tool versions: Node v22.20.0, TypeScript 6.0.3; existing Expo 57.0.27 / React Native 0.86.3. Applied the `vercel:react-best-practices` TSX checklist: hooks at component scope, functional state updates, timer cleanup, no new event subscription, wrapping/scaling accessible text, named button controls with expanded/disabled state, no new runtime/data fetch.

PASS — 8 Assistant component-event tests:

`node --test --test-name-pattern='^(compact Assistant|Assistant results|Assistant message|unlocated|legacy route|compact source|fictional result|suggestion searches)' apps/mobile/src/features/assistant/ui-v2.test.cjs`

Covers Back callback and unsent draft; automatic suggestion collapse; retained conversation after Back; canonical Map handoff; absence of invented negative distance; truthful unlocated/sample handoff; blocked legacy payload actions; complete compact source disclosure; unique source count with repeated fact citations; suggestion-draft retention; cancellation; no repeated avatar.

PASS — 12 directory and fixture governance tests:

`node --test apps/mobile/src/features/assistant/directory.test.cjs tests/data-quality/mobile/demo-directory.test.cjs`

Covers category/alias/cuisine literal matching, supported same-currency exact budget bounds, rejection of unsupported dietary labels, nine direction request variants with exact response and no handoff, no saved-state mutation, itinerary deferral, missing/live facts, synthetic evidence boundaries, no synthetic geography/entrances/ratings/allergens/approved facts, stable fixture UUIDs, branch search and the preview source-byte/count manifest.

PASS — `git diff --check` at the last lane check.

PASS — final consolidated lane check, 24/24 tests:

`node --test apps/mobile/src/features/assistant/ui-v2.test.cjs apps/mobile/src/features/assistant/directory.test.cjs tests/data-quality/mobile/demo-directory.test.cjs`

At the initial lane check, whole-app `npm run typecheck` reported two parent-integration errors outside Assistant: App passed removed `ExplorerPager.handleVisible` and `MapChrome.onAssistant` props. Parent was informed; no Assistant TypeScript error was reported. Subsequent parent integration supersedes those initial errors; consolidated TypeScript/native evidence is parent-owned.

## App integration portability follow-up

The initial App regression harness incorrectly required ignored `assets/generated/directory/places.json`; it passed in the development workspace but failed isolated CI. Corrected only `tests/ui/app-refinement.test.cjs`: two project-authored, explicitly TEST ONLY contract fixtures replace that dataset import. The coordinate sentinel tests callback identity; it is not a real BGC location, entrance or routing record. No candidate record, menu, source observation or geographic dataset was copied/published. The actual `features/explore/directory.ts` search/category/browsing implementation and original synthetic-preview module still execute in the harness, as do App's actual callbacks.

PASS — `node --test tests/ui/app-refinement.test.cjs`: 4/4 in the workspace, 4/4 in `.g/ux-v2.1-clean` after copying only the corrected test. The clean snapshot's generated candidate-directory JSON is absent (`Test-Path` returned False), so this pass no longer depends on ignored assets.

Current assertions reflect the latest user steering: Settings/Transit/Shake controls absent, always-on shake, no transit/route injection from App, attribution/data access retained, pack checking temporarily blocks shake, canonical-style contract/sample handoffs reveal direct compact details, screen/keyboard callbacks retain selection/filter/camera, graph startup and saved reads remain, retained itinerary stays read-only. The actual reviewed download catalog is empty: the test neither fabricates a download choice nor claims a confirmation was exercised. Its confirmation branch executes only if the actual registry contains a reviewed choice. MapLibre numbered-cluster absence requires renderer/native evidence; App stubs do not prove pixels or mounting behavior.

## Decisions / daily work journal

WHY: the user explicitly defers walking navigation and asks for concise directory chat. HOW: gate direction intent before matching, retain future typed payloads but suppress their interactive renderer, reuse existing offline icons and canonical references, preserve source metadata behind named disclosures, keep state in the continuously mounted screen. Rejected alternatives: deleting routing/saved payload contracts; keeping direction handoffs that lead to origin/entrance selection; fabricating business descriptions/hours/photos; replacing scalable text with fixed-height truncation; claiming native appearance from stub tests.

This lane implements the user's approved scope changes. Parent owns new integrated decision IDs and the main work journal.

## Remaining acceptance evidence

No Android screenshot, physical observation, TalkBack run or performance measurement was produced by this lane. Native checks required: compact result readability at normal/large text and landscape; header/composer keyboard fit; source disclosure focus order; direct Map/sample handoff; no exposed Directions/Plan/Save entry; draft/conversation/scroll preservation during button and shake screen changes; cancellation/offline source rendering. Source status and synthetic labels must remain legible. Parent must inspect the diff, rerun independent tests and explicitly ACCEPT before integration.
