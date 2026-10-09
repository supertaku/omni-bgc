# M3 GIS handoff

Final M3 parent decision: PENDING. Exact-source internal intake/mapping already ACCEPTED; no self-approval, commit, shared contract/source register/journal or mobile edit, publication or prior-project mutation.

Implemented fresh gated geographic ingest, original-node candidate graph, complete-vs-render clip separation and quarantine. Owned paths: `pipelines/gis/**`, `pipelines/route-graph/**`, `tests/data-quality/m3/**`, `tests/routing/m3/**`, `docs/evaluations/m3/gis/**`, `docs/architecture/M3_GIS_INGEST.md`.

Raw: 11,486,215 bytes, SHA256 `c7c77bdee83947293624a3a6036089e809c2fb2c1cec4d5283fb1c89535a8ac3`; 21,290 elements: 4,720 nodes / 16,184 ways / 386 relations. Historical ODbL raw, © OpenStreetMap contributors, official OSM map API origin; age at intake 24.74 days. Parent approval binds sidecar/query/old-boundary metadata/M1 scope/random persistent UUID map. No API requests or historic request-policy certification.

Outputs: **1,381 complete ways; 474 pilot render ways; 1,353 context points; 2,569 candidate graph nodes / 3,249 edges / 8 components / 0 navigation-eligible edges**. All raw way geometry passes structural checks. Zero coordinate conflicts, duplicate type/ID or selected coincident geometry groups; no silent merges. All relations quarantined: 222 incomplete memberships, 164 unsupported reconstruction. Counts are not coverage or world correctness.

Diagnostics: 73 pilot-boundary crossings; 117 ingest-boundary crossings; 16 visual intersecting way pairs without a source junction, none invented. Two components contain pilot nodes: 746 in a larger 2,327-node component and six in a separate six-node component. 4,276 selected-way node refs lack top-level node records; original embedded geometry retains coordinates/IDs while absent node tags remain unknown. Full-way retention does not resolve outside connectivity or route permission.

**21 tests PASS**: 8 geometry, 8 topology, 5 gate. **Eight files reproduce byte for byte** across two runs. Separate output checker verifies every edge against original way sequence, WGS84 geometry, render clip membership, navigation denial and independent geodesic comparison (max projected relative difference 0.00014878). Prior-project output guard rejects before writes; `git check-ignore` confirms sample ignored. Logs and `validation.json` retain exact output hashes and QA. Python 3.13.7, Shapely 2.1.2 / GEOS 3.13.1, pyproj 3.7.2 / PROJ 9.5.1; PROJ network false.

Next Android internal packaging sample: ignored `data/generated/m3/run-a/render-ways.geojson` and `context-points.geojson`; complete way layer for audit/context. Candidate graph cannot navigate. Offline resource/device proof NOT_RUN (M5); field/access/entrance verification NOT_RUN (M9); canonical route UUID/import migration deferred. Dataset distribution/production/legal clearance not granted. Relation geometry holes/complex areas remain absent. No claim to have rerun unchanged mobile/native/security tests.

Development failures retained: initial synthetic test assumed analytically exact buffer bbox to 1e-6; rounded polygon differed 7 mm, corrected to bounded approximation plus exact 200 m vertex distance. Raw preview used Windows default cp1252 and failed; explicit UTF-8 fixed preview and is enforced. Initial M0 summary hash lookup corrected to exact independent inventory. Final focused checks have no remaining failure.

Draft parent decisions: complete source topology separate from render clips; embedded way coordinates remain source assertions with unknown missing node tags; unsupported relations quarantine; M3 candidate engineering graph may proceed to sample packaging while every edge stays denied until later field review. Parent owns shared decision IDs/journal/integration.
