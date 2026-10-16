# M9 Android host build evidence

Native/build owner report; parent acceptance is separate. Updated 2026-10-16 (Asia/Manila).

## Build method

`scripts/build-offline-ai-host.py` creates a fresh ignored `.g/ai-host-*` source/dependency tree, performs Expo CNG only there, assembles an ARM64 internal R8 release entirely offline, runs native ownership unit tests, and audits the APK. It never invokes ADB or connects to a phone. `OMNI_AI_PREVIEW=1` selects `com.omnibgc.aipreview`; default app identifiers remain unchanged.

The freeze binds the build script, app/native/plugin/source assets, approved map receipts, AI tests/helpers, architecture/evaluation docs and repository instructions. It records the base Git HEAD, exact source hashes, source archive, and 584 installed dependency manifest/version/integrity/resolved identities against the pinned npm lock (10 optional packages absent). Initial/end dependency metadata must agree. Full npm file contents are trusted from the parent's explicit offline `npm ci --ignore-scripts`; they are not independently reconstructed from tarball integrity here.

Static acceptance requires the ARM64 LiteRT/MapLibre libraries, kept native runtime and Expo module DEX classes, generated Expo registry reference, embedded current source-map contents, R8 mapping, no model weights, verified internal signature, disabled backup/debug, exact normalized pre-AI permission baseline, checksummed map resources, and no application-source drift after freeze. Generated Gradle/settings/init/registry files and all build/audit logs receive hashes in the final receipt.

## Compiler compatibility repair

Actual typed compilation uses Expo 57.0.27, RN 0.86.3, Expo modules core 57.0.21, Kotlin compiler 2.3.20, AGP 8.12.0, Gradle 9.3.1, SDK/target 36, minSDK 26, NDK 27.1.12297006, JetBrains JDK 21 and the existing Java 17 compilation toolchain.

LiteRT 0.18.0 brings Kotlin reflect 2.4.0. Initial full R8 assembly succeeded but reported metadata parsing errors from the bundled old shrinker. This is not accepted as final compatibility. [Android's official table](https://developer.android.com/build/kotlin-support) requires R8 >=9.1.29 for Kotlin 2.4. The minimum 9.1.29 is available in Google's archive but absent from Google Maven; **9.1.31** is the first published Google Maven stable version meeting that minimum. Exact R8 9.1.31 was resolved and its version reported in `.g/ai-native/r8-resolve-9.1.31.log`.

`withLocalAi.cjs` uses the [upstream documented replacement mechanism](https://r8.googlesource.com/r8/+/refs/heads/main/README.md#replacing-r8-in-android-gradle-plugin) in `settings.gradle`'s `pluginManagement.buildscript`. No Kotlin metadata check, API check or warning suppression was added. R2 real assembly with this compiler produced **zero Kotlin metadata parsing warnings**. It reports that AGP's class-file resource provider lacks asynchronous parsing; this uses the synchronous provider path. Existing dependency deprecations and the host SDK's extra NDK-directory warning remain visible in logs.

## Intermediate builds retained

- **R1:** real full ARM64 R8 release and native unit tests, `BUILD SUCCESSFUL in 6m 2s`, 705 tasks. Older frozen Assistant source and old R8 metadata warnings make this compatibility evidence only.
- **R2:** `.g/ai-host-r2/assemble-release.log`, full offline ARM64 R8 release plus 3 native ownership tests: `BUILD SUCCESSFUL in 6m 21s`, 705 tasks. Native dependency graph succeeds separately in 25s. APK 62,047,450 bytes, SHA256 `ffaaf72817caff43a7daea55618b58ce05dbc3e755e165ad2952e8757036b210`. Static native/registry/DEX/ABI, signature, source-map, map, permission and dependency checks passed. Final verifier correctly rejected application-source drift after the parent's subsequent itinerary-operation repair. **R2 is intermediate only and is not the final handoff APK.**

R2 internal certificate SHA256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`, CN `Android Debug`; no release/distribution authorization is implied.

## Failures recorded

- Sandbox blocked Expo `.expo` image-cache creation; preserved failure log, reran authorized isolated CNG with escalation.
- Earlier automatic approval review failed due account quota. That build was **not executed**; work resumed after quota availability returned.
- R8 9.1.29 Maven resolution failed because the version is not published there. Public release metadata and the documented minimum support the exact 9.1.31 pin instead.
- R2 current-source acceptance failed intentionally and accurately when the parent repaired itinerary semantics after freeze. No stale APK was labeled final.

## Pre-R4 checkpoint (historical)

R3 is also an intermediate build: independent final review identified that manual native tool rounds need structured SDK assistant `ToolCall` metadata and `Content.ToolResponse` data, rather than plain role-tool text. That protocol repair and matching host transcript/budget tests are required before the final R4 source freeze. Final evidence will be appended after actual completion. No model inference, device streaming, device native-idle observation, GPU, RAM/thermal, MapLibre coexistence or airplane-mode acceptance is established by these host builds. All physical activity remains M10.

## Final R4 host artifact (2026-10-16)

**`HOST_COMPILED_STATIC_APK_VERIFIED`**. The complete final source, including structured manual tool calls/responses, compiled and packaged offline with R8 9.1.31: `.g/ai-host-r4/assemble-release.log`, **BUILD SUCCESSFUL in 8m 31s**, 705/705 tasks executed, exit 0. The separate native dependency graph completed in 40s, exit 0. Exact release unit-test XML under `.g/ai-host-r4/apps/mobile/modules/omni-local-ai/android/build/test-results/testReleaseUnitTest/` records **7 tests, 0 failures/errors/skips** (4 ownership and 3 actual SDK message codec tests). The strict receipt/dependency drift suite independently reran **6/6 PASS**.

| Artifact | SHA256 |
| --- | --- |
| `.g/ai-host-r4/Omni-BGC-AI-preview-arm64.apk` (62,063,914 bytes) | `1f5fa8bd0b2cd0b3ec7af5002977f6d5dfdc21a463e3d05c2341e0d88dd9be7e` |
| `.g/ai-host-r4/frozen-source-snapshot.zip` | `4ddc3c2262fe697ac033bee8c352df37b03f9e1a63f8034a69cf3cbfd4051424` |
| `.g/ai-host-r4/source-receipt.json` | `93a002260356fba7963ed8cbff0e9806f18440ae9bfc533fbecbf9db3498ff14` |
| `.g/ai-host-r4/apk-verification.json` | `c87617b428adbda941bba2c3063781fe598f2b1edc8ead73be2b535ee662adbf` |
| Archived R4 build workflow (stage/ZIP) | `f7d95149859f182bb002f00312af8f26f7bebbfae8a3628b98ab7a78b36d4c9f` |

The verifier checked ZIP CRC, ARM64-only libraries including LiteRT and MapLibre, actual retained SDK/module DEX symbols, the generated Expo module registry, seven embedded source-map contents, model exclusion, map resource checksums, SDK 26/36, unchanged normalized permission baseline, disabled backup/debug, R8 mapping, exact LiteRT 0.18.0 graph, and unchanged dependency metadata. All **370 frozen source files** and current application source matched at verification (`source_divergence_since_freeze=[]`, `application_source_divergence_since_freeze=[]`). Subsequent handoff/report edits are documentation only and do not change the compiled application.

The internal package is `com.omnibgc.aipreview`, verified with APK signature scheme v2. Its Android Debug certificate SHA256 is `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. It is an internal test artifact, with no distribution approval. No model weights are bundled. The archive contains the implementation, tests and frozen documentation; restricted resource files remain local and are not published.

The successful R4 log preserves a Gradle warning that its 2 GiB heap / 512 MiB metaspace daemon will expire after the build; no OOM occurred. Existing SDK NDK-directory/deprecation warnings and R8 synchronous-provider warnings remain. There are **zero Kotlin metadata parsing warnings**. The earlier protocol JVM test run failed three tests because SDK classes require Java 21; the module now explicitly uses a Java 21 host unit-test launcher, while Android compilation target remains 17. Exact failure and successful repair logs are recorded in `M1_M3_NATIVE.md`.

Independent final artifact review and parent acceptance are separate gates. This host result establishes compilation, deterministic tests and static packaging only. **`ON_DEVICE_INFERENCE=NOT_RUN_PENDING_M10`; `DEVICE_ACCEPTED=false`; `DISTRIBUTION_AUTHORIZED=false`.** Real Gemma model loading/tool continuation, streaming/cancellation and native idle, observed CPU/GPU behavior, memory/thermal measurements, app UX/screenshots and airplane-mode device operation still require the authorized M10 runbook.

### Explicit receipt size erratum

Parent independent audit found a real metadata defect after the original verifier passed: frozen `apps/mobile/metro.config.js` records the authored **662-byte** size, while the documented staging normalization produced **655 bytes**. The staged file and archived file both match the original frozen SHA256 `0ed9aac2c855b81c50477ecebd272b89284f5c9d93d39d9ad93bba830ef24bae`. No application/source-content or APK mismatch was found. The original workflow calculated the staged SHA but copied the authored size and only enforced SHA during freezing.

The original R4 APK, ZIP, source receipt, verification receipt and archived build workflow remain immutable with the hashes above. Parent authorized a transparent verification-only correction rather than an Android rebuild for this metadata-only field. `scripts/audit-offline-ai-receipt-erratum.py` separately binds those original hashes, independently checks every one of the **370** ZIP/staged source SHA values and actual byte lengths, compares exact current application inventory/content (including additions/deletions), checks original logs/generated evidence/dependencies and the seven native XML test results. It allows only the exact Metro **662 → 655** size correction; no hash/content exception is permitted.

Supplemental `.g/ai-host-r4/receipt-erratum.json` SHA256: `f0de8e76ea76b57398877f0b8621ced05dc2fc56029e6ecd4c74bfc7d8e6d87a`, status **`HOST_STATIC_VERIFIED_WITH_EXPLICIT_RECEIPT_SIZE_ERRATUM`**. Its audit workflow SHA256 is `98a1b0c2714b55acda0d9cce6cd48289251d99ec962d2dcf1291e3e190f77a0b`. The corrected future build workflow SHA256 is `ce2d4c5fddba304692b0614cee104fe61e539c3466fa6f1389930144df5c6d89`; this newer script did **not** build the R4 APK. Future freezes now recalculate staged size and SHA and reject incorrect size metadata. The expanded receipt regression suite passes **8/8**, including normalization and valid-SHA/incorrect-size rejection. The immutable original build's SHA remains `f7d95149859f182bb002f00312af8f26f7bebbfae8a3628b98ab7a78b36d4c9f`.

The original receipt alone is insufficient final evidence because of that disclosed byte-count defect. Final review must consider the immutable original artifacts **together with** the explicit supplemental erratum and independent reviewer verdict. No device, inference or release acceptance is implied.
