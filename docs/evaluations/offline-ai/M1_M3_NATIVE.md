# M1/M3 typed native bridge and provider — host evidence

Owner: native integration specialist; parent acceptance is separate. Date: 2026-10-15, Asia/Manila.

## Scope and success criteria

Fresh typed Expo local module in `apps/mobile/modules/omni-local-ai`, public TypeScript contracts/provider/coordinator in `apps/mobile/src/ai`. Compile against actual LiteRT-LM 0.18.0, preserve one native owner and model-file lease, stream actual callback chunks, disable automatic native tool execution, and deny reuse/deletion when cancellation or cleanup cannot prove native idle. No ADB, USB, device install, model weights download or model inference was performed.

## Verified upstream and toolchain

- [Pinned upstream Kotlin API](https://github.com/google-ai-edge/LiteRT-LM/tree/v0.18.0/kotlin/java/com/google/ai/edge/litertlm): typed `Engine`, `EngineConfig`, `ConversationConfig`, `MessageCallback`, `OpenApiTool`, `cancelProcess`, `getTokenCount`, conversation/engine `close`. `MessageCallback.onMessage` explicitly describes message chunks; native bridge therefore labels output `mode: delta`. Actual POCO callback behavior remains an M10 test.
- [Published Maven POM](https://dl.google.com/dl/android/maven2/com/google/ai/edge/litertlm/litertlm-android/0.18.0/litertlm-android-0.18.0.pom): Gson 2.14.0, Kotlin reflect 2.4.0, coroutines Android 1.11.0. AAR: 20,905,807 bytes, SHA256 `706cbb8a87739b2818111bf3a19a78b8f7781586d10f80adf3415581fab7595f`; contains `arm64-v8a` and `x86_64` `liblitertlm_jni.so`, no consumer ProGuard rules. The local module supplies explicit JNI class/member keep rules for R8.
- Expo 57.0.27 / Expo modules core 57.0.21 / RN 0.86.3, Kotlin Gradle plugin 2.3.20, Gradle 9.3.1, Android Studio JetBrains JDK 21, SDK 36. Compiler handles dependency metadata without reflection, forced dependency downgrades or metadata-version-check suppression.
- `withLocalAi.cjs` pins the compiler consistently in generated buildscript/properties, minSdk 26, optional OpenCL/vendor library manifest declarations from [official Android guidance](https://developers.google.com/edge/litert-lm/android). CPU is the provisional default; GPU device support and observed backend are unknown.
- Read-only Haki comparison examined provider cancellation guard and model-operation coordinator. No reflective bridge code or old stack was copied.

## Lifecycle decisions and safeguards

Separate serial worker and control executor: control cancellation/idle waits cannot queue behind a blocked initialization/inference invocation. Native ownership tracks request ID, strictly increasing epoch, terminal deduplication and irreversible poison after missing idle proof. Conversation closes before positive idle/terminal delivery. Automatic native tool execution is false; OpenAPI handlers throw if unexpectedly invoked. Only typed proposals cross to the host dispatcher.

JS normal completion waits positive native idle before resolving, allowing immediate next tool round safely. Stop settles caller promptly but retains active ownership until native idle. Cancellation acknowledgment alone never frees the context. Missing acknowledgment, false/late idle or cleanup failure poisons the provider and retains its model-file lease until process restart. Initialization has a 30-second host watchdog; timeout does not grant idle. Model mutations use the shared asynchronous exclusive coordinator.

Private file checks canonicalize under Android app-private `filesDir/omni-ai-models`, stream SHA256 in 1 MiB buffers, and recheck exact length/hash immediately before engine initialization. Capability reporting never claims an observed device backend from compilation.

## Actual commands/results

1. `node --test tests/ai/native-provider.test.cjs`: **11/11 pass**, exit 0. Covers stale/duplicate events, delta versus cumulative normalization, duplicate terminal, immediate consecutive tool rounds, Stop before native acknowledgment, cancellation timeout, poison, retained lease, concurrent generation/model mutation, bad hash metadata, failed cleanup, thermal start block, consumer callback exception and initialization timeout.
2. Independent M2 review rerun: `node --test tests/ai/native-provider.test.cjs tests/ai/model*.test.cjs`: **44/44 pass**, exit 0 (11 provider + 33 model tests). Redirect review required validating each HTTPS redirect origin before fetching; the model owner fixed it and added malicious redirect/loop/CDN tests. Local import nested handle cleanup also fixed.
3. `node apps/mobile/node_modules/typescript/bin/tsc --noEmit -p apps/mobile/tsconfig.json`: exit 0.
4. Isolated staging `.g/ai-native/host/android/gradlew.bat -p .g/ai-native/host/android :omni-local-ai:compileReleaseKotlin :omni-local-ai:testReleaseUnitTest --no-daemon --max-workers 2 -PreactNativeArchitectures=arm64-v8a`: **BUILD SUCCESSFUL in 1m 58s**, exit 0 after resolving previously uncached public JUnit. Exact log `.g/ai-native/compile-module-online.log`.
5. Same command with `--offline`: **BUILD SUCCESSFUL in 30s**, exit 0; `.g/ai-native/compile-module-offline.log`. Actual native/staged source hashes were checked equal. Kotlin test XML: `OwnershipTest`, **3 tests, 0 failures/errors/skips**.

## Failures and repairs

- First sandbox download: DNS unavailable. Pinned public metadata/source retrieved using approved read-only network escalation. No credentials/model weights involved.
- First sandbox Gradle: daemon loopback unavailable. Host-only Gradle run required approved sandbox escalation.
- First actual module configuration: Expo required `android.defaultConfig.versionName`. Added versionName/versionCode.
- First offline test attempt: JUnit 4.13.2 uncached. Resolved public dependency, then reran offline successfully.
- Parent review caught normal completion resolving before native idle, breaking sequential tool rounds. Fixed completion ordering and added a regression. Stop remains independent of native idle.

## Acceptance limits

This proves typed Android compilation and controlled ownership contracts. Full application R8 release assembly/native registration/ABI verification is the M9 integrated build gate, implemented by `scripts/build-offline-ai-host.py`. This document does **not** grant final M1/M3/M9 parent acceptance by itself.

`MODEL_INFERENCE_ON_POCO = NOT_RUN_PENDING_M10`; `BACKEND_DEVICE_SUPPORT = UNKNOWN`; `DEVICE_ACCEPTED = false`. No actual model tokens, native cancellation latency, native peak memory, MapLibre coexistence, thermal or offline device behavior have been measured. JNI quiescence and model format remain real-device acceptance tests.

## Final review repairs (2026-10-16)

Parent review and native self-review added deferred safe teardown after an in-flight terminal callback, an independent five-second severe-thermal monitor, and a mutex fencing JNI cancellation against conversation deletion. The mutex is never held while inference runs. Every delayed cancellation rechecks request ID/epoch inside that mutex, preventing an old control task from stopping a newer turn. Thermal cancellation has precedence over user cancellation and successful completion even when the SDK reports `onDone`; its reason policy has a Kotlin regression.

Latest exact native verification: `.g/ai-native/compile-module-thermal-final.log`, offline typed release compilation plus **4 Kotlin tests, 0 failures/errors/skips**, `BUILD SUCCESSFUL in 41s`, exit 0. Provider/config tests remain **13/13 pass**. Full app shrinker compatibility and final artifact evidence are recorded in `M9_NATIVE_BUILD.md`; R8 9.1.31 is required for the actual Kotlin 2.4 dependency metadata. This is a documented compiler compatibility update, with no metadata-check suppression or reflective inference API.

Independent final review then caught a native manual-tool transcript defect: ordinary `tool` text did not use the pinned SDK's `Content.ToolResponse`, and prior assistant tool-call metadata was missing on reconstructed rounds. The fresh `NativeMessages` codec now creates actual typed `ToolCall` and `Content.ToolResponse` messages, parses bounded JSON response data, checks allowlisted matching call/response names and rejects orphan/unnamed tool messages. The host retains only validated dispatched calls and trims transcript bundles atomically; ordinary revalidated reference context uses the user role. New JVM tests exercise the actual SDK message classes without loading a native engine. Final compilation/test evidence is included in the M9 report after execution; no device result is inferred from these message-level tests.

Exact protocol verification: `.g/ai-native/compile-module-tool-protocol-java21.log`, offline release compilation plus **7 Kotlin tests (4 ownership + 3 actual SDK message-codec tests), 0 failures/errors/skips**, `BUILD SUCCESSFUL in 56s`, exit 0. The first codec-test run failed 3 tests with `UnsupportedClassVersionError`: published LiteRT message classes use Java 21 bytecode (65), while Expo's default unit-test launcher was Java 17 (61). The module now selects a Java 21 **host test launcher only**; Android compilation remains on Expo's Java 17 target and R8 performs Android dex compilation. This failure was not an inference/device result.
