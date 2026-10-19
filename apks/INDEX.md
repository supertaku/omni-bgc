# Standalone APK deliveries

The highest numeric filename prefix is the latest delivery. Preserve older files. Filenames contain a six-digit sequence, app version, ABI, build variant, delivery time in UTC and source commit. Delivery time can differ from compilation time. Future deliveries increment the highest existing sequence and include a SHA-256 sidecar. APK binaries are local artifacts ignored by Git; this index and checksums are tracked source metadata.

## 000001 — current manual-test APK

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
