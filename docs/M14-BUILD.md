# M14 build and release verification

`npm run typecheck`, `npm run lint`, `npm run check:host`, and `npm run check:geo` are the host gates. The host workflow runs them on pull requests and changes to `main` after `npm ci` and the pinned Python map requirements. They exercise the existing deterministic checks and source/resource receipts. They do not validate runtime behavior on a phone.

The separate `android-release.yml` workflow is manual. Supply a full 40-character committed source SHA. It rejects a dirty checkout, uses `npm ci`, pins Node 24.11.1 and JDK 21.0.5+11, installs Android platform 36, build-tools 36.0.0 and NDK 27.1.12297006, runs standard Expo clean prebuild and Gradle `:app:assembleRelease` for ARM64, then verifies the APK. The Gradle wrapper and Expo plugin pin their own Gradle and Kotlin versions. Its JSON report appears in the job summary. The APK is kept only in the ephemeral runner workspace: the workflow has no upload, release or deployment step. The source rights do not authorize a public downloadable artifact.

For a local release, use a clean committed source tree and the established command in [`apks/INDEX.md`](../apks/INDEX.md). Set `JAVA_HOME` to JDK 21 and `ANDROID_HOME` to the installed SDK. After the build, from the repository root:

```powershell
python scripts/verify-android-artifact.py android/app/build/outputs/apk/release/app-release.apk --require-clean --expected-signer-sha256 fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c --report artifacts/android-release.json
```

The verifier checks package/label/versionCode/minSdk/targetSdk/permissions, the APK's v2/v3 signature and certificate fingerprint, ARM64 and required LiteRT/MapLibre/Hermes libraries, the exact generated Hermes bundle and current source-map inputs, both map-pack receipts, the context archive, preview fingerprint/input digests and all 24 preview media resources, model-weight exclusion and ZIP CRC. The report records the source commit and clean state, lockfile digest, toolchain, data/map receipts, signer fingerprint, size and APK SHA-256. `--expected-signer-sha256 HEX` requires signer continuity with an installed preview. The controlled workflow pins the existing test signer (`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`). The current Gradle `release` variant uses a debug/test certificate; successful verification does not establish production signing.

For a numbered standalone delivery, use the next sequence in `apks/`, keep earlier APKs, create its `.apk.sha256` sidecar and add its full clean source SHA, report facts and installation limits to `apks/INDEX.md`. APK binaries remain Git ignored. Do not rename an older build to represent new inputs.

Traceability and byte equality are separate. The manual workflow's optional `compare_clean_builds` switch creates a second clean Git worktree at the same SHA, installs its lockfile dependencies, runs Expo/Gradle with the same signer, verifies it, and compares APK SHA-256. On mismatch, `compare-android-apks.py` records changed ZIP entries, metadata and whether only the container bytes differ, then fails the workflow. The first build alone establishes provenance but makes no byte-reproducibility claim. APK signing material remains outside tracked source; any production signer would require separately controlled credentials and rights review.

No CI job installs on a phone, downloads AI model weights, uploads precise location, publishes an APK or claims device acceptance. The owner performs a separate manual phone validation stage.

The workflow follows [Expo's generated-native-project workflow](https://docs.expo.dev/workflow/continuous-native-generation/) and uses Android's [`apksigner verify`](https://developer.android.com/tools/apksigner) for signing evidence. M14 local host checks were run in an isolated baseline-plus-M14 snapshot while another chat edited navigation. No M14 APK has been built; clean-source build verification and actual GitHub workflow execution remain pending owner approval and stable integrated inputs.
