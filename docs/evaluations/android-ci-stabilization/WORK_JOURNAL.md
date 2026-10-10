# Android crash and CI stabilization — 2026-10-10

Parent owner: Staff Mobile Engineer. Starting commit b4bb86b3c1ee616bc639c1b6e7f297fac3e50abc; fetched origin/main matches. Branch codex/android-crash-ci-stabilization.

Plan and success criteria:
1. Verify installed bridge, remove only the crashing JSX scalar and guard all dynamic Layer setter types. Preserve pure style JSON, resources, coordinates and route overlays.
2. Preserve candidate navigation rejection with deterministic synthetic fixtures; separate historical integration input and report NOT RUN when absent. Run every required workflow stage including final strict TypeScript.
3. Rebuild established standalone ARM64 preview, inspect exact resources/signature/hash, run remote Actions, and validate on attached Android without clearing data.

Risks: host bridge tests do not prove native launch; ignored historical data cannot be assumed on CI; generated resource changes must not slip into the APK. Native validation is BLOCKED: authorized ADB inventory returned zero devices. No APK installation/logcat/gesture/offline screenshots claimed.

Tool evidence: Node v22.20.0, Python 3.13.7; installed Expo 57.0.27, React Native 0.86.3, MapLibre RN 11.5.0 / native Android 13.6.1. No dependency upgrade.

Android WHY/HOW: Layer.tsx merges layout/paint then transformStyle serializes primitives unchanged. Kotlin MLRNStyleFactory.setIconPadding uses getFloatArray(VALUE_KEY), which calls ReadableMap.getArray on the scalar. Removed custom padding from place-pins. Regression invokes installed TypeScript serialization and compares payloads with installed Kotlin setter getters, including scalar failure and [8] compatibility. Reviewed textOffset/textFont/lineDasharray arrays; textPadding uses getFloat and stays numeric. pilot-style.json source-trees icon-padding=4 goes through direct style JSON parsing and remains unchanged. Rejected rewriting all padding or upgrading the native stack.

Validation and parent acceptance will be appended after actual execution.

Android focused validation: installed-bridge regression 2/2 PASS and app TypeScript PASS. The initial host checker did not model Kotlin's image-name-to-expression constructor and failed on iconImage; corrected that host model and reran successfully. Regression is wired into required Mobile JavaScript CI and the existing UI integrity gate. Parent ACCEPTS the narrow source fix and host regression for branch review; real native acceptance remains BLOCKED, zero connected devices.

CI WHY/HOW: the original first engine test asserted empty graph refusal, lowercase GraphPack candidate rejection and historical uppercase M3 export rejection; only the last depended on ignored local input. A committed project-authored two-node M3-shaped candidate fixture now preserves that export rejection. Both candidates additionally replace a proven usable synthetic graph, asserting fail-closed state clearing and navigation refusal. The original historical assertion remains in a separate optional integration suite, with an explicit NOT RUN skip when unavailable. Existing installed-loader receipt tests remain unchanged. No routing engine, geography, schema or source data changes. Rejected deleting assertions or publishing the historical export.

Final validation: clean tracked snapshot without generated inputs passed all20 workflow test/typecheck commands; explicit historical integration NOT RUN, final strict TypeScript PASS. Existing local historical integration PASS; portable routing27/27 PASS. UI/resource gate10groups PASS,7font/license hashes/161candidate source records/11contrast pairs. Established ARM64 build exit0 in29s,622tasks; exact updated Metro source verified. APK42,271,529bytes, SHA2564094d40a1ca8fbcfd86a4093b9654803ef3ee2d3cb4996ce946a098c07c99a7d;10map resources/3font weights/Ionicons/ZIP/ARM64/v2signature verified. Signing certificate matches previous APK.

Remote: pushed separate commits09bcea6(Android) and5176fe9(CI). Quality push run38045341923 and job114193624033 completed success on5176fe9805d4b61abbe930d27710e92fc635be76; parent inspected every step and decoded logs including new regression/optional historical NOT RUN/final strict TypeScript. GitHub connector PR creation denied403; no PR created or main merged. Exact evidence saved in this directory; old milestone reports restored after copying new evidence.

Parent ACCEPT host-tested fixes, routing safety and packaging/remote CI. Native acceptance BLOCKED after final ADB inventory again returned zero devices. No native installation, launch, logcat, interactions, screenshots or airplane-mode results inferred. Definition of done remains pending real Android acceptance; exact manual commands and checks supplied in HANDOFF.md.
