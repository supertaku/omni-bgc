# Pre-AI engineering handoff — 2026-10-10 (Asia/Manila)

Parent reviewed the resumed implementation and independently inspected the critical source, schema, rights, routing and native integration changes. The result is an **internal Android preview**, not completion or production acceptance of all M1–M14 gates. No main merge, remote push, dataset publication or public APK release occurred. Physical-device testing is **NOT_RUN_USER_REQUEST** following the user's explicit instruction to keep developing without it.

## Delivery and use

APK: `apps/mobile/artifacts/Omni-BGC-preview-arm64.apk` (local, ignored). Package `com.omnibgc.preview`, version0.1.0, ARM64, minimum Android24/target36; release variant signed with the development keystore. It uses a separate package from M0 and requires no Metro server. Compilation and packaged-resource checks establish an installable artifact; launch/render behavior remains untested on the current device. Exact APK size/hash/signature/manifest and build results are recorded in `../evaluations/program/release/ARTIFACT.json` after successful packaging. Final APK:41,287,919bytes (39.4MiB), SHA256 `ab8909682dfcf8401a6c7ccd844d292e2db73eb0d8c6eff0c7740068969c17ba`. Final resumed build passed in4m23s:583tasks,12executed/571up-to-date. All9bundled resources match the reviewed inventory; APKv2signature verifies; backup/debug flags are false; background location/audio/overlay/external storage permissions are absent.

Install the local APK using Android's normal installer or `adb -d install -r <absolute-apk-path>`. Launch **Omni-BGC Preview**. Map offers original 2.5D or Flat view, search/filter sheets, origin selection, saved/manual itinerary and offline status. Assistant explicitly says coming later. This preview is for the owner's internal review; do not redistribute its historical derived dataset or publish it to an app store.

## Implemented behavior

- Immutable entities, evidence-bound facts, explicit unknowns, source checksums and permissions, project-defined pilot boundary, normalized staging/read schemas and transactional intake/promotion.
- Original garden/game-inspired map: licensed historical real footprints, illustrative extruded heights, warm roads/plazas, parks/water, original grass/tree sprites, local labels, zoom tiers, approved-place clustering, camera padding and a genuine Flat/route mode. Native rendering/visual quality is unverified; M6 is not declared complete.
- Approved-only local lexical FTS, category filtering on map and results, place/building/floor/alias/menu/entrance/citation presentation, truthful missing-data states. No world facts are invented to populate the UI.
- Foreground GPS only on request, 15-second timeout, accuracy/age/scope checks, confirmed map tap/drag and approved-entrance landmark origin. Origins stay in memory; no precise-location upload/persistence.
- Conservative A* and source/rights-bound installed-core loader: real graph adjacency, directed access/grade/barrier checks, eligible edge snapping and retained entrance connectors, actual path geometry/metres/instructions. Unknown/candidate edges and centroid substitutes are denied. Progress matching exists as an engine helper; live turn-by-turn UI is **not implemented**.
- Verified static transit reader for shape/calendar/ordered stop claims, browse sheets and approved route/stop overlay; no live-arrival claims. Favorites, manually ordered itinerary, user durations/start time, validated walking lengths, and explicit share sheet persist locally. Walking pace/travel/arrival estimates are **not implemented**.
- Assistant coming-later screen and reusable typed presentation cards; fixtures stay in test files. No inference/model download/RAG/embeddings/vector search/app agent functionality.
- Independent versioned pack contracts, current rights/local digest registry, exact dependency binding, size/checksum validation, free-space reserve, cancelable strong-ETag/range resume, immutable candidate directories, transactional two-slot activation/recovery/rollback, local style resolver and read-only review dashboard. Real trusted download catalog is empty. Native transport, crash recovery and unused-partial cleanup/quota remain unproven/deferred.

## Actual data and permissions

Pilot only: project High Street rectangle `[121.0475,14.54865,121.05205,14.5524]`; 200m buffer is ingestion context, not navigation/official district authority. No whole-BGC completeness claim.

M3 preserves the exact reviewed OSM raw SHA256 `c7c77bdee83947293624a3a6036089e809c2fb2c1cec4d5283fb1c89535a8ac3`, retrieved2026-09-14. Fresh reproducible derivation yields2,569nodes/3,249candidate edges/8components, **0eligible real navigation edges**. Incomplete/unsupported relations remain quarantined. Prior code/media/processed entities and inferred entrances were excluded.

The corrected pilot has27MVT tiles,548source-linked render records and212,121resource bytes, manifest SHA256 `2fa53a5bd54425bad58b86d592fd69baf687ac048a982e3e1e7489ed96cae808`. Independent decoding found maximum0.416093m quantization difference within the tested half-cell bound, no outside-pilot trees/point-road artifacts, and all nine resource hashes/app copies matched. Local glyphs derive from hash-verified Noto Sans/OFL; sprites/icon are original. ODbL/OFL notices are retained. No OSM public raster tiles were fetched.

The new internal collection queue contains **290 historical leads**, including41restaurant and22cafe classifications,9same-name review groups, and363outside-pilot point exclusions. Every emitted geometry/tag was independently compared with the accepted source; ambiguous references were retained without merging. These counts are not a verified business census. Candidate details remain in ignored local outputs. **Approved places0; verified menus0; verified entrances0; approved transit0; trusted downloadable packs0.** Source permissions, current facts and field checks still require real evidence and human review. Public data/merchant/media/transit redistribution remains unauthorized.

## Validation and performance

One consolidated deterministic phase passed:14governance,25M1contracts,13GISquality,8topology,30intake,10desktop SQL/projection,22mobile contracts,11resume,27routing/loader,8UI state and4itinerary tests (**172 final cases**, excluding superseded intermediate reruns). Strict domain/geo/routing and final mobile TypeScript passed. Parent also retained M1's15independent architectural checks and earlier prototype browser/screenshot evidence. CI is configured; no remote CI run is claimed.

Owner manifests were independently checked, with explicit historical UI/M9 revisions bound separately. See `../evaluations/program/integration-qa/RESULTS.md`. Native build logs and APK inspection are separate from these desktop tests.

Current phone/offline cold restart, FTS native concurrent/exception/close lifecycle, fonts/sprites readability, GPS permission/fix, TalkBack, large text/orientation/gestures, real walk routes, updates under power loss, startup median/p95, FPS, search/route p95, memory and battery: **NOT_RUN_USER_REQUEST / NOT_MEASURED**. Historical M0 phone results do not establish current success. No Mac/Xcode/iOS device is available; iOS map currently shows an explicit unavailable notice while shared data/UI APIs remain portable.

## Acceptance and unresolved work

Full status by milestone is `../evaluations/program/STATUS.md`; current risks are `../RISK_REGISTER.md`. Bounded engineering pieces are accepted after parent review, but M2/M4–M14 full gates remain BLOCKED wherever their required real-data/native/field/UX/legal inputs are absent. M3 is accepted only as internal candidate GIS. Separate validated foundation commits and subsequent scoped engineering commits preserve these distinctions.

Final online dependency audit still reports **24 advisories (16high/8moderate)**. Pinned SQLite ownership/workaround is implemented, but production native lifecycle and security clearance are withheld. Development signing is not production identity. Remaining feature gaps include current approved data/menus/transit, complete BGC geography/landmark coverage, field-safe routes/live route progress, itinerary travel times, real Figma/study/native visual approval, iOS resource delivery and operational cache cleanup. These are explicit incomplete requirements, not passed empty-data demonstrations.

**Production readiness: NOT ACCEPTED.** Next work requires actual rightsholder/field evidence, reviewed data packs and hardware validation; speculative facts or successful-test claims cannot substitute for them. No further paid service, legal grant or public distribution was authorized or performed.
