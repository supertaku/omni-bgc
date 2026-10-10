# Omni-BGC UX V2.1 — parent engineering review

Implemented on the local `codex/ux-v2.1` branch. The preceding APK was installed over the existing Android app without clearing its data. Parent **ACCEPTS the bounded host implementation and the device flows supported below**. Full milestone acceptance remains **PARTIAL** pending native confirmation of the final style correction and physical shake/walking interaction. The user directed completion of the APK with the phone unavailable and instructed that everything stay local; remote Actions and public publication are intentionally NOT_RUN. No main merge, dataset publication, schema migration, location upload or AI runtime.

## Final product behavior

The user's last steering supersedes the original preference/cluster requirements: numbered marker circles, Transit information, Settings and the shake toggle are removed. Shake defaults enabled; white Chat and Assistant Back remain usable independently. Source/license and offline diagnostics are reached through readable map attribution.

The continuously mounted Map/Assistant pager retains its approximately280ms native-driven horizontal slide and reduced-motion policy. Four opposing acceleration peaks plus gravity filtering, magnitude/time gates and a2.5s cooldown recognize deliberate patterns. Background, keyboard, transition and critical-operation guards remove the owned subscription. Physical calibration is provisional; deterministic traces do not establish real walking performance.

Place selection opens a compact140dp sheet. Header drag reveals supported Overview, hours, menu/products, services and Sources directly; sections start expanded and retain independent collapse. Empty fields are omitted. Actual keyboard screenshots confirmed broad and filtered searches remain accessible above the keyboard after measured viewport bounds. Save, Plan, Add-to-Itinerary, Directions, origin/entrance selection and walking surfaces are absent. Original saved reads, readonly itinerary, storage contracts and routing infrastructure remain.

Assistant results use compact rows, visible candidate/sample status, direct View on Map and source disclosure. Draft/conversation remain mounted; suggestions stay collapsed. Direction queries return exactly “Walking directions are not available in this version.” Fictional menu/hours fixtures keep null coordinates and explicit sample notices. Source-derived businesses receive no invented menus/hours; candidate item price/tags/allergens cannot be promoted by an approved parent.

The High Street map retains548 source IDs,40 buildings/parts, the17historical-height/4level-estimate/19illustrative-family hierarchy and10families. Roads and source pedestrian surfaces differ;64sidewalks,199surface tags,1recorded width and6tag-backed zebra ways retain lineage. Twenty-seven sparse deterministic original pedestrians are restricted to eligible source public paths after13obstacle-clearance rejections, capped80 and visible at zoom18+. Forty-four original sprite entries include alternate facades and paving. The glyph builder now obeys MapLibre's24px/bearingY−25 PBF baseline contract. All generated geometry and placement evidence remain internal/local.

## Download and reproducibility

- APK: `apps/mobile/artifacts/Omni-BGC-UX-V2.1-0.3.1-arm64.apk`, version0.3.1,42735493 bytes, SHA256 `e261a8f12ec1762ab6aa04c560bfc93ff83b1b8ad94b14a158f4c67b50bff97d`.
- Final build completed2026-10-11; resumed after the previous turn interrupted Gradle. Full prebuild had copied the corrected inventory; the resume verified its checksum before skipping repeated prebuild. The final APK has not yet been installed because ADB reports no connected devices. Prior native screenshots and14passing device checks cover APK SHA256 `accae6ea715fa2bacbf6405bb684c7d1ebf4897727a33603fdf3d9545f43e0f5`, before the style-only ordering correction.
- Same development-key signing identity as the existing app; internal review build, not a production-signed store release. `adb install -r` succeeded; no uninstall, app-data clear or saved-row deletion.
- Frozen internal pack manifest SHA256 `ab623c6776a08d80ee7b4e9befe472a4d9261aa5c5a70ebf11f30b27c2ae6235`;566507resource bytes/27tiles. Exact source/build input hashes, licenses, duplicate counts and sample QA are in [MAP.md](MAP.md) and tracked pipeline metadata.
- [apk-verification.json](apk-verification.json): ZIP, ABI,10offline resource hashes,3font weights and Ionicons. [bundle-verification.json](bundle-verification.json):10exact final source modules plus native SQLite RTree/FTS5 binary strings. Static binary evidence is distinct from [startup-diagnostics.png](startup-diagnostics.png), which reports actual map ready and store integrity `ok`.
- Build: existing `apps/mobile/scripts/build-preview.ps1` with Android SDK36/JDK bundled by Android Studio, Expo57.0.27/RN0.86.3/MapLibreRN11.5.0/AndroidNative13.6.1/expo-sensors57.0.3. Final build log stays local.

## Actual validation

| Gate | Evidence and result |
|---|---|
| Clean-checkout workflow parity |22command groups PASS; exact pinned installed dependencies reused, ignored historical inputs absent. [clean-quality.json](clean-quality.json). This is local parity, not a remote Actions run. |
| UI/resources/source regressions |11focused command groups PASS;7font/license hashes,161source-only records,11contrast pairs. [host-validation.json](host-validation.json). Final focused App/sheet regression13/13 PASS after keyboard integration. |
| Map/GIS independent review |All27tiles,548IDs,40height interpretations,6zebra ways;27illustrative placements/reversed-input determinism/spacing/obstacle gates and512decoded glyph metrics PASS. Deprecation warnings retained, not suppressed. |
| Native map flows |5/5 PASS: real cold map, one Chat, search/peek, header drag/section collapse, selected place and collapse survive Chat/Back. [native-map.json](native-map.json). |
| Native Assistant/data |4/4 PASS: draft/local results/exact direction deferral, no Settings/Transit, fictional menu/saved surfaces, actual map/SQLite readiness. [native-assistant.json](native-assistant.json). |
| Offline/lifecycle |2/2 PASS: airplane mode with Wi-Fi off cold map/Assistant; one foreground sensor connection, zero in background, one after resume. Original connectivity restored. [native-offline.json](native-offline.json). Native80ms sampling observed despite60ms request. |
| Adaptive UI |3/3 PASS on the preceding APK: actual font scale1.5, actual landscape rotation1, Android reduced-motion setting with operational Chat/Back. Original preferences restored. [native-adaptive.json](native-adaptive.json). Screenshots do not measure transition duration. |
| Final correction/performance |The last change only reorders the decorative pedestrian layer before extrusion tiers. Portable ordering/resource checks PASS; final rooftop occlusion, close-up workload and final memory/frame capture are deferred because the user confirmed the phone is unavailable. Prior window-frame statistics do not establish isolated map FPS or causal sprite cost. |
| Physical shake/walking/pinch |Deferred: the user confirmed the phone is unavailable. Stock-device ADB cannot provide actual shake or arbitrary accelerometer injection. Button fallback, sensor availability/registration and synthetic detector behavior are verified separately. |
| TalkBack/iOS/battery |TalkBack narration and iOS offline installation are NOT_RUN. No controlled battery-drain or causal pedestrian A/B allocation claim. |
| Remote GitHub Actions |NOT_RUN by user instruction: keep everything local. Earlier automatic approval review rejected a public push without explicit approval. No commit, push or PR was created. Staged local review remains available; generated geography/placement evidence and phone captures are excluded. |

## Device screenshots

Actual authorized physical Android16/API36 ARM64/GLES3.2,1220×2712/480dpi. Serial and personal notification content are not saved. These local review artifacts are ignored by Git.

- [Main map](main-map.png), [peek](place-peek.png), [expanded details](place-expanded.png), [collapsed section](place-collapsed-section.png), [return to compact sheet](place-recollapsed.png).
- [Broad keyboard search](search-keyboard-open.png), [filtered keyboard search](search-keyboard-results.png), [Assistant results](assistant-results.png), [retained draft](assistant-draft-preserved.png), [direction deferral](assistant-directions-deferred.png).
- [Fictional populated details](sample-details.png), [fictional menu](sample-menu.png), [saved records](saved-records.png), [offline cold map](airplane-cold-map.png), [background/resume](background-resume.png).
- [Large-text details](large-text-details.png), [large-text Assistant](large-text-assistant.png), [actual landscape details](landscape-details.png), [landscape Assistant](landscape-assistant.png), [reduced-motion map](reduced-motion-map.png). Exploratory `qa-*`, old `settings.png`/baseline captures and failed `native-environment.json` are historical debugging artifacts, not current acceptance evidence. Final correction close-ups remain pending reconnection.

Compared with the supplied board, the installed app adopts warm compact chrome, a map-dominant layout, direct place sheets and concise conversational results. Geographic coverage is confined to the retained High Street pilot, so tall-building silhouettes and district completeness differ from the concept. Illustrative facade/roof likeness and sparse vegetation/people remain visual limitations; no fabricated geographic expansion was used to match the reference.

## Changes, failures and remaining work

Owned changes: App integration/config/CI; `src/ui` pager/sensor/sheets; `src/features/explore` chrome/details; `src/features/assistant`; MapCanvas/style/resources/original map assets; map-pack builder/validators/metadata; meaningful interaction regression suites; journals and reproducible device-QA scripts. Shared domain/SQLite schema and canonical IDs were not changed. [MOBILE.md](MOBILE.md), [ASSISTANT.md](ASSISTANT.md) and [MAP.md](MAP.md) are specialist reports; this parent review supersedes their earlier pending/historical statements. Material decisions are DEC-049–051.

Failures corrected: ignored-data dependency in a new App test, an existing glyph baseline error, keyboard sheet overflow, clipped accessibility targets, premature input/back actions and Android16 `appId`/rotation harness differences. Host tests retained real callbacks while replacing ignored data with authored test contracts. Actual native evidence covers the preceding APK; the final style-only correction is separately awaiting native confirmation. Historical native crash-buffer entries are excluded from current-process claims.

Observed performance on the preceding release: cold Activity start541ms, React entry to fully-rendered map569ms (ADB-observed upper bound1574ms); another launch261ms/373ms. Earlier composed-window capture:281frames,6janky(2.14%),P50/P90/P95/P99=5/10/22/113ms; PSS281067KiB/RSS413536KiB. These are window statistics and an uncontrolled process snapshot, not isolated map FPS or causal pedestrian cost. Baseline/release swap states differed materially; no memory or battery improvement is inferred.

Remaining: final correction install/roof occlusion/native close-up workload after USB reconnection; actual deliberate shake both directions and ordinary movement/pinch; remote Actions intentionally unrun under the local-only instruction; TalkBack narration and iOS offline install; controlled map renderer FPS/battery/pedestrian A/B measurement; historical geographic/factual and distribution review. Walking navigation and AI inference remain deliberately deferred.
