# C0 source baseline — October 16, 2026 (Asia/Manila)

Parent verdict: **BASELINE_RECORDED**. Starting clean `main` at
`3fad67caa4baf44a4a68b2368d8b369877c11c1d`; implementation branch
`codex/offline-ai-native-recovery`. No existing source or private inputs discarded.

Success criteria: locate authentic native code and private inputs, preserve R4,
identify exact tracking failure before repair. Risks: ignored workstation-only
source, Windows newline conversion, private-input availability, host/device claims.

Git tracked three module wrapper/configuration files and zero Android files.
`git check-ignore -v` identified `apps/mobile/.gitignore:5:android/`.
All eight authored Android files already existed locally. Parent and independent
reviewer compared every byte/size/SHA256 against both R4 receipt inventories,
frozen ZIP and staged source: exact match, no extra/missing files. No extraction
or re-authoring was necessary. Exact inventory is in `NATIVE_SOURCE_RECOVERY.json`.

Original R4 APK, ZIP, source receipt, APK verification and erratum hashes remain
unchanged. The first strict read-only erratum audit failed because Git checkout
converted only `apps/mobile/scripts/{ai-host-assets,format-authored}.cjs` from LF
to CRLF. Independent full application comparison proved no other drift and exact
content equality after newline normalization. Restored those two files from their
committed LF blobs, then reran the unmodified audit successfully:
`HOST_STATIC_VERIFIED_WITH_EXPLICIT_RECEIPT_SIZE_ERRATUM`. Preserve LF on subsequent
checkouts; no exception was added to the audit. New builds use separate receipts.

Existing authorized food/office/omni/GEX generated assets are present.
`node apps/mobile/scripts/ai-host-assets.cjs` exited 0 and verified existing policy
receipts and map checksums. No source approval or publication rights changed.
Food remains research (278 establishments / 1,279 menu items); office research
remains 179 candidates / zero approved canonical offices. Walking remains disabled.

Observed tools: Node 22.20.0, npm 11.18.0, Python 3.13.7, Android Studio JDK
21.0.5; existing Java 17 toolchain. Locked Expo 57.0.27 / RN 0.86.3 /
expo-modules-core 57.0.21. Gradle wrapper 9.3.1; Kotlin 2.3.20, R8 9.1.31,
LiteRT-LM 0.18.0, SDK 36 / NDK 27.1.12297006 are existing build pins; compilation
evidence belongs to C2. No ADB invocation, device inventory or model download.

Private evidence: `.g/ai-m10/c0/baseline.json`, `r4-initial-audit-failure.txt`,
`r4-restored-lf-audit.json`, `authorized-assets.log`. Physical acceptance remains
NOT_RUN; current overall verdict **NOT_RELEASE_READY**.
