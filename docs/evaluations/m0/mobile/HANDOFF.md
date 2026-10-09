# M0 mobile final handoff — 2026-10-09

**Parent acceptance pending.** Candidate native feasibility is demonstrated on the physical Android phone after documented fixes. This is a development spike, not a production map, offline pack or security approval.

Physical device: model 2311DRK48G, Android API 36, ARM64. Identifiers omitted. Final diagnostic APK: `apps/mobile/artifacts/m0-arm64-final.apk`, 79,899,148 bytes, SHA256 `88B93613AFF3E92CAB09CCA8C1CD7696FF86E82E9AC02522A32D37EA7D877B39`. Native debug APK loads JavaScript from local Metro; tested App.tsx and lockfile hashes are separately recorded in `logs/native-evidence-sha256.json`.

| Check | Actual final outcome | Evidence |
|---|---|---|
| Exact pinned install / typecheck / Expo alignment | PASS | package-lock.json, logs/typecheck-sqlite-lifecycle.log, expo-check-final.log |
| Expo Doctor | PASS 21/21 on final dependencies/configuration | expo-doctor-final.log; original warning/fix logs preserved |
| Local style and external-resource negative checks | PASS, narrow empty background only | style-check.log; parent independent adversarial imports check |
| Initial x86 / ARM debug builds | PASS, 11m32s / 1m | assemble-debug.log, assemble-debug-arm64.log |
| Short cache native rebuild | PASS, 3m53s | assemble-debug-arm64-short-cache.log |
| Final native support build | PASS, 2m18s | assemble-debug-arm64-final.log |
| Native MapLibre render | Full-render event + actual local background viewport | phone-app-logcat-lifecycle.txt, screenshots/phone-m0-lifecycle-clean.png |
| Native SQLite 3.50.3 / FTS5 | Positive=1, absent=0, integrity=ok; close, reopen, persisted positive/absent/integrity assertions, second close | phone-app-logcat-lifecycle.txt, metro-sqlite-lifecycle.log |
| Physical native stability | Agent same process about 107 seconds; parent independent fresh-process native checks and same PID for 60 seconds passed | phone-app-exit-info-postfix.txt; ../parent/independent-physical-review.json |
| Optional location | No request; retained final APK declares no location/audio permission; app operates visibly | apk-badging-final.txt, diagnostic screenshot |
| Accessibility | Diagnostic text visible; semantic header/live status/scalable default text/scroll region inspected | screenshot + source; TalkBack, scaled-font/orientation tests not executed |
| Production security | OPEN: 24 npm advisories, 16 high / 8 moderate | npm-audit-final.json; COMPATIBILITY.md |

Important failures and corrections are preserved:

- Sandbox registry DNS/ADB daemon access initially failed; authorized escalated tools succeeded. No global configuration changes.
- Phone initially rejected installation (`INSTALL_FAILED_USER_RESTRICTED`). User explicitly approved the actual install review; retry succeeded. No system safety bypass.
- Initial local Metro bound IPv6 `::1`, causing Android USB IPv4 HTTP end-of-stream error. `npm start` now uses process-scoped IPv4-first DNS, localhost and two workers; HTTP `127.0.0.1:8081/status` returned 200. Initial error screenshot/log preserved.
- Dev launcher separately logged a caught missing SplashScreenManager warning. Added SDK-matched Expo splash-screen 57.0.9, rebuilt. It was not falsely attributed as the transport failure's cause.
- Parent reproduced Windows Ninja include length 265 characters on incremental build. Stopped local daemon, verified move paths remain inside mobile, moved cache to `apps/mobile/.g` (same include 247 characters), archived generated intermediates, regenerated Android. No system long-path setting changed. Metro excludes caches/generated/native/artifact/archive paths.
- Two actual native crashes followed transient native success markers. App-only backtrace and independently symbolicated library prove FTS-owned statement finalization during SQLite close. Parent approved narrow typed-but-hidden `finalizeUnusedStatementsBeforeClosing: false` option; own query wrappers finalize their statements, explicit close retained. PASS now occurs only after close/reopen and both completed closes. Original crashes remain in `phone-app-native-crash.txt`, `phone-diagnostic-crash-buffer.txt`, and exit-info records; independent review under `../native-review/`. [Primary upstream report](https://github.com/expo/expo/issues/38168).

Changed source: mobile package/config/lock, strict TS entry and diagnostic App, empty local style and validator, Metro cache exclusions, CNG ignores, reproducible README. Evaluation plan, compatibility matrix, historical results, journal, this handoff, logs and screenshots. No shared docs/schema/source register/M1 implementation or data changed. No AI or location dependency installed. Fixtures are authored diagnostic text, geography/business record count zero. Direct primary-package license metadata is MIT; native/transitive distribution notices still need later review.

Evidence checksums: `evidence-manifest.json` records completed logs/screenshots; the live Metro log is represented by an immutable snapshot. `native-evidence-sha256.json` links the tested App source, package lock, retained native APK and clean screenshot. Metro remains running for parent handoff at localhost:8081; no further phone interaction performed after parent began independent validation.

Candidate commands: see mobile README. Always prebuild before native assembly. Process-scoped Java uses installed Studio JBR 21.0.5; installed SDK compile/target 36, min 24, NDK 27.1.12297006; Gradle 9.3.1, AGP 8.12, Kotlin 2.1.20. SDK reports a pre-existing NDK directory metadata mismatch; not modified. Generated Android, dependencies, short Gradle cache and APKs are ignored local outputs.

Parent independent checks passed: current-source typecheck, style adversarial cases, short-cache ARM64 incremental rebuild (11 seconds), fresh-process physical query/lifecycle/render and 60-second stability. Parent inspected screenshot and noted the Expo developer bubble overlaps the no-data sentence; acceptable only for feasibility. Source frozen; parent final milestone acceptance remains pending.

Remaining gates: iOS native compilation; complete local geographic tiles/fonts/sprites and airplane cold start without Metro; performance/FPS; production SQLite lifecycle contract/hidden-option upgrade test; dependency advisory reachability and patch resolution; full accessibility/production UI. No offline-delivery decision locked. `apk-sha256.txt` is the initial APK's historical checksum; final retained/installed APK and generated output identities are explicitly separated in `apk-identities-final.json`.
