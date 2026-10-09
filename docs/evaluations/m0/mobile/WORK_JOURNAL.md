# Mobile work journal — 2026-10-09

Task: M0 feasibility only. Assigned apps/mobile/** and this evaluation directory. Parent review pending.

WHY: DEC-004/006/014 are provisional until native build, map rendering and SQLite queries are proven. Repository was blueprint only. Native development build needed because MapLibre is unavailable in Expo Go.

HOW: official Expo SDK tables + exact stable template + npm MapLibre peer metadata yielded pinned SDK57/RN0.86.3/React19.2.3 candidate. Native SQLite plugin enablesFTS; no vector extension. Bundled empty background avoids tile licensing/network contamination. Bound native SQL asserts exact positive fixture, no-match result and integrity. Renderer event represents full render, separately from load failure. Strict host guard rejects any style extension/resource beyond a hex background.

Validation: install passed; typecheck passed; Expo check corrected React types to19.2.4 and passed; Doctor initially failed configuration-sync warning, concrete CNG generated-folder ignores + mandatory prebuild workflow fixed it to21/21. Parent challenged imports URI bypass; allowlisted style keys now reject imports/extensions. Android x86 debug build11m32s, ARM641m both succeeded with logs. Phone ARM64 install failed user restriction; native query/render/screenshot not inferred.

Rejected alternatives: latest unrelated TypeScript7; Expo Go; demo/public raster tiles; fake geographic fixtures; npm forced downgrade fixes; claiming host SQL tests prove Expo native SQLite; assuming compile proves device render; modifying phone safety settings to bypass install restriction; choosing PMTiles delivery before M5.

Tools/versions: Node22.20.0, npm11.18.0, JBR21.0.5, adb37.0.0, Gradle9.3.1, AGP8.12.0, Kotlin2.1.20, NDK27.1.12297006, build-tools36.0.0. SDK compile/target36,min24. Physical model/API/ABI only logged. Bounded2Gradle workers on ARM stage. No global install/env changes. Native outputs ignored and reproducible through prebuild.

Material decision proposal for parent journal: SDK57 candidate matches documented current target pair; remains provisional pending device execution and23dependency advisories assessment. Parent owns decision IDs/shared journal/integration. Offline delivery tech left OPEN. No M1 work started.

## Follow-up validation and fixes

Parent independently reproduced the Ninja 265-character include path failure on incremental rebuild. Cache relocated within mobile to `.g`, reducing that path to 247 characters; original cache move was verified against absolute assigned-root containment, local daemon stopped, initial APK retained. Generated native folders regenerated; Metro excludes large caches and archives. Short-cache ARM build passed in 3m53s; no system long-path/config changes.

User approved actual phone install review; retry installed. First phone launch showed HTTP end-of-stream from IPv6-only localhost Metro versus IPv4 USB reverse, plus separate caught missing splash manager warning. Process-scoped IPv4-first npm start fixed local transport; matched splash-screen 57.0.9 added and native build passed in 2m18s. Final audit is 24 advisories (16 high, 8 moderate); final Doctor passed 21/21. Earlier logs preserved.

Phone then produced transient success markers followed by two native SIGABRT crashes. App-only crash blocks and independent symbolication traced FTS close destructor double finalization. Parent approved hidden/current-version option `finalizeUnusedStatementsBeforeClosing: false`; all used SDK query wrappers finalize their own prepared statements. Close remains explicit, database reopens and persistence/positive/zero/integrity are asserted, second close completes before PASS. Final physical run logs both closures, SQLite 3.50.3 results and MapLibre full rendering, remained alive about 107 seconds, and screenshot captured. Parent fresh-process regression and acceptance pending. Native/library lifecycle and production security risks remain OPEN; M5/M14/iOS not claimed.
