# Omni-BGC UX V2 implementation handoff

2026-10-10, Asia/Manila. Branch `codex/ux-v2`, starting commit `02bb1c969487760632e5371250babe984a3370b8`. **Parent ACCEPT: bounded host-tested implementation, generated resources and internal Android artifact.** Full native/visual/field acceptance remains pending. No commit, push, main merge, dataset publication, canonical schema/ID edit or AI runtime.

## Android deliverable

`apps/mobile/artifacts/Omni-BGC-UX-V2-0.3.0-arm64.apk` is the final development-key-signed release-variant APK. Package `com.omnibgc.preview`, version0.3.0, Android24–36, ARM64; existing package/signature identity retained for an update that preserves app data.

- Size42,695,181bytes; SHA256 `d8f450bb5e35d3a2494ea2b7be9146a8ec9bf52887ca17970e1981358545859d`.
- Full native build succeeded in3m47s; final incremental build succeeded in27s. Superseded build logs remain separate. Final source-map comparison matches six critical modules; no outdated bundle inferred current.
- APK archive/resource/font/icon hashes and APKv2 signature PASS. Rebuilt SQLite contains both ENABLE_RTREE/ENABLE_FTS5 and RTree module text; historical APK lacked RTree. This validates the binary correction, not a phone runtime query.
- Exact evidence: `apk-verification.json`, `apk-signature.log`, `apk-badging.log`, `rebuilt-sqlite-capabilities.json`, `bundle-source-verification.json`, `final-build.log`.

## Milestone status

| Milestone | Status | Actual result and remaining gate |
|---|---|---|
| UX-V2-0 | PARTIAL | Root-cause evidence and RTree native fix, independent startup stages, preserved saved-state integrity/recovery, localized retry/diagnostics; host/native binary checks pass. Cold phone launch/persistence not run. |
| UX-V2-1 | PARTIAL | Tabs removed; mounted horizontal280ms native-driven screen track, deliberate inset swipe handle, explicit controls, reduced motion, state retention and confirmation guard implemented. Native gesture/system-back/memory acceptance not run. |
| UX-V2-2 | PARTIAL | Compact48dp search,34dp visual chips/48dp targets, grouped controls,140dp peek, staged sheet drag/accessible expansion, large-text scrolling, secondary Data/Privacy and visible OSM credit. Pixel/TalkBack/device validation not run. |
| UX-V2-3A/3B | PARTIAL | Native patterned extrusion prototype, ten families, source heights/parts and bounded landmark registry. All tiles decoded and source-bound. Selective native sprite/footprint hybrid investigated; accurate custom3D architecture and device benchmarks remain open. |
| UX-V2-4 | PARTIAL | Original procedural source,16standalone samples,29atlas entries,1x/2x densities, hashes/licenses, roof/facade/greenery/paving assets and offline APK resources verified. Android texture/color/clipping and broader detail assets await visual validation. |
| UX-V2-5 | PASS, bounded fixtures | Six fictional branches/33sample dishes with prices/recipe tags/hours/services and explicit notices exercise local search, details, saves, itinerary and Assistant. Zero preview geography/entrances/routes; source directory remains161historical candidates. No new verified merchant/menu publication claimed. |
| UX-V2-6 | PARTIAL | Destination→origin confirmation→reviewed arrival→graph route/instructions workflow remains conservative; map draft can be tapped/dragged, GPS permission optional. Isolated nongeographic preview walks all steps. Zero eligible real graph/entrances; real walking/live GPS guidance not demonstrated. |
| UX-V2-7 | PARTIAL | Compact header/composer/messages, vertical result rows, collapsible suggestions, source disclosure, sample-aware menu/budget queries and preserved draft/conversation implemented and host-tested. Native keyboard/selection/scroll validation not run. |
| UX-V2-8 | BLOCKED | ADB lists0devices; emulator inventory empty. No new native screenshots/video, cold-offline/resume/GPS/gesture/TalkBack evidence or FPS/startup/memory measurements. |

## Key implementation and source limits

The old catch blamed every boot failure on Saved Places. The accepted first migration requires RTree, while ExpoSQLite57.0.4's previous native flags enabled FTS only. The new config enables RTree; storage checks actual capabilities/integrity and exact schema versions before writes. Content reads own independent connections; saved failure returns null and cannot overwrite original data. Recovery recreates only exact missing local structures, never silently clears corrupt data. Startup reports graph unavailable separately from reviewed pack inventory and actual native map-render readiness.

The shell keeps one native map and the Assistant mounted. Map panning has no screen-navigation recognizer; only the inset handle owns left swipe. Assistant right swipe fails on vertical motion; while editing with the keyboard, the explicit Back control returns to Map. Hidden pages exclude touch/accessibility, repeated leave-navigation prompts are guarded, and rotation measures available page width. Map uses the installed supported TextureView to compose the slide. Parent corrected landscape control overlap, modal handle visibility, measured sheet camera padding and duplicate iOS keyboard avoidance. Full native selection/arbitration and memory tradeoff remain device tests.

Forty building/part records use17historical explicit heights,4levels×3m estimates and19deterministic family defaults. These fields stay distinct; none become factual measurements. The pilot contains one building part and six sourced zebra crossing ways. Six landmarks retain raw/geometry hashes and unknowns; the PSE source feature is not modeled as a whole tower complex. Source geometry remains27tiles/548IDs within High Street, not district-wide coverage. Frozen map inventory SHA256 `6356b38277d10333dfb866a8cc0bd1520f65e8d1dce0f8abdd2eb3c09488a25e`,499642resource bytes. Original artwork and ODbL geometry have separate notices; concept boards/photos are not production resources.

Fictional sample merchants retain candidate status, null coordinates/verification and no entrance, rating, review, allergen or route claims. Their price/recipe query exception requires the exact isolated sample IDs and synthetic source evidence; ordinary canonical candidate evidence remains excluded. Sample branch/menu source hash, license, counts, duplicate rejection and stratified QA are in `demo-manifest.json`. Samples never enter canonical exporter, reviewed packs or graph. The navigation UI preview requests no GPS, draws no geographic line and provides no real-world walking guidance. Real route display only consumes the existing conservative graph engine. Written instructions are explicitly not live tracking.

## Independent validation and review

Parent inspected all three specialist diffs/handoffs, exact accepted migrations, installed native contracts, sprite artwork and source evidence. Clean-snapshot `run-quality.py` runs22workflow-equivalent stages with ignored historical graph absent; all pass, including final strict domain/geo/routing TypeScript. The historical test explicitly skips, while mandatory synthetic candidate rejection still executes. Dependencies reuse installed exact npm pins and prior pinned Python workflow libraries; this is not a fresh hosted install. Focused final UI/gesture/navigation-preview suite9tests PASS; storage/demo17cases PASS; installed style/bridge/resource/font/source/contrast gates PASS; every packaged tile independently decoded.

Latest remote Quality [run38045584718](https://github.com/supertaku/omni-bgc/actions/runs/38045584718) succeeded on baseline02bb1c9. Current V2 changes were not pushed, so a hosted Actions pass for V2 is **NOT_RUN**. `.github/workflows/quality.yml` includes the new portable startup/demo/gesture/UI tests for a future branch run. Host-check artifacts are under this directory; optional historical skips and device gaps are explicit.

Changed paths: `apps/mobile/{App.tsx,app.json,package*.json,scripts,src/data,src/features,src/map,src/ui,assets/map-v2}`, `pipelines/map-pack`, map manifests, portable UI/data tests, decision journal and this evaluation. Generated geographic/font/tiles/APKs remain ignored and local. The user's visual reference directory is retained without modification.

## Native acceptance handoff

Install the final APK over the existing app with data retained. Compare actual screenshots to `docs/design/omni_bgc_ux_v2_references/before` and the tabless concept for overview/neighborhood/street/flat, selected place/search, details/sample menu, origin/entrance unavailable state, Assistant empty/results and transition. Test cold online/offline launch, saved reopen, map pan/pinch/pitch/rotate, handle swipe and explicit controls, open peek, keyboard/back, repeated/interrupted switching, large text/landscape/TalkBack and resume. Measure FPS/frame pacing, memory, startup/time-to-map and repeated switching on the phone. These items currently have **NOT_RUN** status, not inferred PASS.

Remaining geographic work: field/current source review for public graph-connected entrances; safe pedestrian topology/graph publication; wider retained BGC footprints/building parts and accurate source-supported landmark facade/roof assets. Validate iOS offline installation separately. AI inference remains outside this program.
