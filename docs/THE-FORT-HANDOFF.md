# The Fort — latest handoff

Latest delivery: [v0.5.0 ARM64 APK](../apks/000012_omni-bgc_v0.5.0_arm64_release_20261024T101025Z_02925c4.apk) · [v0.5.0 implementation, checks and manual acceptance](v0.5.0-handoff.md).

The following section records the previous v0.4.0 delivery and is retained as historical context.

# Previous v0.4.0 refinement handoff

Latest delivery: [000004_omni-bgc_v0.4.0_arm64_release_20261021T024556Z_b7a3b67.apk](../apks/000004_omni-bgc_v0.4.0_arm64_release_20261021T024556Z_b7a3b67.apk) · [SHA-256 receipt](../apks/000004_omni-bgc_v0.4.0_arm64_release_20261021T024556Z_b7a3b67.apk.sha256).

The Fort remains version 0.4.0, package `com.omnibgc.preview`, versionCode 2, ARM64 Android API 26+. Update the existing installation without uninstalling to preserve local state. This is an internal manual-test release using the existing test signer, not production-signing or device acceptance.

## Delivered behavior

- **Map:** additive 8.7 MB source-pinned context archive, 45,197 building features, complete retained multipolygon processing plus six missing relation supplements, neutral context volumes with explicit height provenance, and solid building massing across zoom 14–20. Original detailed/pilot packs, geometry and sprite receipts remain unchanged. Full lineage and genuine source limits are in [map coverage](map-coverage.md).
- **Filters:** matching mapped points remain represented by clusters or singleton markers from zoom 14 through 20. Cluster taps expand or show a paginated member chooser. Selected highlighting stays separate; More remains visible beside the scrolling category controls.
- **Discovery:** conversational coffee/category queries bypass inference, with shared aliases, bounded typo suggestions, exact branch/dish handling, strict price evidence, truthful empty results and source-aware recorded candidates. Verified-only and explicit research exclusions remain enforced. Near/nearest queries use a confirmed manual/GPS origin, sort bounded recorded matches by straight-line distance and do not claim global nearest results or walking routes. Origins last for this session and stay on the device.
- **Thinking Machines:** one sourced reference associates the existing candidate identity with Twenty-four Seven McKinley, using the retained building footprint's interior point. Current occupancy, floor, suite and entrance remain unverified. The broader office research dataset stays gated; this reference is not promoted to an approved operating office.
- **Restaurant details/menu/chat:** compact identity and text-first categories, no empty image panels or repeated branch caveats. Unsupported estimated amounts are omitted; original evidence is retained internally. Restaurant-specific hours are concise; missing actual hours display “Hours not available.” Mall, ordering and delivery schedules remain in source disclosure.
- **Optional model:** verified artifact availability is separate from runtime readiness. Download/Resume/Use/Retry/Stop/Remove are labeled; resumable partials survive transient errors. Transport/short-stream/eligible HTTP failures retry twice with cancellation-safe backoff. Thermal status enables explicit recovery without automatic model/prompt replay. Android severe blocking, hash verification, native ownership, idle acknowledgement, cancellation and release fences remain intact. Gemma stays optional; no extra model, cloud inference or runtime was added. See [AI capabilities and model comparison](AI-CAPABILITIES.md).

## Host validation

Passed TypeScript; full ESLint with zero errors and two existing MapCanvas hook-dependency warnings; affected-path ESLint; existing regression/history/map checks; focused discovery, restaurant presentation, model lifecycle, actual mocked storage retries, confirmed-origin wiring and context geometry/lineage checks; diff whitespace; Expo prebuild; and Gradle ARM64 release build (5m 33s, 702 tasks).

Regression/native/transport boundaries on the host use controlled fixtures. Final integration checks specifically cover named-branch dish retention, candidate coffee retrieval and source exclusion, candidate distance ordering without fallback replacement, invalid download ranges, cancellation during retry delay, and retained model files after initialization failures.

APK verification passed ZIP CRC, package/version/ABI/minSdk/targetSdk, signature continuity, permissions, disabled backup, release manifest, 19 native libraries, both original packs/all 24 original resources, exact context archive hash, generated Hermes bundle equality and final source-map correspondence. Unused facade PNGs remain in source; the original pack sprites are preserved. No model weights are bundled.

Source `b7a3b672f1f7759443d7dcfbe6c96c9496cbbc79` is **dirty**, on `codex/offline-explorer-refinement`; this includes the prior uncommitted icon-padding launch fix and the complete refinement input changes. APK size: **75,619,165 bytes**. SHA-256: `df9d3e2751f03fc19f8657a5c916332232bfe67472378bbf45fde20feced622b`. Full receipt and installation limits are in the [APK index](../apks/INDEX.md). No source was pushed or published.

## Owner phone acceptance

1. Update without uninstalling; verify retained conversation/data and airplane-mode map startup.
2. Repeat supplied overview/medium/close views around the core, surrounding neighborhoods, river/park boundary and major landmarks. Check geometry, consistent materials, frame pacing and memory behavior.
3. Select Food/Coffee/Shops at each zoom; tap clusters, coincident places, selected markers and More. Use the list for records without coordinates.
4. Ask “are there any coffee”, a named-branch dish, eligible numeric budget, restaurant hours and Thinking Machines questions with AI disabled. Confirm verified-only queries exclude candidates. Set/confirm a manual origin; optionally grant foreground location; test nearest queries and Clear origin.
5. Inspect BonChon details/menu and source disclosure with large text, landscape, screen reader and Android Back. No unsupported item prices or mall-as-restaurant hours should appear.
6. Interrupt/resume a model download, reuse a verified artifact, Use/Retry, cancel inference, and background/foreground the app. Observe thermal recovery through ordinary use; do not induce overheating. Missing/warm/failed AI must leave deterministic discovery available.

Actual phone rendering, accessibility, memory/thermal behavior, real inference and network recovery remain untested by the agent. No phone, USB or ADB was used. Existing internal-preview/public-distribution restrictions remain.
