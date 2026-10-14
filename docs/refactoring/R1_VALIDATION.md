# R1 validation — 2026-10-14

**Host gate PASS; overall acceptance PARTIAL.** Base `7b468f3`, local branch `codex/r1-engineering-hardening`. No commit, push, main merge or remote CI execution.

## Reproduction and actual results

Node 22.20.0/npm 11.18.0, Python 3.13.7, TypeScript 6.0.3. Windows PowerShell. Existing pinned Python modules used via `PYTHONPATH`: `.g/ci-python` (Shapely 2.2.0, pyproj 3.7.2, pglast 7.10) and `.g/r1/python-tools` (Ruff 0.17.0). Normal installations follow CI and README requirements.

`python apps/mobile/scripts/quality.py --output .g/r1/final-reviewed`: **31/31 command groups PASS**. Exact commands/cwd/exit codes/logs remain locally in `.g/r1/final-reviewed/results.json` and sibling logs. Initial default-Python baseline: GIS/topology FAIL imports, 23/25 PASS. Pinned baseline: 25/25 PASS. Final failure count zero; no original CI suite removed.

| Gate | Actual evidence |
|---|---|
| Strict application and domain/geo/routing TS | Both commands exit 0 |
| Authored TS/TSX lint | 0 errors, 2 inherited Map camera dependency warnings; no new hook warnings |
| Scoped formatter, Ruff, import audit | PASS; 59 modules/132 edges/0 cycles, baseline 50/107/1 |
| Governance/contracts/GIS/topology/intake/research | All original Python groups PASS |
| Canonical/mobile projection/Python retrieval/export | All original groups PASS; syntax parser present; not a new PostgreSQL server deployment proof |
| Startup/directory/UI/Assistant/map/routing/shared UI | All original JS groups PASS, existing callback and source policy assertions retained |
| Pack manifest/style/resume | Existing 22 pure contracts and resume regressions PASS |
| New R1 contracts | 13 JS tests PASS; 4 real isolated SQLite tests PASS (including 9 rejected temporal/metadata cases) |
| Synthetic AI scorer/coverage | Both existing checks PASS; 120-record byte equality SHA256 `722068e60732a5c72da4416b353550ff765dd030bb14979ae7b3358296d98a30` |
| Exact temporal SQL | SHA256 `e7abda0f87df34eb84dc801b16a2d2476ea2ede197e5d1b6e63bc5d21177b649` unchanged; ordering/lineage/conflicts/dates tested |
| Independent source differential review | All 4 actual map display modes and all 161 current candidate POI features equal baseline outputs |
| Frozen artifacts/runtime dependencies | 610 protected tracked files unchanged; zero existing non-dev package version changes |
| UI/resource gate | `node apps/mobile/scripts/check-ui-program.cjs --v2.1 --output .g/r1/ui`: 11 groups PASS, 7 font/license hashes, 161 candidate records, 11 contrast pairs |
| Map pack resource/lifecycle fixtures | Installed style spec, glyph baseline, sprite/hash/order, copy/reuse/recovery/interruption checks PASS |
| Diff whitespace | `git diff --check` exit 0; Git's CRLF conversion notice is informational |

New tests execute actual extracted hooks, money/map functions and pack manager. Pack fixtures explicitly mock native I/O and use authored TEST ONLY manifests; they do not approve any production catalogue. Two repeated fixture reads cause 2 file reads/32 bytes/2 file hashes/2 manifest hashes/2 balanced index opens/closes. Full verification remains uncached. Native hashing time, content SQLite frequency and cold/repeated query latency remain unmeasured.

AI replay keeps the baseline structural gap inventory (28/120 and one existing raw collection-policy violation). All manual prose judgments remain pending. No model quality, real BGC accuracy or AI tool-security acceptance is inferred.

## Parent review and native risks

Parent source review inspected actual changes, independently reran affected/full gates and compared baseline outputs/artifact hashes. **ACCEPT bounded host implementation**; no integration into main. React review checked hook ownership, subscription cleanup, explicit dependencies, mounted state, accessible labels/controls and unchanged layout/style values. No new runtime framework or speculative cache.

Read-only unrestricted `ai-device-probe.py`: device_count=0, **BLOCKED: connect and authorize exactly one phone**. No APK rebuild/install, app data clear or physical screenshots were produced. Historical UX screenshots are preserved and do not accept this patch.

| Outstanding risk | Status / mitigation |
|---|---|
| Native MapLibre rendering/camera/lifecycle | NOT_RUN; native effects/layers retained, host/resource differentials pass; verify cold map, reset/focus, flat/3D and background/resume on phone |
| Keyboard/Back/pager/selection/conversation | Host callback acceptance only; verify actual Android keyboard, hardware Back, mounted selection/draft and reduced motion |
| Native saved records / pack recovery | Host fixtures and SQLite contracts pass; rerun on existing app with `install -r`, never clear its data |
| Shake/ordinary movement/TalkBack | NOT_RUN; thresholds/sensor/pager untouched; physical calibration/narration cannot be inferred |
| Existing camera dependencies | 2 visible advisory warnings preserved to avoid changing animation triggers without device evidence |
| Explicit refresh/download after unmount | Existing completion behavior retained; boot/timer guarded; separate behavioral fix deferred |
| iOS offline installation | Historical blocker unchanged; no iOS build/runtime claim |
| Remote Actions | NOT_RUN; workflow parity verified locally, no public push authorized |

Host-safe follow-up may proceed. Fresh native acceptance and any public/main integration remain separate gates. R1 does not begin inference runtime selection or subsequent product work.
