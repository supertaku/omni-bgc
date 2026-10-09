# M3 internal GIS ingest

Status: PENDING_PARENT_REVIEW. Exact raw intake and engineering UUID mapping have parent ACCEPT at `docs/evaluations/m3/parent/INTAKE_APPROVAL.json`; internal processing only.

Fresh `pipelines/gis/ingest.py` uses stdlib, Shapely and pyproj. No prior source code is read/imported/executed/copied. Installed prior virtual environment is an isolated `-I -B` library runtime only; PROJ network is disabled. No downloads, raster tiles or global installs occur.

Before parse, check current exact raw/sidecar bytes, parent ACCEPT, query and original boundary metadata hashes, immutable intake/map bytes and the M1 scope. Changed accepted bytes fail closed. Old boundary is lineage metadata only; no prior polygon is adopted. M1 internal gate passes; no legal/redistribution decision is supplied. Historical API User-Agent/rate compliance is not evidenced. Future acquisition needs a reviewed read-only extract provider; historical editing-API grid refetch is unauthorized.

Project-defined M1 WGS84 rectangle is projected with explicit longitude/latitude ordering into EPSG:32651, buffered 200 m and inverse-projected. Rounded arcs use GEOS `quad_segs=16`; polygon approximation is recorded. Complete intersecting ways retain outside-buffer portions. Separate pilot-clipped WGS84 rendering geometry never creates graph junctions or authorizes scope excursions. Scope is neither a legal boundary nor a completeness claim.

Node positions come from original records or embedded raw way coordinates associated with original node IDs. Conflicts remove a position; missing coordinates quarantine the full way. Missing top-level node tags stay unknown. Consecutive original references define edges; coincident positions and visual intersections never merge IDs. All geographic/access/grade/barrier/crossing/level/incline/hour tags survive. Contributor user/uid/changeset and contact/website fields are minimized; source version/timestamp, snapshot UUID/hash, ODbL and attribution remain.

Duplicate `(type,id)` pairs quarantine all copies. Invalid/empty/zero-measure geometry and unclosed building rings reject without repair. All relations are quarantined; missing members are separately counted and reconstruction deferred. Duplicate geometry is a review signal, never a silent merge.

Every edge is CANDIDATE and `navigation_eligible:false`, with field/access/safety/current-world blockers, tag knowledge and boundary flags. Source `foot=yes` cannot supply field approval. Roads receive a pedestrian-facility blocker; endpoint restrictions/barriers and unknown permissions survive. Components describe source connectivity; approved navigation graph has zero edges. No route algorithm, entrance attachment, snapping or app API is implemented.

Three accepted random engineering UUIDs persist in the identity map. Way/node/edge candidate IDs are external OSM staging refs, not canonical UUID database records. Later import requires owned versioned UUID mapping/schema migration; M3 does not edit M1 IDs/contracts.

Real datasets exist only in ignored `data/generated/m3/run-a` and `run-b`. `render-ways.geojson` and `context-points.geojson` are actual WGS84 samples for the next Android internal offline proof. They are not a complete resource pack or publishing grant. Relation holes/complex areas are not reconstructed. M5 must prove resources/device storage, and M9 must verify field access/topology and entrances.

Reproduce using `C:\Users\joshu\Documents\BGC\.venv\Scripts\python.exe -I -B` with repository-relative script arguments:

1. `pipelines/gis/ingest.py --output data/generated/m3/run-a`
2. `pipelines/gis/ingest.py --output data/generated/m3/run-b`
3. `pipelines/gis/verify_outputs.py`
4. `tests/data-quality/m3/test_geometry.py`, `test_gate.py` in the same directory, and `tests/routing/m3/test_topology.py`.

Accepted intake is immutable historical evidence. Intake generation refuses overwrite after approval. Output must be a child of ignored M3 generated subtree; attempted prior-project output was rejected before raw parse/directory creation.
