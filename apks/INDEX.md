# Standalone APK deliveries

The highest numeric filename prefix is the latest delivery. Preserve older files. Filenames contain a six-digit sequence, app version, ABI, build variant, delivery time in UTC and source commit. Delivery time can differ from compilation time. Future deliveries increment the highest existing sequence and include a SHA-256 sidecar. APK binaries are local artifacts ignored by Git; this index and checksums are tracked source metadata.

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
