# UX V2 compact UI handoff — 2026-10-10, Asia/Manila

Status: IMPLEMENTED, awaiting independent parent ACCEPT and Android evidence.

Plan and success criteria: reduce chrome and selected-place peek; retain accessible actions; preserve mounted Assistant draft/conversation/scroll; use vertical compact results; keep source classification and explicit fictional examples. Risks: device gesture conflicts, large-text clipping, keyboard resizing, parent measured camera inset integration. New UX V2 brief supersedes the historical two-tab UI spec.

## Changed paths and behavior

- `apps/mobile/src/features/explore/MapChrome.tsx`: removed BottomTabs export; 48dp search, 34dp visual category chips within 48dp targets, grouped controls and explicit `onAssistant` entry. More still exposes categories/settings.
- `apps/mobile/src/features/explore/PlaceIdentity.tsx`: 64dp minimum directory rows and 76dp minimum cover; wrapping text and offline original category icons retained.
- `apps/mobile/src/ui/components.tsx`: selected-place `peek` at 140dp (100–150 configurable); header-only vertical drag and accessible expand/collapse step through peek/48%/90%. Search/settings cannot collapse into peek. Large text and landscape expose scrolling details/actions. `maxHeight:95%` bounds sheets to available parent space. `onHeightChange` reports actual native onLayout height for camera padding. Title changes reset scroll intentionally; collapse retains detail subtree.
- `apps/mobile/src/features/assistant/AssistantScreen.tsx`, `cards.tsx`, `styles.ts`: accessible `onBackMap`; compact header and secondary More/Data & Privacy; preserved conversation/draft/ScrollView; vertically stacked tappable place rows, smaller icons/messages/composer, collapsed suggestions. Source count/status and expandable detailed lineage retained. No remote media/dependencies/model runtime added.
- `apps/mobile/src/features/assistant/directory.ts`: explicit fictional menus/budgets/recipe tags use only known demo IDs and marked synthetic-preview evidence; canonical candidate prices/tags remain unavailable. Samples have no location/distance and cannot create routes. Result actions say View sample. No allergens inferred.
- `apps/mobile/src/features/assistant/ui-v2.test.cjs`, `directory.test.cjs`, `apps/mobile/src/features/explore/directory.test.cjs`: native-stub event/state tests, sample rejection boundaries, fixture import compatibility.

## Validation performed

Node v22.20.0, Python 3.13.7, installed TypeScript 6.0.3; React Native 0.86.3, Expo 57.0.27. No dependency changes by this assignment. Existing supported React state/native components and PanResponder suffice for the sheet header; parent owns screen Gesture Handler integration.

PASS: `node --test apps/mobile/src/features/assistant/ui-v2.test.cjs apps/mobile/src/features/assistant/directory.test.cjs apps/mobile/src/features/explore/directory.test.cjs` — 16 tests.

PASS: `node apps/mobile/node_modules/typescript/bin/tsc --noEmit --project apps/mobile/tsconfig.json` following parent interface integration.

Real parent sample module exercised through actual transpiled Assistant query logic: Find coffee -> 2 branches; Menu under PHP 150 -> 12 items; Vegetarian dishes -> 9 sample recipe entries; Show menu for Cloudline Coffee -> 11 items; Directions to Cloudline Coffee -> unavailable, explicit fictional/no-location reason. Candidate statuses unchanged.

Accessibility contract checks: named map entry/back controls, selected category state, collapsed/expanded disclosure state, 48dp minimum interactive targets, no text numberOfLines truncation, large text and landscape scrolling, measured sheet height callback. Host tests verify event/state contracts using native element stubs. They do not render pixels, execute TalkBack or arbitrate native touches.

## Decisions / daily journal

WHY: reference `references/tabless-swipe-concept.png` shows dominant map and compact vertical Assistant cards. HOW: reuse bundled category artwork, remove large illustration headers and horizontal collections, use compact whole-row handoff and optional source disclosure. Rejected: reference restaurant photos (unlicensed), fixed small text containers (clipping), whole-map sheet responder (pan conflict), silently promoting synthetic menu evidence.

Material product architecture remains parent-owned. This assignment adds optional component interfaces and implements already approved UX V2 decisions; parent records the integrated decision IDs in the main journal.

## Evidence limits and remaining gate

Reviewed actual supplied tabless reference image and existing UX spec. No native Android screenshots/video were produced by this assignment; no connected device was claimed. Android acceptance remains: ordinary map pan/pinch/rotate, intentional screen gestures, keyboard/back behavior, large text/TalkBack, peek actions and dynamic sheet camera padding, rotation and offline operation. Parent must inspect the diff, run independent tests and explicitly ACCEPT; native visual/performance results cannot be inferred from host test/build success.

## Independent parent shell review

Reviewed ExplorerPager/screen-navigation/App after parent integration. Native-driven 280ms translation preserves both mounted children, hides inactive accessibility descendants and disables page pointer events during transitions; map recognizer attaches only to explicit handle. Keyboard disables broad Assistant gestures while accessible header Back remains; reduced-motion listener sets duration 0. Parent owns deterministic screen-direction tests.

Changes requested to parent: landscape camera rightInset .56 did not match Sheet .66 width; handle over full sheets must be hidden to avoid consuming detail controls; confirmed departure from guidance should reopen retained route preview on return. Parent was informed via coordination message. Native recognizer competition with text selection/vertical scroll, repeated gestures and actual SurfaceView/TextureView behavior remains unverified.
