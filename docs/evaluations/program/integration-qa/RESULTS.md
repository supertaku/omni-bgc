# Integration QA results

Run date: 2026-10-09 (Asia/Manila). This records independent deterministic validation; it is not milestone acceptance.

## Runtime

- Isolated GIS Python: Python 3.13.7, Shapely 2.1.2, pyproj 3.7.2.
- Node executable used for JS suites and TypeScript: `C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`, Node v24.19.0.
- CI is configured for Python 3.13, Shapely 2.2.0, pyproj 3.7.2, and Node 22. Local Shapely differs from the CI pin.

## Deterministic suites

All commands below exited 0:

| Scope | Command | Result |
|---|---|---:|
| M1 governance | `python.exe -I -B -m unittest discover -v -s pipelines/sources -p test_governance.py` | 14 passed |
| M1 synthetic contracts | `python.exe -I -B -m unittest discover -v -s tests/data-quality/m1` | 25 passed |
| M3 synthetic quality | `python.exe -I -B -m unittest discover -v -s tests/data-quality/m3` | 13 passed |
| M3 topology | `python.exe -I -B -m unittest discover -v -s tests/routing/m3` | 8 passed |
| M4 intake | `python.exe -I -B -m unittest discover -v -s tests/data-quality/m4` | 30 passed |
| Mobile SQLite/projection | `python.exe -I -B -m unittest discover -v -s tests/data-quality/mobile` | 10 passed |
| Mobile JS contracts | `node.exe tests/data-quality/mobile/contracts.mjs` | 18 pre-final; 22 final passed |
| Resumable downloads | `node.exe tests/data-quality/mobile/resume.mjs` | 11 final passed |
| Mobile routing + installed loader | `node.exe --test tests/routing/mobile/engine.test.cjs tests/routing/mobile/loader.test.cjs` | 19 pre-final; 27 final passed |
| UI state | `node.exe --test packages/ui/test/*.test.mjs` | 8 passed |
| Itinerary | `node.exe --test docs/evaluations/mobile-ui/test-itinerary.cjs` | 4 passed |
| Strict domain/geo/routing TS | `apps/mobile/node_modules/.bin/tsc --strict --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution bundler packages/domain/index.ts packages/geo/index.ts packages/routing/index.ts packages/routing/progress.ts` | PASS |
| Full mobile app TS | `npm run typecheck --prefix apps/mobile` | PASS on final snapshot |

No M3 raw ingest, pack render/browser check, Android/iOS native build, or device test was rerun in this pass.

## Artifact manifests and shared API review

The final owner manifests for M2 (95 records), M3 (19), M4 (15), mobile data (28), the M9 loader handoff (7), and GIS pack review (7) all had zero missing files, SHA-256 mismatches, or recorded-size mismatches. The original M9 engine manifest is historical; its two changed records (`apps/mobile/src/routing/index.ts` and `TASK_PLAN_AND_WORK_LOG.md`) are superseded by the separate verified `loader-manifest.json`. Mobile UI evidence has 9 records; only `apps/mobile/App.tsx` differs from its historical evidence hash because the parent added its final integration after the UI handoff. The current parent snapshots are 35,956 bytes / SHA-256 `c074ffc26c7533f3ac38c98383085d8ac1b232cd45e3d95295db11dd007edd68` for `App.tsx` and 9,084 bytes / SHA-256 `35d7c1b47feb7c7b02b1730079586fadcad1ba99124c880f21a3bbe76adacf03` for `MapCanvas.tsx`.

Current parent integrations are structurally consistent: `MapCanvas` calls the data lane's `loadActiveStyle(): Promise<string | null>` and falls back to the bundled style when no reviewed style pack is active; `App` refreshes the reviewed graph on boot/resume and before routing, and clears routes on resume/rollback; the routing bridge's route, origin, entrance, and result shapes match app contracts. The single final-snapshot full app typecheck passed. Focused final tests passed: 22 mobile contract cases, 11 resumable-download cases, and 27 routing engine/loader cases. The CI workflow now runs those tests and the app typecheck, alongside the strict domain/geo/routing check.

The parent reported an earlier native release build success (583 tasks); this QA pass did not repeat it. The latest resume sources still require a cached JS rebuild per the M4 handoff. Physical device testing is `NOT_RUN_USER_REQUEST`.

## Current evidence limits

- Real approved pilot business/menu/entrance records: 0 in the M4/mobile-data handoff evidence.
- M2 real participant design study: not run.
- Native Android offline proof and iOS validation: not run.
- Distribution/data rights authorization: false/not granted.
- M3 GIS and M5 pack results are internal candidate/static checks; they do not authorize navigation or dataset publication.
- Physical-device testing is `NOT_RUN_USER_REQUEST`; native build success is not device validation.
