# M0 mobile intermediate feasibility record — 2026-10-09

Historical snapshot before install approval, native transport fix and SQLite lifecycle workaround. See `HANDOFF.md` for final outcomes. No production stack or M0 acceptance asserted by implementing engineer.

| Gate | Actual outcome | Evidence |
|---|---|---|
| Install pinned JS dependencies | PASS,491 packages installed | logs/npm-install.log, package-lock.json |
| Strict TypeScript | PASS | logs/typecheck-aligned.log |
| SDK version alignment | PASS after React types19.2.2 →19.2.4 | original expo-check.log plus expo-check-aligned.log |
| Expo Doctor1.20.4 | PASS21/21 after concrete CNG ignore fix | original expo-doctor.log20/21, final expo-doctor-cng.log |
| Empty local style guard | PASS current style + reject external source/glyph/sprite | logs/style-check.log; parent separately injected imports |
| Android debug x86_64 | PASS11m32s,481 tasks executed | logs/assemble-debug.log |
| Android debug ARM64 | PASS1m,20executed/461up-to-date | logs/assemble-debug-arm64.log |
| ARM64 APK identity/permissions | Inspected: min24/target36/compile36, ARM64 only, no location/audio permission | logs/apk-badging.txt |
| Physical phone install | FAIL INSTALL_FAILED_USER_RESTRICTED: Install canceled by user | logs/phone-install.log |
| Native SQLite/FTS5 query and absent query | BLOCKED: app not installed, source assertions not runtime proof | App.tsx native self-test ready |
| Native MapLibre render and screenshot | BLOCKED: app not installed | Map full-render event ready; no screenshot fabricated |
| Permissionless app usability | BLOCKED runtime; manifest excludes location/audio | APK badging only |
| TalkBack/font scaling | SOURCE REVIEW ONLY; no physical accessibility execution | heading role, live status, font scaling default, scrollable diagnostic text |
| Complete offline map / standalone airplane cold start | NOT IN M0 SPIKE; deferred M5/M14 | only bundled empty background, no tiles/fonts/sprites |
| iOS native build | BLOCKED Windows host; official library support only | COMPATIBILITY.md |
| Production dependency security | OPEN23 advisories16high/7moderate | npm-audit.json and audit-chains.log |

Physical test target: model2311DRK48G, Android API36, arm64-v8a. No phone identifier recorded. A read of only focused-activity metadata during installation found Google PlayProtectDialogsActivity, then adb returned the explicit install restriction. No phone safety settings changed or bypass attempted. A retry requires user action on the actual system install review; parent coordinates that action.

APK: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` (generated/ignored). SHA256 `1F1E3314E53CB4B5E1B01C1B4EBCFE0B2AD8831129208FDA444941EA5E42D509`. Exact current package lock retained. Build logs contain upstream deprecation warnings; no compilation error. Original x86 build lacked NODE_ENV and warned; ARM build explicitly used development and succeeded.

Commands and tooling are recorded in mobile README and COMPATIBILITY.md. Build used Studio JBR21, local Gradle cache under generated Android directory, installed SDK/NDK, process-scoped environment values. Sandbox npm DNS and ADB daemon attempts failed, then authorized escalated operations succeeded; npm-expo-metadata.log preserves DNS failure. No global tools/environment configuration installed or changed. Only adb local server/USB reverse used for diagnostic development transport.

Changed authored paths: apps/mobile/package.json, package-lock.json, app.json, tsconfig.json, index.ts, App.tsx, fixtures/local-style.json, scripts/check-local-style.mjs, .gitignore, README.md; docs/evaluations/m0/mobile/plan,compatibility,results,journal and logs. Generated native project, node_modules and Gradle outputs remain local/ignored. No shared docs, schemas, source register, M1 feature/data or AI code edited.

Provenance: local background style and SQL text authored solely for diagnostic feasibility; source/business/geometry counts0, one explicitly synthetic lexical fixture. No geographic data/media downloaded, no OSM tiles, attribution obligation not inferred from absence of data. Third-party package license metadata inspected: Expo/RN/MapLibre RN/SQLite/dev-client MIT; transitive native/package notices need later distribution audit. This source-only spike does not assert merchant/data licensing or brand approval.

Parent handoff: independently inspect source/lock/logs and rerun critical checks; either authorize coordinated install retry after user resolves the system prompt or retain BLOCKED native gates. Accept only this bounded feasible candidate evidence; runtime, production security, geographic offline packs and iOS remain distinct gates.
