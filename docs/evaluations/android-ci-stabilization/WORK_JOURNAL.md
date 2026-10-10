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
