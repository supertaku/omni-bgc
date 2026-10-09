# M0 independent native crash review — 2026-10-09

Status: **CHANGES_REQUESTED for the crashing candidate; narrow candidate fix recommended for validation.** Parent alone accepts the milestone. This report does not claim the proposed fix passed a device test.

## Objective, plan, success criteria and risks

Identify the physical Android SIGABRT after MapLibre rendering and SQLite query markers, independently of the mobile implementation owner. Review only M0 scope, installed mobile source/configuration and app-scoped evidence. Own writes only `docs/evaluations/m0/native-review/**`; no device actions, builds, dependency edits or mobile changes performed.

Plan: (1) locate the crashing operation from scoped logs/tombstones; (2) verify native symbols against the exact library build; (3) inspect ownership and cleanup in installed source and primary upstream evidence; (4) recommend the smallest discriminating change and lifecycle validation. Success means a defensible failure location and a bounded candidate whose risks and remaining tests are explicit. Principal risks: blaming MapLibre from dependency metadata alone, treating a pre-close query marker as complete success, hiding the failing close, or using an upstream workaround without enforcing application statement cleanup.

## Observed evidence

The reviewed candidate uses Expo57.0.27, RN0.86.3, React19.2.3, MapLibre RN11.5.0/Android13.6.1 OpenGL, expo-sqlite57.0.4 and splash-screen57.0.9. The phone is model2311DRK48G, API36, arm64. The tombstone identifies Android16 POCO/duchamp_global OS3.0.9.0.WNLMIXM. These values describe this candidate/device, not general supported-platform acceptance.

`../mobile/logs/phone-app-native-crash.txt`, PID6474:

- Line423: 17:00:52.160, `M0_MAP PASS fully rendered local background`.
- Line424: 17:00:52.176, `M0_SQLITE PASS SQLite 3.50.3: FTS5 hit=1, absent=0, integrity=ok`.
- Line425: 17:00:52.179, Scudo invalid chunk state when deallocating.
- Line429: 17:00:52.185, signal6/SIGABRT in DefaultDispatch thread10043.

`../mobile/logs/phone-app-exit-info.txt` line7 identifies `APP CRASH(NATIVE)`, status6. The original `apps/mobile/App.tsx` prints SQLite PASS before its `finally { await db.closeAsync(); }`; therefore that marker proves query assertions, not completed database lifecycle or stability.

`../mobile/logs/phone-diagnostic-crash-buffer.txt` contains two app tombstones, PID6474 and8125, with the same close/finalize stack and SQLite BuildId. For PID6474 the relevant exact frames are:

| Frame | PC | Observed/symbolicated operation |
|---|---|---|
| #07 | 0x00b544c | `exsqlite3_free+112` |
| #13 | 0x00bcf78 | `exsqlite3_finalize+156`, vendor/sqlite3/sqlite3.c:91571 |
| #14 | 0x01e73c0 | `sqlite3Fts5IndexClose`, sqlite3.c:251080 |
| #15 | 0x01e4e4c | `fts5FreeVtab`, sqlite3.c:254057 |
| #16 | 0x01e11a0 | `fts5DisconnectMethod`, sqlite3.c:254068 |
| #17 | 0x00f6398 | `sqlite3VtabUnlock`, sqlite3.c:157740 |
| #18 | 0x01b8fe0 | `sqlite3VtabDisconnect`, sqlite3.c:157808 |
| #19 | 0x01b8e08 | `disconnectAllVtab`, sqlite3.c:183825 |
| #20 | 0x00ceba0 | `sqlite3Close`, sqlite3.c:183875 |
| #21 | 0x00ceb00 | `exsqlite3_close+24` |
| #22 | 0x0097f5c | `expo::NativeDatabaseBinding::sqlite3_close()+24` |
| #32 | 0x01a8cbc | `expo.modules.sqlite.SQLiteModule.closeDatabase+0` |

Frames14–20 were independently resolved with the installed NDK27.1.12297006 LLVM18.0.2 `llvm-addr2line -C -f`. The unstripped library is `apps/mobile/node_modules/expo-sqlite/android/build/intermediates/cxx/Debug/1rfg3j2r/obj/arm64-v8a/libexpo-sqlite.so`. `llvm-readelf -n` proves its BuildId `79e477a7121c983b5f9784d539ff8a792a95fb3c` equals both tombstones. Its SHA256 is `C26EC50EEB6118BA689176FB1F18645D8A86ECFD6605AB7D1CEF360A7F7D718D`. Raw outputs are saved in `elf-build-id.txt` and `fts-symbolication.txt`. This matching check avoids interpreting offsets from a different build.

## Mechanism and confidence

**High confidence failure location:** FTS5 internal statement finalization while the connection closes. The exact invalid-free pointer's entire ownership history was not instrumented; the double-finalization mechanism remains a strongly supported explanation pending the option-toggle experiment.

Installed expo-sqlite57.0.4 source:

- Android `SQLiteOptions.kt:17` defaults `finalizeUnusedStatementsBeforeClosing=true`.
- `SQLiteModule.kt:533` invokes `maybeFinalizeAllStatements` before `sqlite3_close`; at626–629 the option controls that sweep.
- `NativeDatabaseBinding.cpp:54–65` traverses `exsqlite3_next_stmt` and finalizes every returned statement, without distinguishing application-created statements from FTS-owned internal statements.
- SQLite's `sqlite3Fts5IndexClose` at251080 subsequently calls `exsqlite3_finalize(p->pWriter)`. This is the exact symbolicated crashing frame. The following lines similarly finalize other FTS-owned statements.
- JS `SQLiteDatabase.ts` implements `runAsync`, `getFirstAsync` and `getAllAsync` with awaited statement finalization in `finally` (lines364,386,445). The original spike uses these convenience APIs sequentially. Its own query statements therefore already complete explicit finalization before its PASS marker.

The primary [Expo issue38168](https://github.com/expo/expo/issues/38168) reports an FTS connection-close crash on Android/iOS, proposes the internal-statement ownership explanation, and provides the same option=false workaround. The inspected page is marked closed, but the retrieved body does not establish a fixed version or that current defaults are safe. The local57.0.4 source and exact stack are the current evidence; the historical issue corroborates the mechanism.

SQLite documents [statement traversal](https://www.sqlite.org/c3ref/next_stmt.html) and warns that [using finalized statements can corrupt the heap](https://www.sqlite.org/c3ref/finalize.html). Neither contract assigns ownership to a wrapper for every statement it can enumerate.

## Narrow candidate and required validation

Open this disposable M0 fixture with `{ finalizeUnusedStatementsBeforeClosing: false }`. Preserve awaited `closeAsync` in `finally`; preserve explicit finalization for every application-created prepared statement. Keep the native dependency pins unchanged for this discriminating test. This skips the wrapper sweep so FTS can clean its own statements during ordinary connection closure. Do not remove FTS or omit closure to manufacture a passing result.

Move the SQLite PASS marker after the entire lifecycle. Mobile owner should demonstrate:

1. Open, create/write synthetic FTS fixture, verify exactly one positive hit, zero negative hits and integrity=ok.
2. Await close; reopen the same database without deleting/reinserting the fixture; repeat assertions to demonstrate persistence and integrity; await the second close.
3. Log lifecycle success only after both closes finish, including stage markers that make any failure localizable. A failed close must propagate and prevent PASS.
4. On the same physical phone capture MapLibre full-render marker, post-close SQLite marker, process still alive and app-scoped absence of new fatal/crash events through a bounded dwell (at least60seconds recommended). Capture readable UI evidence.
5. Perform a fresh process launch and repeat; a Metro hot reload alone can retain native connections or mask lifecycle behavior. Compare app exit history timestamps/PIDs so historical crashes are not counted as new failures.

The existing repeated failing defaults plus an option-only passing result would discriminate this cleanup mechanism without changing RN/MapLibre/native SQLite versions. The lifecycle test is justified by a native memory crash, not a redundant assertion of the option's implementation.

**Hidden API risk:** `src/NativeDatabase.ts:60` types the option, documents default=true, and marks it `@hidden`. It was not found in the current public Expo SQLite reference page. Pinning57.0.4 bounds this workaround; re-audit the option, native cleanup implementation and FTS close regression on every Expo SQLite upgrade. Explicit cleanup becomes essential when automatic sweeping is disabled. Future custom `prepareAsync` statements need `try/finally { await statement.finalizeAsync(); }` and must not remain active when a connection closes.

## Negative hypotheses and rejected alternatives

- **MapLibre/RN incompatibility:** peers and its RN0.85.3 development dependency cannot prove RN0.86 runtime stability. However these two aborts terminate in SQLite FTS closure with no MapLibre destructor frame. A MapLibre downgrade is not justified by this evidence; its separate stability limits remain.
- **Missing splash module or Metro IPv6:** historical blockers were already corrected and cannot explain the observed SQLite free→FTS disconnect stack after native rendering and query success.
- **Page-size/loading issue:** libraries loaded and native SQLite/MapLibre executed. The abort is a deallocation failure, not a failed library load. No evidence supports a16KB-page or ABI fix here.
- **Statement-result concurrency bug:** expo-sqlite57.0.4 includes [PR49796](https://github.com/expo/expo/pull/49796), which guards shared statement cursors. The spike's sequential convenience calls and FTS disconnect stack point elsewhere. Do not downgrade this fix based only on release proximity.
- **Keep connection permanently open, change to synchronous APIs, disable Scudo, remove FTS or blanket downgrade Expo/RN:** each either bypasses the required lifecycle, obscures a memory defect or changes multiple variables without supporting evidence.

## Acceptance advice and unknowns

Severity: **P1/blocking for M0 native feasibility** because the actual app process aborts even after valid queries and map rendering. Parent should require the completed physical lifecycle/process stability evidence before accepting this bounded Android M0 result. No iOS stability, release-mode stability, production offline-pack proof, broader device coverage or production security acceptance follows from this test. The reviewed local style contains no geographic data; no geographic or licensing acceptance is changed.

Escalate beyond the planned narrow regression if option=false still crashes, close/reopen assertions fail, hidden connections survive closure, a new stack implicates the map, or a leak/memory trend appears. Then isolate FTS-only versus plain-SQLite and map-only launches and re-symbolicate the new matching BuildId. A fuller minimum repro/native sanitizer run or coherent SDK fallback would be warranted only after those discriminators; no fallback version is recommended now.

## Daily review journal / handoff

2026-10-09: inspected AGENTS.md, M0 milestone/acceptance sections and compatibility matrix; reviewed app-scoped PID6474/8125 evidence; read installed SQLite option/close/convenience APIs; independently matched native BuildId and symbolicated FTS frames using existing LLVM18.0.2 tools. WHY: distinguish failure location and lifecycle proof from early PASS text. HOW: read-only package/source/tombstone inspection plus deterministic address resolution. No build/device tests performed by this reviewer; mobile owner owns implementation/validation and parent owns acceptance. Parent authorized the narrow candidate after independently reviewing upstream/stack evidence. No shared decision ID allocated by this reviewer; parent should journal the bounded workaround decision at integration. Changed paths: this report and the two symbolication evidence files only. Current blocker: completed candidate device validation and parent acceptance.
