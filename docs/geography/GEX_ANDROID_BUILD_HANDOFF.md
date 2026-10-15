# GEX isolated Android preview build

Date: 2026-10-15 (Asia/Manila). Host build only; physical validation requires the
user's explicit USB debugging permission.

The isolated host workflow is `pipelines/mobile/gex_preview_build.py`. It
snapshots current authored app/packages/manifests and the exact internal bundle
approval into `.g/gex-native-r2`, copies the installed pinned npm module sources,
and copies existing Gradle 9.3.1 caches into `.g/gex-native-c`. Native/module build
directories and `.cxx`/`.gradle` caches are excluded from npm copies; compiled JS
`build` directories are retained. App build outputs use the short private
`.g/gex-native-b` tree; root/module outputs remain in the private copied tree
because React Native settings/codegen embeds their conventional paths. These copies avoid writing to the production/native
checkout or the independent AI runtime build.

Only staging changes package/name/scheme to `com.omnibgc.gexpreview` / Omni-BGC GEX
Preview, removes the Metro rule that would otherwise exclude its `.g` ancestor,
and limits Metro workers. The original `com.omnibgc.preview` app identity, saved
data, permissions, native sources and assets remain untouched. No adb, emulator,
Expo `run:android`, installation, launch or USB command is part of this workflow.

The release assembly uses the existing Android Studio JDK, installed SDK/build
tools 36, the existing Java 17 compiler toolchain and the pinned Expo/RN/MapLibre stack. Gradle runs offline, with ARM64
only, two workers, a private cache, no shared daemon and in-process Kotlin
compilation. Expo CNG runs exclusively in staging with `--no-install`, offline mode
and telemetry disabled. The release variant embeds the Metro/Hermes bundle;
development-key signing is retained solely for coordinated internal preview use.

Every APK check is against actual archive bytes: ZIP CRC, ARM64 libraries,
embedded release bundle, package/SDK values, signing verification, exact pilot and
expanded manifest/resource hashes, backup/permission flags, and included source-map
content for the current MapCanvas, scoped data store and map catalog. Original
source fingerprints are checked before/after build; parent review/journal prose
may evolve while the runtime snapshot and exact approval remain frozen.

## Current evidence

**Host assembly and static APK verification PASS.** The first staging attempt detected an
authored formatter-script edit during the initial snapshot and stopped before
native compilation. The second copy hit two long RN iOS header filenames; the
copier now uses Windows extended path syntax. It changes no system long-path
policy and resumes only incomplete staging directories. A second source race was
caught before CNG; the final runtime snapshot was refreshed and frozen.

The sandbox-local `LOCALAPPDATA` did not identify the existing SDK, so the host
workflow now uses an explicit overridable SDK path. The sandbox prevented the
Gradle loopback daemon connection; only host compilation was retried outside that
sandbox. The offline cache lacked automatic Java 17 toolchain discovery, corrected
by pointing to the existing read-only toolchain and disabling auto-download.
Two private output-path attempts exposed React Native's embedded root autolinking
and module codegen paths; those outputs now remain at conventional private paths,
with only the app output shortened. CMake staging also uses short private paths
and an explicit 250-character object-path budget after Windows rejected an
overlong safe-area native filename. No OS policy or shared module was edited.
Failed logs remain alongside the successful log.

Successful native assembly: Gradle 9.3.1 `assembleRelease`, 665 actionable tasks
(605 executed, 60 up-to-date), 415.995 seconds in this host attempt. This is build
time, not Android performance. Embedded Hermes bytecode is 2,423,768 bytes; its
906-source composed map contains exact staged MapCanvas/store/catalog/App source
content. Node 22.20.0, build JVM 21.0.5, existing Java 17 compiler toolchain, SDK
36/minimum 24 and ARM64 only. Expo 57.0.27, React Native 0.86.3, MapLibre RN 11.5.0.

Artifact: `.g/gex-native-r2/Omni-BGC-GEX-preview-arm64.apk`, **44,415,303 bytes**,
SHA256 `c1229809c1897c5c2b5b8958e5c2bf53695b55baaba173c5d23d6fd771534c3d`.
APK ZIP CRC, v2 development signature, distinct package identity, embedded bundle,
all 24 pilot/GEX resource hashes and both manifests PASS. Backup is disabled,
the release is not debuggable, and all original blocked permission checks PASS.
Existing optional foreground location permissions remain optional. No permissions
were granted on a device.

Exact portable receipt: `apk-verification-r2.json`, SHA256
`5ec17823073e1f69d7cf66c6da1bd87d27f5b7a40cc4c3ea568eac108777c8ef`.
The original receipt/logs are in `.g/gex-native-r2/`; the frozen authored snapshot
is `staged-source-snapshot.zip`, 2,771,699 bytes, SHA256
`42926ea222784e0c490e8faed00b9c692a6f755e303e7a2877830b797702e1eb`.
The receipt enumerates shared checkout divergence from ongoing Offices work;
this APK is the frozen GEX preview and is not final Offices acceptance.

Parent ACCEPT initially applied to this host artifact only. The user subsequently
granted USB testing and approved retry after Android rejected the first install.
The exact APK installed and rendered offline on model 2311DRK48G / Android16.
`device-qa.json` records observed PASS/PARTIAL/BLOCKED/NOT_RUN scenarios and actual
screenshots/metrics. Full physical QA is not accepted. No source/public-release
right or statistically comparable performance budget follows from these samples.

This frozen APK precedes the user's full-height-at-every-zoom correction and the
latest shared Offices scope/expiry work. See `GEX_HEIGHT_HANDOFF.md` for the new
source change/current build coordination. Do not call this older APK height-fixed.
