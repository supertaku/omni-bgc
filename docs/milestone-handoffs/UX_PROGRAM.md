# Omni-BGC approved UI program — handoff

Date: 2026-10-10, Asia/Manila. Parent disposition: ACCEPT bounded host-tested implementation; native visual/interaction and production gates remain PARTIAL. The explicit user request removes visible demonstration badges and treats local source records as ordinary browsing content. Original source status is retained behind disclosure; canonical approval and publication permissions are unchanged.

Delivered in the real Expo/React Native application:

- Shared warm navy/blue design tokens, locally bundled Nunito/Nunito Sans weights, offline Ionicons, original branding precursor, rounded accessible controls and sheets.
- Geographic 2.5D pastel building families, source trees/greenery/paving,19original map sprites, category clustering and selected pin, Flat mode/reset, sheet-aware focus, route/transit bounds, reduced motion, generic six-entry source-footprint landmark registry.
- Checksum-verified atomic app-private map installation avoids the installed Android PMTiles asset byte-range problem. Final glyph coverage includes U+2019 and all currently rendered map text.
- Map search/categories/More, place peek/details/source disclosure, optional GPS/manual origin, existing conservative route states, local saved places and ordered itineraries, transit/pack/privacy interfaces.
- Mounted Assistant timeline, user/assistant bubbles, suggestion chips, multiline composer/send/cancel, typed place/menu/route/itinerary/citation/capability cards and direct map/settings handoffs. Deterministic local search, including literal source cuisine tags, exact supported PHP budgets and saved visits; no inference or model installation.
-161named source-coordinate places from the exact retained historical OSM inventory. Source-only UUIDv5 identities, separate generated storage, candidate lineage preserved, no menus/hours/ratings/entrances invented. Source records never enter the canonical exporter or qualify for navigation automatically.

## Milestone status

| Milestone | Status | Evidence / remaining gate |
|---|---|---|
| UX-0 baseline/architecture | PASS | Clean local/remote baseline, concrete path ownership, reference mapping, native compatibility investigation |
| UX-1 design/branding | PARTIAL | Tokens, fonts/licenses/icons/components and contrast pass; native large-text/TalkBack/screenshots unrun |
| UX-2 map foundation | PARTIAL | Implemented private resources, layers, flat/camera; native map/offline restart unrun |
| UX-3 artwork/landmarks | PARTIAL | Original atlases/source-aligned families/registry and repeat hashes pass; custom faithful facades/detailed roofs/windows deferred |
| UX-4 product UI | PARTIAL | Native code integrated; physical end-to-end interactions and landscape screenshots unrun |
| UX-5 Assistant UI | PARTIAL | Typed/local functional presentation and focused tests pass; native keyboard/interaction verification unrun |
| UX-6 data integration | PARTIAL | Isolated historical source directory with ordinary display per user override; publication gates intact; synthetic fixture content stays in tests |
| UX-7 Android packaging | PARTIAL | Installable standalone ARM64 APK and exact archive/asset inspection; actual launch/SQLite/render proof unrun |
| UX-8 visual/interaction closure | BLOCKED | No connected Android device or configured AVD; native screenshots, cold-offline launch, FPS/memory, TalkBack and gesture tests cannot run |

## Validation and artifacts

Run `npm run check:ui` in `apps/mobile`. Independent parent runs passed app typechecking, installed style/resource validation, two exploration tests, seven Assistant tests, five source-directory tests,27routing cases,40mobile contract/retrieval/resume cases,8existing UI state/flow cases,7font/license hashes,161source record lineage checks and11contrast pairs. Resource installer mock cases cover corruption, interruption, atomic activation and reopening. See `docs/evaluations/ux-program/host-validation.json` and individual logs. These are host checks.

Final map inventory SHA256: `b286c9ab44ba8bd523b67e2f58a78ebc9c30e463d10409becc3ffa3b9edf440f`;27tiles,548geographic records,461013bytes. Glyph ranges0–255 and8192–8447; source shape/coordinates retained. Directory output SHA256: `052b972364bc9862cb66b47a57681814f02a65135a28d7eb25825184a0257d13`. Font/art/source manifests retain exact licenses/checksums. Frozen map generation repeated identically.

The first successful APK was superseded because native resources had been copied before the final sprite/glyph inventory. Final copy-corrected build PASS in30s; deliverable `apps/mobile/artifacts/Omni-BGC-0.2.0-arm64.apk`,42,271,549bytes, SHA256`c6533b51fa9749c275c239dcce4f0d3b7b4b11a0d7bc6a59c1adf21b4719dc6a`. Independent archive check verified all10map resources,3static font weights, offline icon font and release bundle; SDK APKv2 signature verification PASS. The actual results are in `docs/evaluations/ux-program/apk-verification.json`. `apps/mobile/artifacts/preview-prebuild.log` and `preview-build.log` retain final build evidence. Package `com.omnibgc.preview`, display name Omni-BGC, version0.2.0, Android24–36, ARM64. Existing development signing and package identity are retained to preserve local user state.

## Reproduction and review

Retain the licensed local inputs specified in the map builder README. Build the source directory with `python pipelines/etl/place-intake/build_ui_directory.py`; build retained OFL fonts with `python pipelines/etl/place-intake/build_ui_fonts.py` (fonttools4.60.1 in workspace `data/generated/ui-tools`); generate the map using its isolated pinned environment; then run the UI host gate.

From `apps/mobile`, run `scripts/build-preview.ps1 -SdkRoot 'C:/Users/joshu/AppData/Local/Android/Sdk'` with the existing Android Studio JBR. The script verifies directory/font/license hashes, CNG verifies map assets, and Gradle packages release bytecode using repository-local `.g`. `python apps/mobile/scripts/check-ui-apk.py` verifies the archive against exact resources and fonts. No public tile service is used.

Install the final APK on an ARM64 Android phone, open Map/search/place/details/saves/itinerary and Assistant, send “Find coffee” or a cuisine/place query, open a result on Map, switch back and verify the conversation remains. Check Flat/reset/pan/pinch/pitch, system back, keyboard, landscape and200%text. Then disable connectivity, force-stop/reopen and inspect fonts/sprites/map/search. No route is available without eligible entrances and a reviewed graph. Capture current screenshots and measure native performance before marking UX-8 passed.

## Remaining limitations

Map geography still covers the retained High Street area. General extrusions and sprites provide an illustrated direction, not the reference board's fully detailed architectural illustration. The registry is an extension point for future properly sourced landmark art. Menus, live hours/reviews/transit and safe walking endpoints remain absent unless reviewed packs provide them. iOS resource installation/native validation remains pending. Existing24dependency audit findings remain open. No current Android device screenshot or performance result is reused from earlier milestones.

Changed paths: `apps/mobile/{App.tsx,app.json,package*.json,scripts,assets/brand,assets/fonts,src/features,src/map,src/ui,src/contracts.ts,src/generated-assets.d.ts}`, `packages/ui/tokens.json`, `pipelines/{map-pack,etl/place-intake/build_ui_directory.py,etl/place-intake/build_ui_fonts.py}`, `data/manifests/{ui-directory.json,offline-pilot-inventory.json}`, `tests/data-quality/ui`, `docs/design`, journal and this handoff. Raw/generated geographic data remain ignored. No commit, push, main merge, dataset publication or permission expansion performed.

Future AI work remains separately authorized: implement a model/inference adapter behind the existing typed payload contracts and capability states only after device/data/security review. The current local query helper is ordinary literal directory search, not an AI runtime.
