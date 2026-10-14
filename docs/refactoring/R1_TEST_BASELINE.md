# R1 test baseline

2026-10-14, base `7b468f3`. Reproducible runner: `python apps/mobile/scripts/quality.py --output .g/r1/baseline`.

Default Python: 23/25 command groups PASS; GIS/topology fail imports because pyproj/Shapely are absent. Retried with `PYTHONPATH` pointing to existing `.g/ci-python` (Shapely 2.2.0, pyproj 3.7.2, pglast 7.10): **25/25 PASS**. Exact commands, exit codes, timings and logs are preserved locally in `.g/r1/baseline-pinned/results.json` and sibling logs. No historical evidence writer was run.

Coverage: strict app/package TS; governance/contracts; GIS/topology/intake/research; Python retrieval/export/canonical/mobile projection; map compatibility; startup/demo; UI/navigation; Assistant/Explore; JS retrieval; routing/loader; shared UI/itinerary; historical candidate routing; pack manifest/style/resume; synthetic AI scorer and coverage. Historical optional inputs are present locally; portable test fixtures remain independent of them.

Existing AI observations/report remain frozen. Evaluation writers were inspected: deterministic-baseline defaults to historical evaluation paths; R1 will add a caller-selected output directory before replay. Structural AI score is an existing gap inventory (28/120), not production model quality. Exact 120-observation equality is the R1 behavior criterion.

Physical preflight under unrestricted read-only execution: BLOCKED, connect and authorize exactly one Android phone. No native tests, APK installation/rebuild or personal device data changes. Existing native screenshots stay historical. R1 host acceptance does not establish physical shake, MapLibre rendering, actual offline native storage or iOS operation.

Protected tracked artifact SHA256 snapshot and baseline import graph are in `.g/r1/protected-before.json` and `.g/r1/dependencies-before.json`; final verification compares exact bytes.
