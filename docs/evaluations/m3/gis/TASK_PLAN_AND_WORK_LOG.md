# M3 GIS plan and work log

Status: implementation pending parent intake ACCEPT. Owner: GIS lane; no shared contracts or prior code edits.

1. Rehash exact September 14 OSM and sidecar, UTF-8 query and bounded original boundary metadata; obtain parent internal intake and persistent engineering UUID mapping acceptance before parse.
2. Write fresh Shapely/pyproj ingest using M1 engineering rectangle and 200 m EPSG:32651 buffer. Keep real outputs in ignored `data/generated/m3`; reject malformed geometries and quarantine incomplete refs/relations.
3. Build CANDIDATE topology only from consecutive original OSM node references; retain full ways/tags and separate clipped rendering geometry. Every edge remains navigation blocked pending field/access review.
4. Run deterministic synthetic geometry/topology adversarial checks and exact two-run output comparisons; report counts, duplicate/quarantine signals, cut edges/components, source/license hashes and sample QA.
5. Supply owned manifest, architecture, draft journal/decisions and handoff to parent. No self-accept, commit, data publishing or M5 advancement.

Success requires gate enforcement, reproducible actual WGS84 geometry and original connectivity, evidence rather than route safety claims. Risks: geometries may embed coordinates without complete node records; relation completeness and clipping can disconnect components; stale data and unknown access cannot prove walkability. Preserve uncertainties and emit review queues.

## 2026-10-09 intake

Read AGENTS, M1 handoff/APPROVAL/governance, M0 GIS audit/handoff/parent review, relevant implementation plan and M1 domain/geo/source contracts. Read only exact prior raw sidecar and bounded boundary metadata, streaming raw bytes solely for SHA256. Raw 11,486,215 bytes matches audited `c7c77b…8ac3`; sidecar 2,397 bytes `d749bc…c611`; query and original boundary hashes match. Original polygon is not adopted. Timestamp is September 14; current-world facts remain unverified. Initial parent-evidence lookup expected hash in summary; summary has only counts, so lookup corrected to accepted M0 independent rerun inventory's exact raw row. No raw OSM parse yet.

WHY: actual bytes/lineage and bounded internal grant precede derivation. HOW: new stdlib streaming intake; existing isolated BGC virtual environment is library runtime only, `-I -B`; previous project remains read only. Rejected: old processing code, processed polygons, entity manifest, inferred entrances, global installs and public raster acquisition.

## Internal derivation and focused validation

Parent exact intake/mapping ACCEPT read and rechecked before UTF-8 raw parse. Fresh metric-buffer/geometry/topology pipeline written; all outputs confined to ignored generated M3 subtree. 21 focused tests pass, all eight generated files reproduce exactly, separate output checker confirms 3,249 original-reference edges and WGS84 render clips. Tools: Python 3.13.7, Shapely 2.1.2/GEOS 3.13.1, pyproj 3.7.2/PROJ 9.5.1; network disabled. 386 relations quarantined, navigation eligible edges zero; field/offline/device tests deferred. Corrected synthetic analytic-buffer expectation (7 mm arc discretization) and default Windows cp1252 preview decoding failure. Output guard rejected prior-project destination. WHY: preserve source topology and distinguish display clipping from permission/safety. HOW: deterministic sorted canonical JSON and exact two-run checks; original source IDs remain external candidate refs, no database import. Rejected geometry repair, geometric junction merging and roads-as-safe-route default. Final M3 parent review pending; handoff and draft decisions supplied.
