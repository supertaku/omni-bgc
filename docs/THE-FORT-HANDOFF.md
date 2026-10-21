# The Fort — implementation handoff

The application is now The Fort 0.4.0, retaining `com.omnibgc.preview`, private model paths, conversation database and the existing offline pack recovery. This is a local manual-test delivery; no device, USB, ADB, push or publication was used.

## Completed work

- **AI:** removed a reproducible activation race in which a model finishing before the cancellation probe was rejected despite successful inference. Activation now verifies generation and safe native release before committing its pointer. Native cancellation, idle acknowledgement, lease protection, bounded generation and release remain enforced. Recovery verifies a completed model left between file rename and pointer commit, and download reuses an already valid final artifact. Failed startup still exposes the retained model's Use action, with actionable errors. Startup allows up to 180 seconds for native hashing/initialization; a JS timeout fences the model until late initialization actually settles and cleanup succeeds.
- **Hybrid AI:** exact name/category lookup, menus/dishes, exact PHP budgets, recorded hours, approved offices, entrances and explicit approved map focus bypass Gemma through shared validated tools and current-source revalidation. Direct execution is bounded to four dispatches/10 seconds; model proposals retain two rounds/four calls/45 seconds. Ambiguous/contextual requests use Gemma once; model-off or failed generation produces bounded clarification without discarding unknown constraints. Denial/cancellation never triggers commands. Price amounts, qualifiers and branch relationships now survive compact model observations, while exact money calculations and factual presentation stay host-owned. Source exclusions prevent research or fictional sample fallback for verified-only requests. No extra ML or dependency was justified. See [implemented capability matrix](AI-CAPABILITIES.md).
- **Chat:** compact assistant bubbles with the Fort avatar, distinct user bubbles, progress/cancellation states and source disclosure. Completed structured payloads and bounded display fields persist in a validated envelope; older raw history records remain readable. User prompts are saved independently of successful generation. Interrupted partials are removed rather than becoming completed historical responses. Fresh source checks still govern place actions.
- **Dialogs and menus:** application-owned confirmations use a shared accessible modal; Android system permission dialogs remain platform-controlled. Model actions are accessible icons, with destructive confirmation and context-sensitive download/use states. Restaurant menus open in a scrollable modal, with categories, recorded prices/descriptions, caveats, source disclosure and symbolic unavailable-image placeholders.
- **Map:** real offline OSM context extends to longitude 121.035–121.070, latitude 14.530–14.575. It includes 11,432 building footprints, 5,748 road/path features, 69 green polygons, 16 water polygons and a source-backed St Luke's label. Source XML receipts and checksums are retained. Exact clipping keeps road/path segments outside the detailed core; both existing PMTiles packs remain byte-identical. Important pins appear earlier, selected pins stay identifiable, streets/walkways and source-backed zebra markings are clearer. Ten original facade textures use existing building-family metadata, with power-of-two image dimensions required by MapLibre.
- **Branding:** original geometric fortress/gateway identity, Android icon/adaptive/monochrome assets, splash and chat avatar; display name The Fort. Internal identifiers and data schemas retain compatibility. No dependencies were added.

## Verification

Passed: `npm run typecheck`; `npm run lint` (zero errors, two pre-existing MapCanvas hook dependency warnings); `node scripts/check-regressions.cjs`; `node scripts/check-history.cjs`; `node scripts/check-map.cjs`; `git diff --check`; Expo Android prebuild. The focused checks cover activation/retry/corruption, retained model recovery, exact price/tool schemas, bounded two-round dispatch and fresh result revalidation, zero-inference direct tools and bundled research menus/hours, failed-turn fallback/abort isolation and observation price qualifications, delayed native initialization ownership, legacy/new history codecs, historical sample rendering, resource/source/image checksums and map clipping/style invariants. Native and storage boundaries in host regressions are controlled fakes, not phone evidence.

A fresh Sol Medium review found a missing deterministic-response display snapshot and related historical fictional-menu rendering regression. Both were fixed; the added rendering regression was observed failing before the fix and passing afterward. Android build and package evidence are recorded below when complete.

## Engineering decisions and limits

The existing stores, retrieval tools, map packs and graphics pipeline were reused. The new geography is an additive display-only GeoJSON layer; it does not enlarge the approved directory scope or enable navigation. The facade atlas remains intact; original runtime textures provide new styling without rewriting reviewed resources. Source-derived footprints and topology remain distinct from illustrative display materials.

Coverage is practical rather than complete: nearby buildings are bounded to control memory, OSM relation polygons and incomplete ways are omitted, and polygons touching the detailed pack envelope are omitted whole. These may leave polygon gaps. Outer areas have less building detail. Thinking Machines' current exact office could not be verified, so no office pin was invented. See [map coverage and sources](map-coverage.md).

Responses already reduced to historical summaries by older APKs cannot be reconstructed from the discarded structured fields; those existing records are retained. New responses preserve their display payloads. History keeps the existing 200-message/256 KiB total bound, with a 128 KiB per-record cap. Unsupported or oversized payloads report a save failure rather than silently dropping a response. Images are placeholders where no permitted verified photo exists. Text formatting retains the existing plain-text/structured capabilities; no Markdown engine was added.

Real download throughput, cold-start time, model compatibility/inference quality, memory/thermal behavior, graphics/performance, accessibility and installation require the owner's phone testing. Host evidence addresses code defects; it does not establish the unique cause of the previous phone failure or claim on-device inference success. Model weights remain a separate reviewed download, not bundled in the APK. Existing internal-preview/public-distribution restrictions remain in effect.

## Manual phone checklist

1. Update the existing app without uninstalling; confirm The Fort branding and retained data.
2. Airplane-mode pan/zoom through BGC and surrounding roads/buildings; check overview landmarks, selected pins, facade textures and crossings.
3. Open restaurant Menu, scroll, expand source details, close/back, and inspect placeholders/price caveats.
4. Download the model or reuse the previous verified file, tap Use, ask a greeting and a contextual local query, then stop generation. Check exact budget/category, recorded hours and named map-focus requests with and without AI. Compare a contextual follow-up with the model on and off; verified-only searches must show no fictional or research substitution.
5. Background/foreground the app and reopen it; completed responses should keep their text/cards. Interrupted prompts should remain without unfinished assistant text.
6. Remove/reinstall the model using confirmation; check retry after setup interruption and a restart without another download.

## APK delivery

Delivered [000002_omni-bgc_v0.4.0_arm64_release_20261021T004409Z_e0cd3f3.apk](../apks/000002_omni-bgc_v0.4.0_arm64_release_20261021T004409Z_e0cd3f3.apk) with [checksum receipt](../apks/000002_omni-bgc_v0.4.0_arm64_release_20261021T004409Z_e0cd3f3.apk.sha256).

- Version **0.4.0**, versionCode **2**, package `com.omnibgc.preview`, ARM64 release, Android API 26+.
- Size **70,422,831 bytes**; SHA-256 `6001ad29d0769c858183b5659feaeace0296cadb9f0c01a66f012dabf74aff4e`.
- Source `e0cd3f371d2050d9ae7583ab8d8999c69699846b` **dirty**, including the application changes described above. Delivery time `2026-10-21T00:44:09Z`.
- Expo prebuild and final Gradle release compilation passed. APK v2 signature verified and matches the previous test signer. ZIP, package/permissions, final hybrid JS, 19 native libraries, both offline packs/24 resources and ten decoded facade textures verified. Resource filenames are optimized during packaging; texture verification compares actual decoded pixels.
- Release variant uses the existing debug/test certificate; it is not production signing or phone acceptance. Full metadata and installation limits are in [APK index](../apks/INDEX.md).
