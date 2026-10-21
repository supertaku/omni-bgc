# Standalone APK deliveries

The highest numeric filename prefix is the latest delivery. Preserve older files. Filenames contain a six-digit sequence, app version, ABI, build variant, delivery time in UTC and source commit. Delivery time can differ from compilation time. Future deliveries increment the highest existing sequence and include a SHA-256 sidecar. APK binaries are local artifacts ignored by Git; this index and checksums are tracked source metadata.

## 000002 — current manual-test APK: The Fort

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
