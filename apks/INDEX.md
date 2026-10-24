# Standalone APK deliveries

The highest numeric filename prefix is the latest delivery. Preserve older files. Filenames contain a six-digit sequence, app version, ABI, build variant, delivery time in UTC and source commit. Delivery time can differ from compilation time. Future deliveries increment the highest existing sequence and include a SHA-256 sidecar. APK binaries are local artifacts ignored by Git; this index and checksums are tracked source metadata.

## 000014 — navigation with verified landscape correction

File: [000014_omni-bgc_v0.5.0_arm64_release_20261024T195917Z_07866bf.apk](000014_omni-bgc_v0.5.0_arm64_release_20261024T195917Z_07866bf.apk) · [SHA-256 receipt](000014_omni-bgc_v0.5.0_arm64_release_20261024T195917Z_07866bf.apk.sha256) · [Verification receipt](000014_omni-bgc_v0.5.0_arm64_release_20261024T195917Z_07866bf.apk.verification.json)

- Source `07866bf1e118a38eee28ff1937776fc87955d095` **dirty**: offline navigation contracts/engine/controller, map selection/pins/controls, place Directions, landscape layout correction, plus concurrent M14 AI/preview/release-tooling inputs. Candidate pedestrian/corner graphs are retained for review and are not installed or bundled as approved guidance. Detailed paths/digests are in the verification receipt.
- Version 0.5.0/code 4; package `com.omnibgc.preview`; ARM64; minSdk 26/targetSdk 36. Size **71,943,438 bytes**; SHA-256 `7d3119ce5624bfb0131530dd31d75f9d9bb1089e7a5fa4d791be272d305636fe`; delivered UTC `20261024T195917Z`. Non-debuggable release with retained test signer `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Existing deliveries preserved; not production-signing certification.
- Expo-generated native project; authorized Gradle ARM64 release passed in 48s (702 tasks, 14 executed). TypeScript/ESLint and focused navigation/routing/map/origin checks passed. Exact final Hermes **4,969,396 bytes**, all 105 current app sources, 19 ARM64 libraries, both original map packs/all 24 resources, 648,241-byte context, 24 preview media files, package/permissions/signature and ZIP CRC verified. No weights bundled. Installed base.apk hash matches this delivery.
- Owner-approved data-preserving update installed on POCO/Xiaomi 2311DRK48G/Android 16. Landscape endpoint/status/toolbar correction, manual flows, marker selection, offline map/search, enlarged text and retained Qwen1.7 readiness verified; original phone settings restored. Location remained denied and no GPS fix acquired. **No approved walking pack exists**, so real route geometry/instructions and street accuracy remain unaccepted. [Device report](../docs/navigation-device-validation.md) distinguishes observed phone checks from host-only routing fixtures and other limits.

## 000013 — initial navigation interface, superseded by 000014

File: [000013_omni-bgc_v0.5.0_arm64_release_20261024T195154Z_07866bf.apk](000013_omni-bgc_v0.5.0_arm64_release_20261024T195154Z_07866bf.apk) · [SHA-256 receipt](000013_omni-bgc_v0.5.0_arm64_release_20261024T195154Z_07866bf.apk.sha256) · [Verification receipt](000013_omni-bgc_v0.5.0_arm64_release_20261024T195154Z_07866bf.apk.verification.json)

- Source `07866bf1e118a38eee28ff1937776fc87955d095` **dirty**, including initial navigation endpoint/engine/UI integration and concurrent M14 inputs. Version 0.5.0/code 4, package `com.omnibgc.preview`, ARM64, minSdk 26/targetSdk 36; retained test signer as above. Size **71,943,418 bytes**; SHA-256 `8d5f799e56bce0506164b93363f943b92967d04d4067fc9ad59d7a8cb41e62c9`; delivered UTC `20261024T195154Z`.
- Authorized Expo/Gradle release passed in 4m 4s (702 tasks). Signing/package/permissions, exact generated Hermes **4,969,376 bytes**/105 app sources, 19 ARM64 libraries, original offline resources, preview media and ZIP CRC verified. Installed as an update without clearing data. Both endpoint orders, drag/confirm/cancel/Back, search Directions, permission-denied fallback, repeated style changes and foreground restoration passed.
- Phone testing found landscape navigation obscured upper map tools and clipped status. Retained as an intermediate artifact; use **000014** for the verified correction. No approved walking graph or verified entrance connectors are present. Real guidance remains unavailable; no production/device route-accuracy claim.

## 000012 — final detail-card scrolling and restored-notice cleanup

File: [000012_omni-bgc_v0.5.0_arm64_release_20261024T101025Z_02925c4.apk](000012_omni-bgc_v0.5.0_arm64_release_20261024T101025Z_02925c4.apk) · [SHA-256 receipt](000012_omni-bgc_v0.5.0_arm64_release_20261024T101025Z_02925c4.apk.sha256)

- Retains000011 query-focused game-menu cards and000010 model/tool fixes. Source `02925c4a77caf627d1989cf8a48845bb8dc5495c` **dirty**, including all documented uncommitted offline preview/map/model/chat inputs. This iteration waits for the native resized card layout before scrolling and reveals the latest reply when returning from Models. A second historical candidate-notice variant is hidden without deleting stored messages.
- Version0.5.0/code4, package `com.omnibgc.preview`, ARM64, minSdk26/targetSdk36; non-debuggable release, same retained test signer SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Size **71,888,478 bytes**; SHA-256 `12164a694e7e3b6b33f0bbf6bba371595cf4907b92864f94fea1b034d471413c`; delivered UTC `20261024T101025Z`. Previous APKs retained; update without uninstalling. Release uses the test signer and is not production certification.
- Standard Expo-generated Android/Gradle assembleRelease passed in1m7s (702 tasks;14 executed/688 up-to-date). TypeScript/full ESLint, history/detail/source/agent/preview checks and diff whitespace passed. Exact generated Hermes (4,914,436 bytes)/101 current app sources,19 ARM64 libraries,24 original resources,648,241-byte context, ZIP CRC, signature and manifest verified. No model weights bundled.
- Owner-authorized update installed. Returning from Models now displayed the latest Ramen Nagi FLOOR card with the explicit missing-floor value in the viewport. Earlier portrait floor and full-address/description cards were visually inspected. Qwen1.7 remains verified/active; new and restored source/freshness and branch-price notices are hidden. A keyboard-autocorrected QA draft was detected before submission and removed; it was not used as model-quality evidence. Complex CPU inference remains roughly40–80s in observed cases; broad menu matching can include accompanying dishes. Details and limitations: [device report](../docs/device-validation-v050.md).

## 000011 — query-focused game-menu detail answers

File: [000011_omni-bgc_v0.5.0_arm64_release_20261024T100038Z_02925c4.apk](000011_omni-bgc_v0.5.0_arm64_release_20261024T100038Z_02925c4.apk) · [SHA-256 receipt](000011_omni-bgc_v0.5.0_arm64_release_20261024T100038Z_02925c4.apk.sha256)

- Source `02925c4a77caf627d1989cf8a48845bb8dc5495c` **dirty**. Retains000010 offline preview/map/model/tool fixes and adds query-selected floor/location/description/category/overview cards, recorded office addresses, compact item price/description rows, framed hours, bounded historical description snapshots, exact named-field routing and hidden repeated branch-price/availability notices in new/restored chat. No data records, coordinate, model, source validation or native ownership gates were weakened.
- Package `com.omnibgc.preview`, version0.5.0/code4, ARM64, minSdk26/targetSdk36; non-debuggable release with the same retained test signer SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Size **71,888,378 bytes**, SHA-256 `6016c78f8a7240cb0871bacff54a885cd868900c89986e782f54c5914b63020f`, UTC `20261024T100038Z`. Earlier APKs retained. Model weights are separate and were not modified.
- Build: standard Expo-generated Android project and Gradle `:app:assembleRelease` passed in1m8s (702 tasks;14 executed/688 up-to-date). TypeScript/full ESLint, history schema/snapshot/field/notice checks, agent/context/ordinal/strict-source, preview-AI and map-result regressions passed. ZIP CRC, signature, package, exact generated Hermes (4,914,336 bytes)/101 current app sources,19 ARM64 libraries,24 original map resources and648,241-byte context verified.
- Phone update installed without uninstalling. Portrait floor card showed Formica Philippines14F Unit1401; final overview showed the recorded full address and description with wrapping, image, detail-opening and map buttons. Source/freshness and retired branch-price notices were absent from restored replies. The separate Qwen1.7 real-tool cases are documented with limits in [the device report](../docs/device-validation-v050.md); compound CPU inference remains slow. This is a test-signed preview, not broad model quality or production certification.

## 000010 — local tool completion and clean chat replies

File: [000010_omni-bgc_v0.5.0_arm64_release_20261024T093732Z_02925c4.apk](000010_omni-bgc_v0.5.0_arm64_release_20261024T093732Z_02925c4.apk) · [SHA-256 receipt](000010_omni-bgc_v0.5.0_arm64_release_20261024T093732Z_02925c4.apk.sha256)

- Source `02925c4a77caf627d1989cf8a48845bb8dc5495c` **dirty**. Includes the completed offline preview data/media, existing map/model/portrait changes, native recursive numeric argument conversion, fresh-request context isolation, compact result identities, preview-first tool guidance, a finite 90-second/two-round/four-call agent budget, menu-history metadata compatibility and hidden source/freshness controls in chat. Source checks, attribution, both original map packs, strict approved-only queries and model ownership/cancellation remain intact.
- Package `com.omnibgc.preview`, version 0.5.0/code 4, ARM64, minSdk 26/targetSdk 36; non-debuggable release, same retained test signer SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Size **71,883,870 bytes**, SHA-256 `a8bcfb4b79db671cc0413c466c5a7e23c45160e1dc0672e8e59ec0c3f367312e`, UTC `20261024T093732Z`. All previous APKs retained; update without uninstalling.
- Build: Expo-generated native Android project, Gradle `:app:assembleRelease` passed in 1m 29s (702 tasks;14 executed/688 up-to-date). TypeScript/full ESLint, real cached LiteRT-LM numeric/transcript codec, agent context/ordinal/strict-source regressions, menu-history, preview AI/data/presentation and existing model/source checks passed. ZIP CRC, signature, manifest, exact generated Hermes (4,909,828 bytes)/99 current app sources,19 ARM64 libraries,24 original resources and648,241-byte context verified. No model weights bundled.
- Owner-authorized phone update succeeded with downloaded Qwen3 1.7B retained. The original coffee request now returns grounded records (~67s); search plus map focus actually executed and opened Formica Philippines (~78s, same native/agent code before the final presentation-only update). Restored chat source/freshness controls are hidden in the final build. The source metadata remains stored and available in place details. Small-model intent coverage is limited to observed cases, and CPU multi-round generation is slow; the fixed deadline is90s. See [device report](../docs/device-validation-v050.md).

## 000009 — Qwen1.7 activation and portrait typing delivery

File: [000009_omni-bgc_v0.5.0_arm64_release_20261024T041043Z_02925c4.apk](000009_omni-bgc_v0.5.0_arm64_release_20261024T041043Z_02925c4.apk) · [SHA-256 receipt](000009_omni-bgc_v0.5.0_arm64_release_20261024T041043Z_02925c4.apk.sha256)

- Source `02925c4a77caf627d1989cf8a48845bb8dc5495c` **dirty**. Retains 000008 changes. Startup probe now explicitly asks in the user message to call once and return the token; the tool response contains only token data. The unchanged gate still requires a valid native tool proposal, fresh returned nonce, no extra tool call and native idle/release. Synthetic diagnostics removed. No OS thermal override, uninstall, data clear, reboot, push or publication.
- Package `com.omnibgc.preview`, version 0.5.0/code 4, ARM64, minSdk 26/targetSdk 36; non-debuggable release, backup disabled and blocked permissions absent. Same verified debug/test signer `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Size **67,826,109 bytes**, SHA-256 `07b7b73e81b34ddb704050dd179f0dc194f449f58144aa0e9a7882b00d1c9417`, UTC `20261024T041043Z`. All older deliveries preserved.
- Build: standard Expo-generated native project and Gradle `:app:assembleRelease` passed in 1m 5s (702 tasks;14 executed/688 up-to-date). TypeScript/full lint, model protocol/context/ownership, agent and regression checks passed. Exact generated Hermes2,781,180bytes/all 95 current app inputs, 19 ARM64 libraries, both original packs/all 24 resources and 648,241-byte context verified; model weights absent. ZIP/signature/manifest checks passed.
- Phone: owner-requested Qwen3 1.7B (977,184,032bytes, pinned SHA-256 `2a72330b504a6596d53a2c00923c57173b10f1b83e6a541213ffec08d1fc5de8`) downloaded and verified separately, passed native text/tool-call/tool-result activation and displayed Ready to chat/in use. After successful1.7 verification, the owner requested and confirmed removal of the downloaded0.6B; its Models status was reinspected as Not installed yet. Qwen1.7 was reloaded afterward. Portrait typed text/Send remain above the keyboard. Broader query quality/performance is limited to observed cases; see [device report](../docs/device-validation-v050.md).

## 000008 — portrait chat keyboard correction

File: [000008_omni-bgc_v0.5.0_arm64_release_20261024T035800Z_02925c4.apk](000008_omni-bgc_v0.5.0_arm64_release_20261024T035800Z_02925c4.apk) · [SHA-256 receipt](000008_omni-bgc_v0.5.0_arm64_release_20261024T035800Z_02925c4.apk.sha256)

- Source `02925c4a77caf627d1989cf8a48845bb8dc5495c` **dirty**. Retains 000007 map/model/tool changes; chat now reserves keyboard overlap using padding instead of a cached height or relying solely on Android edge-to-edge adjustResize. Casual model turns exclude unrelated lookup history/reference observations. The temporary synthetic hello diagnostic is removed. One Android input flag prevents full-screen editing; further landscape acceptance was explicitly excluded by the owner.
- Package `com.omnibgc.preview`, version 0.5.0/code 4, ARM64, minSdk 26/targetSdk 36; non-debuggable release, backup disabled. Same retained test signer. Size **67,826,401 bytes**, SHA-256 `e7e902955340627c190f86f0d8a709d1ab2d6a1672df897e64e946eb4f57f9e5`, delivery UTC `20261024T035800Z`. Existing APKs retained.
- Build: standard Expo-generated Android project and Gradle `:app:assembleRelease` passed in 1m 2s (702 tasks,14 executed/688 up-to-date). TypeScript, full ESLint, agent/context/model/pager regressions and diff whitespace passed.
- Binary: ZIP CRC, signing, final Hermes2,781,472bytes/all 95 current app sources, 19 ARM64 libraries, both original manifests/all 24 resources,648,241-byte source-backed context verified; no model weights bundled. Native model checksum/ownership/cancel/release fences retained.
- Phone: owner-reported portrait overlap reproduced (input bottom2534px behind keyboard top1838px); corrected input and Send bottom1802px, above keyboard top1838px, with test text visible. Existing conversations and downloaded models retained. Qwen1.7 download/activation is owner-requested and being validated; final outcomes in [device report](../docs/device-validation-v050.md). No uninstall, app-data clear, reboot, push or publication.

## 000007 — model activation and tool-result compatibility iteration

File: [000007_omni-bgc_v0.5.0_arm64_release_20261023T131225Z_02925c4.apk](000007_omni-bgc_v0.5.0_arm64_release_20261023T131225Z_02925c4.apk) · [SHA-256 receipt](000007_omni-bgc_v0.5.0_arm64_release_20261023T131225Z_02925c4.apk.sha256)

- Source `02925c4a77caf627d1989cf8a48845bb8dc5495c` **dirty**. Includes the changes recorded in 000006 plus explicit owner-requested removal of the app thermal veto, exact-Qwen0.6 SHA-bound tool-response text compatibility within the TOOL role, Android keyboard-resize ownership, interrupted pager handling, corrected native road interpolation, active-model greeting routing, compound request preservation and broader coffee-adapter deferral. No Android thermal override or system-protection change; no push or publication.
- Package `com.omnibgc.preview`, version 0.5.0/code 4, ARM64, minSdk 26/targetSdk 36, non-debuggable release with backup disabled. Same debug/test signer `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Size **67,826,325bytes**, SHA-256 `68f2a190f9bc615431ac5fd315299f28844c1a14a8720e1e6073d0a4fa3aa981`, delivery UTC `20261023T131225Z`. Older binaries preserved.
- Build/host checks: Expo-generated native project, Gradle release succeeded; TypeScript/full lint and focused agent/model/codec/pager/map checks passed. Exact generated Hermes2,781,396bytes, all 95 app source-map inputs, 19 ARM64 libraries, both original packs/all 24 files and 648,241-byte context verified; no weights bundled. ZIP/signing/package checks passed.
- Actual phone: Qwen0.6 passed native text, parsed tool call and fresh tool-result nonce; Models showed Ready to chat. Verified active model survives update; native casual generation completed. Keyboard-close/rotation composer check passed. Normal hello and some contextual requests still produce an unhelpful filtered fallback; this is an intermediate test build, not broad chat/tool-quality acceptance. See [device evidence](../docs/device-validation-v050.md).

## 000006 — device-tested map, models and response refinement

File: [000006_omni-bgc_v0.5.0_arm64_release_20261023T123854Z_02925c4.apk](000006_omni-bgc_v0.5.0_arm64_release_20261023T123854Z_02925c4.apk) · [SHA-256 receipt](000006_omni-bgc_v0.5.0_arm64_release_20261023T123854Z_02925c4.apk.sha256)

- Source: `02925c4a77caf627d1989cf8a48845bb8dc5495c` **dirty**. Uncommitted build inputs: versionCode 4; stable MapLibre Layer keys; modern city palette; asymmetric +150m coverage/context; coffee discovery and strict floor-label corrections; game-style response cards, colored emphasis and removed internal review narration (also hidden in restored chat); initial thermal readiness; Qwen-only catalog, safe Gemma pointer retirement and model-specific import/finalization. No clean-commit attribution, push or publication.
- Package/label: `com.omnibgc.preview` / `The Fort`; version `0.5.0`, versionCode `4`; ARM64; minSdk 26/targetSdk 36; release, not debuggable, backup disabled and blocked permissions absent.
- Size: **67,827,005 bytes**. SHA-256: `cdb7e1a472159d7fa93c31f69c75519267333e29f13b4288f9f2d51c48b5cd9b`. UTC delivery `20261023T123854Z`. Existing deliveries retained.
- Build: standard Expo Android prebuild and Gradle `:app:assembleRelease`, JDK21. Expanded build passed in 3m 52s (702 tasks); final answer-cleanup build passed in 1m 13s (14 executed/688 up-to-date). Dependency deprecation warnings remain non-fatal.
- Host validation: TypeScript/full ESLint, actual installed MapLibre child-identity regression, map modes/resources/results/origin, metric asymmetric coverage/context lineage/reproducibility, discovery/floor/source/price/history, model migration/activation/storage/retries and bounded-agent regressions passed. Independent targeted review found no remaining blocker.
- Binary verification: ZIP CRC; exact generated Hermes (2,782,076 bytes); all 95 bundled application sources match; 19 ARM64 libraries including MapLibre/LiteRT/Hermes; both original map manifests/all 24 resources unchanged. New context 648,241 bytes SHA-256 `927a4da19e634b2e02f5d5278bcff9bc90cce88a82e91c9225b06cd0adfefb73`. No model weights bundled.
- Signing: signature verification passed; same debug/test certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Release describes the build variant, not production signing.
- Actual authorized POCO 2311DRK48G / Android 16 checks: update installation retained conversation and verified Qwen; ten map switches kept one PID; modern map render/pan/double-tap/reset; coffee discovery and price gating; manual map position/clear and denied optional permission; large text; Qwen-only Models/cooling state; final offline cold launch/map/coffee response and removed notice. Original phone settings restored. Details/limits: [device report](../docs/device-validation-v050.md).
- Limits: local inference/tool quality remains blocked by Android severe framework status despite normal live HAL. Owner declined reboot; no bypass. Full screen-reader, physical pinch and exhaustive boundary/thermal/performance acceptance remain unproven. Gemma files remain on disk; only selection/download/activation and saved pointers were retired. Update installed app without uninstalling; no Metro required.

## 000005 — The Fort v0.5.0 integration build

File: [000005_omni-bgc_v0.5.0_arm64_release_20261023T070054Z_a8e1546.apk](000005_omni-bgc_v0.5.0_arm64_release_20261023T070054Z_a8e1546.apk) · [SHA-256 receipt](000005_omni-bgc_v0.5.0_arm64_release_20261023T070054Z_a8e1546.apk.sha256)

- Source: `a8e15465ca356b1c527144c741d97f0ce91a079c` **dirty**, branch `codex/the-fort-v050`. Uncommitted build inputs include controlled map style/render/camera lifecycle and recovery, independent illustrated/flat styling, unnumbered category clusters and shared result highlights, buffered coverage/context resources, current-source Assistant map selection and pack-refresh invalidation, foreground map position controls, supported building IDs, local model catalog/selection/activation protocol, branding/detail UI and version configuration. This is not a clean-commit build.
- Package/label: `com.omnibgc.preview` / `The Fort`; version `0.5.0`, versionCode `3`; ARM64 (`arm64-v8a`); minSdk `26`, targetSdk `36`; release variant, not debuggable; backup disabled. Existing blocked permissions remain absent.
- Size: **67,489,481 bytes**; SHA-256: `c17ef9e3ac3e60e212394a79459dd67605ea790855a9eca1eafba4174bafc438`. Delivery time (UTC): `20261023T070054Z`. Earlier APKs and receipts are preserved.
- Build: clean standard Expo Android prebuild, then Gradle `:app:assembleRelease` succeeded in 4m 39s; 702 tasks (670 executed, 32 up-to-date), JDK 21 and installed Android SDK. Gradle/dependency deprecation and metaspace warnings did not fail the build.
- Host checks: TypeScript and ESLint passed with no warnings/errors. Focused map transition/recovery, style-spec, resource integrity, 100m projected coverage, context lineage, result ID/current-source resolution and refresh revocation, supported building IDs, discovery/strict price policy, food presentation, history, model activation/recovery and transfer retries passed. Native/model/storage fixtures are host fakes, not device acceptance. Independent review's stale overlay and fallback-camera findings were fixed and regression-checked.
- Binary verification: ZIP CRC, final generated Hermes equality (2,772,060 bytes), all 94 bundled application source-map entries match current source, 19 ARM64 native libraries including MapLibre/LiteRT-LM/Hermes, both original map manifests/all 24 resource files and 317,964-byte buffered context verified. Context SHA-256: `f3cec59cfe49a41c808407226db0f62081564401ef67d38ca0d56924de7ee1a3`. Model weights are absent.
- Signing: APK Signature Scheme v2 verifies; certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` matches the actual 000004 APK. This is the retained debug/test signer; release denotes the Gradle variant, not production signing.
- Installation: transfer to a compatible ARM64 Android 8+ phone, open and update the existing installation without uninstalling. No Metro required. Matching package/signer and increased versionCode support upgrading; actual upgrade/data preservation remains owner testing. Model downloads remain separate and optional. Internal-preview/data-distribution restrictions remain.
- Limits: original native crash root cause and repeated-toggle acceptance, visual/Haki fidelity, exact screenshot boundary reconciliation, frame pacing, accessibility, real Qwen/Gemma generation/tool round trip and thermal behavior are not device-validated. Qwen0.6 may fail its embedded-template round-trip gate; its verified file and previous active model remain recoverable. No model recommendation/default promotion or new approved directory/pack data is claimed. No phone/USB/ADB, remote push or publication. See [v0.5.0 handoff](../docs/v0.5.0-handoff.md).

## 000004 — map, discovery, restaurant UI and model recovery refinement

File: [000004_omni-bgc_v0.4.0_arm64_release_20261021T024556Z_b7a3b67.apk](000004_omni-bgc_v0.4.0_arm64_release_20261021T024556Z_b7a3b67.apk) · [SHA-256 receipt](000004_omni-bgc_v0.4.0_arm64_release_20261021T024556Z_b7a3b67.apk.sha256)

- Source commit: `b7a3b672f1f7759443d7dcfbe6c96c9496cbbc79` **dirty** on local branch `codex/offline-explorer-refinement`. Build-input changes include the preserved icon-padding launch fix; additive sourced/tiled context and resource installer; consistent solid building styling; clustered filtered POIs and accessible More; shared deterministic discovery, candidate/source restrictions, origin and sorting; Thinking Machines building reference; compact menu/hour presentation; and model artifact/runtime state, bounded download resumption and native thermal notifications. No clean-commit attribution is claimed.
- Package/label: `com.omnibgc.preview` / `The Fort`; version `0.4.0`, versionCode `2`; ABI `arm64-v8a`; minSdk `26`, targetSdk `36`; variant `release`, not debuggable; backup remains disabled.
- Byte size: `75,619,165`; SHA-256: `df9d3e2751f03fc19f8657a5c916332232bfe67472378bbf45fde20feced622b`. Delivered `2026-10-21T02:45:56Z`. Older deliveries are preserved.
- Host validation: TypeScript passed. Full lint passed with zero errors and two pre-existing MapCanvas hook-dependency warnings; affected-path lint also passed. Existing regressions/history/map checks and focused discovery, restaurant price/hours, model lifecycle, actual mocked storage retry, confirmed-origin and context geometry/lineage checks passed. Native/storage test boundaries are fakes, not device evidence.
- Build: standard Expo Android prebuild and Gradle `:app:assembleRelease` succeeded in 5m 33s (702 tasks; 692 executed, 10 up-to-date), using the installed JDK 21 and Android SDK. No extra model/backend/runtime was introduced.
- APK verification: ZIP CRC, final generated Hermes bundle equality (`2,743,756` bytes), final source-map correspondence for routing/directory/map/model UI, 19 ARM64 native libraries including LiteRT/MapLibre/Hermes, both original packs and all 24 original offline resource files, and additive `8,714,956`-byte context archive verified. Context SHA-256: `99285996481ae6b615906fbf8393baf7d38e602747f2ff088a49b1636b81c933`. Unused facade PNGs remain in source and are no longer registered as runtime textures; original pack sprites are unchanged. Model weights are absent.
- Signing: APK Signature Scheme v2 verified, same debug/test certificate as delivery 000003: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Release is the build variant, not production-signing certification. Existing blocked permissions remain absent.
- Installation: update the existing compatible ARM64 Android installation without uninstalling to retain local data. Model files remain separately acquired and verified. Internal-preview/data-distribution restrictions remain in force.
- Limits: owner phone acceptance is pending for visual quality, frame pacing, memory/thermal behavior, real inference, accessibility and actual transfer recovery. No phone, USB, ADB, push or publication was used. See the [handoff](../docs/THE-FORT-HANDOFF.md).

## 000003 — current manual-test APK: MapLibre launch-crash fix

File: [000003_omni-bgc_v0.4.0_arm64_release_20261021T011539Z_b7a3b67.apk](000003_omni-bgc_v0.4.0_arm64_release_20261021T011539Z_b7a3b67.apk) · [SHA-256 receipt](000003_omni-bgc_v0.4.0_arm64_release_20261021T011539Z_b7a3b67.apk.sha256)

- Source commit: `b7a3b672f1f7759443d7dcfbe6c96c9496cbbc79` **dirty**. The prior The Fort implementation is in this base commit. Uncommitted build-input change: removal of the scalar `icon-padding` override from the React Native important-place layer. MapLibre RN 11.5.0 Android expects an array at that bridge setter. Native default collision padding is now used; map packs, topology and source records are unchanged. The focused regression and handoff were updated.
- Package/label: `com.omnibgc.preview` / `The Fort`; version `0.4.0`, versionCode `2` retained; ABI `arm64-v8a`; Android API 26+; variant `release`, not debuggable. This new delivery sequence distinguishes the corrected build.
- Size: `70,422,827` bytes. Delivered: `2026-10-21T01:15:39Z`.
- SHA-256: `f3e7b516c14ab4275cd5e2d59fb7bc3b10b096b5f8106dbb47ec82cc26ea334a`.
- Host checks: bridge regression observed failing on scalar padding and passing after removal; map resource integrity, TypeScript, focused map lint (zero errors, two pre-existing hook warnings), diff whitespace, Expo prebuild and Gradle `:app:assembleRelease` passed. Release build: 702 tasks, 670 executed, 32 up-to-date. Release source map confirms the exact corrected MapCanvas input; APK bundle matches generated Hermes bytes.
- APK verification: ZIP CRC; 6,148,676-byte JS bundle; 19 ARM64 native libraries including LiteRT, MapLibre and Hermes; both original map manifests and all 24 resource files match receipts; all ten facade textures match decoded source pixels; model weights absent. Package/version/ABI/minSdk/label and blocked permissions verified.
- Signing: APK v2 verified; same debug/test certificate as 000002 (`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`). Release variant is not production signing certification. Intended as an update of the existing installation; preserve local data by avoiding an uninstall.
- No device, USB, ADB, push or publication was used. Owner must verify actual launch/map rendering and the remaining manual checks in the [handoff](../docs/THE-FORT-HANDOFF.md). This is a host-verified correction of the supplied native type mismatch, not physical-device acceptance.

## 000002 — superseded: reported map launch crash

**Use 000003 or later.** The owner reported an Android launch crash caused by the scalar React Native icon-padding override. This file is preserved for artifact history.

File: [000002_omni-bgc_v0.4.0_arm64_release_20261021T004409Z_e0cd3f3.apk](000002_omni-bgc_v0.4.0_arm64_release_20261021T004409Z_e0cd3f3.apk) · [SHA-256 receipt](000002_omni-bgc_v0.4.0_arm64_release_20261021T004409Z_e0cd3f3.apk.sha256)

- Source commit: `e0cd3f371d2050d9ae7583ab8d8999c69699846b` **dirty**. This APK includes uncommitted build-input changes: model activation/recovery and native-load timeout ownership; hybrid routing/tool observations and branch scope; strict conversation display persistence; shared dialogs, menu modals and chat UI; The Fort branding/config/version; additive sourced offline context, map styling and original facade assets. Native Android output was generated through Expo prebuild. No clean-commit attribution is claimed.
- Package: `com.omnibgc.preview`; label: `The Fort`; version: `0.4.0`; versionCode: `2`.
- ABI: `arm64-v8a`; minimum Android API: `26` (Android 8); variant: `release`; manifest is not debuggable.
- Size: `70,422,831` bytes. Delivered: `2026-10-21T00:44:09Z`.
- SHA-256: `6001ad29d0769c858183b5659feaeace0296cadb9f0c01a66f012dabf74aff4e`.
- Build: standard Expo Android prebuild and Gradle `:app:assembleRelease`, ARM64 only. Final hybrid build succeeded (702 tasks; 14 executed, 688 up-to-date). Host checks passed: TypeScript; lint with zero errors/two existing MapCanvas hook warnings; focused AI/hybrid/history/map regressions and source/resource integrity; diff whitespace.
- APK verification: ZIP CRC; embedded final hybrid/context/brand JavaScript (6,148,680 bytes); 19 ARM64 native libraries including LiteRT JNI, MapLibre and Hermes; all 24 resource files and both manifests of the original offline packs match source receipts; all ten facade textures match decoded source pixels; model weights absent. Package/version/label/ABI/minSdk and blocked-permission checks passed.
- Signing: APK v2 verified; same Android debug/test certificate as delivery 000001. Certificate SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Release is the Gradle variant, **not production signing certification**.
- Installation: transfer to a compatible ARM64 Android phone and open the APK; no Metro is needed. Matching signer/package supports an update while retaining app data. Do not uninstall casually if Android rejects an update, because uninstall removes local data. Model weights remain a separate verified download; deterministic tools work without them. Existing production restrictions remain.
- Physical-device install/runtime, real Gemma inference, memory/thermal behavior, map rendering/performance and accessibility remain owner manual acceptance. No phone, USB, ADB, push or publication was used. See [handoff](../docs/THE-FORT-HANDOFF.md), [hybrid capability matrix](../docs/AI-CAPABILITIES.md) and [coverage limits](../docs/map-coverage.md).

## 000001 — previous manual-test APK

File: [000001_omni-bgc_v0.3.1_arm64_release_20261019T025139Z_64c92c2.apk](000001_omni-bgc_v0.3.1_arm64_release_20261019T025139Z_64c92c2.apk)

- Source commit: `64c92c2dec5c53cd28c5c2908b90c08bdf6b5f89` (clean, completed app-only refactor).
- Package: `com.omnibgc.preview`; app version: `0.3.1`.
- ABI: `arm64-v8a` (64-bit ARM Android phones); variant: `release`.
- Size: `67,084,311` bytes.
- SHA-256: `6602a0d57db770507c669e1a4ec9d1a6d09cc8bd7ea5a706c7682f15e66587aa`.
- Delivered: `2026-10-19T02:51:39Z`. Copied byte-for-byte from the existing host-verified final APK; no rebuild was needed for documentation/reference-only changes.
- Host evidence: clean-clone Expo/Gradle release build; embedded JS bundle and ARM64 native libraries; retained offline map/font assets; package/version/permissions and signer parity with the baseline. On delivery, SHA-256 and ZIP bundle/ABI checks passed again.
- Manual installation: transfer this APK to an ARM64 Android phone and open it, allowing installation from that transfer app when Android prompts. No Metro server is needed. This is a signed preview/test artifact, not production-signing certification. An installed app with a different signer may reject an update; do not uninstall it casually because that removes local app data.
- Map resources are bundled. AI model weights are not bundled; AI requires a separately acquired, verified supported model. Existing production feature restrictions remain.
- Physical-device install/runtime, offline smoke, real-model inference, performance and accessibility acceptance are pending the owner's manual testing. No device, USB or ADB operation was performed.

## Rebuild when application inputs change

With the existing JDK/Android SDK configured, from the repository root:

```powershell
npm ci
npm run typecheck
npm run lint
npx --no-install expo prebuild --platform android --clean --no-install
Push-Location android
try {
  .\gradlew.bat :app:assembleRelease --no-daemon --max-workers 2 '-PreactNativeArchitectures=arm64-v8a' '-Pkotlin.compiler.execution.strategy=in-process'
  if ($LASTEXITCODE -ne 0) { throw 'Android release build failed' }
} finally {
  Pop-Location
}
```

The standard output is `android/app/build/outputs/apk/release/app-release.apk`. Verify it, then copy it into this directory using the next sequence and update this index and its checksum sidecar. Follow the artifact rules in the root `AGENTS.md`; never relabel an older APK as if it contains new application changes.
