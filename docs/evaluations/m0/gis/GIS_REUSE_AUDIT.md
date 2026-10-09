# M0 GIS and prior-project reuse audit

Date: 2026-10-09. Parent review: **PENDING**. Distribution/import approval: **none**.

The prior `C:\Users\joshu\Documents\BGC` project contains useful source snapshots and reproducible CRS code, but its geometry and reconstruction concepts cannot be adopted as a mobile walking dataset without M1/M3 review. The raw OSM snapshot hashes check out. A canonical entity manifest's internal content hash does not. Processed road/path data discards important access and grade-separation tags, and its GeoJSON coordinates are local metres, requiring a deliberate inverse transform before any WGS84 use.

This is a bounded M0 audit, not ingest, graph construction, geographic approval, source refresh, or field validation. Only this audit directory was written. No previous-project scripts were run or imported. No raw dataset, contributor metadata, media, device position, or private contact data is copied into Omni-BGC.

## Evidence and reproduction

- [Per-file inventory](file-inventory.csv): 67 selected files, each with size, SHA256, reuse class, license/lineage status, and `NOT APPROVED` distribution status.
- [Machine-readable QA](audit-results.json): 21 GeoJSON layers, 3 raw snapshots, entity-manifest checks, 18 entrance files, recorded source fields, and 8 synthetic negative cases.
- [Audit implementation](audit_previous_project.py): explicit bounded paths/globs; stdlib plus existing Shapely/pyproj; source read only.
- [Command and daily journal](COMMANDS_AND_JOURNAL.md): tool versions, actual outcomes/errors, rationale, and limits.

Run from Omni-BGC, using the prior project's already installed virtual environment:

```powershell
& 'C:\Users\joshu\Documents\BGC\.venv\Scripts\python.exe' -I -B 'C:\Users\joshu\Documents\Omni-BGC\docs\evaluations\m0\gis\audit_previous_project.py'
```

For independent parent review, append `--output 'C:\Users\joshu\Documents\Omni-BGC\docs\evaluations\m0\parent\gis-rerun'`. Output paths are restricted to this workspace's M0 GIS or parent audit subtrees; trying to write to the previous project is rejected. `-I -B` avoids prior project module imports and bytecode writes. PROJ network is disabled in the observed environment.

## Source snapshots

| Selected raw file relative to prior project | Elements | Type counts | SHA256 verified against sidecar |
| --- | ---: | --- | --- |
| `data/raw/osm/bgc-2026-09-14T162150Z.json` | 21,290 | 4,720 nodes; 16,184 ways; 386 relations | `c7c77bdee83947293624a3a6036089e809c2fb2c1cec4d5283fb1c89535a8ac3` |
| `data/raw/osm/pilot-2026-09-10T134635Z.json` | 883 | 414 nodes; 463 ways; 6 relations | `09dc9d5aea72e11ad8d84d1c8d2e88132c0a5556e7a2f601824a0a7a74d4adcd` |
| `data/raw/pilot-osm.json` | 845 | 404 nodes; 436 ways; 5 relations | `97f5c3ded03f0efa37a7ef12ede12a6645c3fcde8d0b0777f15c45cca06dee7c` |

All three element counts match sidecars and have zero duplicate `(OSM type, id)` signals. The newer two sidecars' query and boundary hashes also match. The older pilot sidecar supplies neither query hash nor boundary hash: those checks are **not available**, not passes. All 18 selected processed layers' declared raw source hashes resolve to the two newer snapshots; this verifies header references, not regeneration or every feature's factual accuracy. The two stored data-audit manifests' raw hashes and selected layer counts are consistent with the new audit.

Sidecars record ODbL 1.0 and attribution, with September 10/14 retrieval dates and Overpass/official OSM map API endpoints. The audit did not refresh sources or confirm present-day businesses/access. Source identity does not establish real-world correctness. Official OSM documentation describes its data license and attribution requirements; distribution needs a project-specific review of those obligations. [OSM copyright and license](https://www.openstreetmap.org/copyright). Public OSM raster tile bulk/offline acquisition is prohibited and was not performed. [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/).

The compatibility source registry has 8 records; the newer source registry has 51. They are source/license leads, not approved business records. The older registry explicitly describes BCDA/ULI materials as research/reference or reuse-status-unknown, Commons as requiring per-file review, owner sites as generally copyrighted, and user photography as needing a contributor grant. Those statements were observed in local metadata; the audit did not independently clear those sources or reference/media files. An empty local rights-review list cannot establish permission. No root or non-dependency `LICENSE`/`COPYING` filename was discovered by the bounded filename search, so previous-project code/content distribution rights remain unresolved.

## Geometry and CRS

All 21 selected GeoJSON layers parsed; 13,840 feature records were inspected, with zero invalid, empty or missing geometries, zero geometry exceptions, and zero nonfinite positions. This record count includes nested/overlapping pilot and city coverage plus derived surfaces; it is not a count of distinct real places or completeness. Raw coordinate range checks covered top-level nodes and way geometries only: 99,159, 2,742 and 2,530 occurrences respectively, all in global longitude/latitude range. Relation-member geometry and physical-position accuracy were not validated.

The 3 geographic scope files use longitude/latitude. Whole working boundary bounds are `[121.04, 14.537, 121.0602, 14.563]`; pilot boundary and pilot zone both use `[121.0475, 14.54865, 121.05205, 14.5524]`. These are **estimated engineering scope polygons**; local descriptions explicitly deny legal/cadastral authority. Pilot zone and boundary reuse the same scope ID with different role metadata. This audit does not choose a canonical mobile service area.

All 18 processed layers declare upstream `source_crs=EPSG:4326`, `projected_crs=EPSG:32651`, and a local frame with east/north/up axes and metre units. Their actual geometry uses that **local frame**. `source_crs` describes the upstream input, not the coordinates in the geometry. The stored projected origin is `(289998.297, 1609541.742)` m, corresponding to the public engineering datum `(121.050972, 14.550806)`; it is not a device/user position. Restore that offset then inverse-project with longitude/latitude ordering. The documented pyproj `always_xy` option provides that ordering. [pyproj Transformer documentation](https://pyproj4.github.io/pyproj/stable/api/transformer.html).

Bounds below are `[minX, minY, maxX, maxY]` **local metres**. Exact per-layer and inverse WGS84 bounds are also in `audit-results.json`.

| Selected layer | Whole BGC records / bounds | Pilot records / bounds |
| --- | --- | --- |
| Buildings | 7,121 / `[-1131.712, -1515.951, 988.024, 1352.871]` | 39 / `[-383.397, -252.569, 142.08, 199.912]` |
| Roads | 1,824 / `[-1167.61, -1524.53, 990.18, 1346.703]` | 88 / `[-378.942, -240.644, 119.708, 184.889]` |
| Paths | 1,226 / `[-1169.917, -1505.645, 964.837, 1217.305]` | 269 / `[-376.46, -239.986, 118.493, 179.924]` |
| Open spaces | 206 / `[-1181.943, -1353.354, 931.359, 969.145]` | 21 / `[-373.49, -205.479, 115.834, 179.589]` |
| POIs | 2,652 / `[-1177.718, -1380.541, 955.919, 1319.95]` | 383 / `[-369.951, -230.644, 112.481, 177.151]` |
| Boundary | 1 / `[-1181.943, -1524.061, 991.981, 1352.273]` | 1 / `[-376.268, -239.568, 117.698, 179.589]` |

Road/path layer features are polygons/area buffers, with a `centerline_local` property; their geometry is not a routing graph. Each of the six dissolved surface layers is a single MultiPolygon marked `INFERRED`. Buffer extents and some building footprints extend slightly beyond the engineering boundary: this is a clipping/representation decision for later review, not an area-membership proof.

Whole-building heights are 6,749 `PROCEDURAL`, 77 `ESTIMATED`, and 295 `VERIFIED_GEOGRAPHIC` under the previous project's nomenclature. Pilot heights are 18/4/17 respectively. That project's `VERIFIED_GEOGRAPHIC` means present in a cited dataset, not independently field verified. Whole roads have 1,809 estimated widths; whole paths have 1,218 estimated widths. Visual widths and procedural heights must not be promoted into facts.

## Duplicate and manifest findings

No duplicate feature IDs were found within the selected layers. Geometry normalization found one coincident-geometry pair in whole buildings (`osm:way:1123265838`, `osm:way:713418274`) and one in whole POIs (`osm:node:13327327779`, `osm:node:13327382426`). These are unresolved identity signals; none was rejected or merged. Names repeat in 15 whole-building groups, 122 road groups, 9 path groups and 87 POI groups (pilot: 1/8/2/4). Repeated road/path names commonly describe segments; this audit does not determine whether any two records represent a duplicate real entity.

**Blocked entity manifest:** `data/entities/pilot-entities.json` has 31 entities and 2 complexes, with zero duplicate entity-ID signals. Its declared raw source hash resolves, but the internal content checksum does not match the serialization implemented in `scripts/evidence/model.py` and called by `scripts/entities/resolve_entities.py`:

- Claimed: `5e401c1814fc43e2b8bd1dfc39588f063d614ed927fc647e52236ba1cf7af652`
- Recomputed: `30089f6af014bb4943f97efb838075e8080dfa83359cd5a5224ea81c3671640e`
- Method: SHA256 of `json.dumps({entities, complexes}, sort_keys=True, separators=(',', ':'), ensure_ascii=False)` encoded UTF-8.

The cause was not investigated or repaired in the prior project. It may reflect later edits or a stale checksum; that possibility is an inference, not an established cause. Keep the manifest quarantined until an owner explains and validates its lineage.

## Reuse classification and blockers

| Asset group | M0 disposition | What would permit later reuse |
| --- | --- | --- |
| Existing Shapely/pyproj virtual environment | Reusable for this read-only audit | A pinned Omni-owned environment in a later authorized phase; no global installation performed |
| Raw OSM snapshots plus sidecars | Geographic candidates with checked hashes and recorded ODbL | Parent/license review, freshness/coverage QA, data minimization, and approved M1/M3 ingest |
| CRS helpers and normalizer logic | Implementation candidates | Resolve code rights, retain contracts, independent tests, deliberately preserve route access topology |
| Local processed layers | Candidate visual/geographic evidence; direct mobile import blocked | Explicit transformation, factual/source review, estimated-field retention, and graph construction from suitable raw topology |
| Working/pilot boundaries | Estimated scope candidates | Approved documented service boundary, access-buffer behavior and contextual-source rights review |
| Canonical pilot entity manifest | Blocked by content-checksum mismatch | Owner explanation and verified regenerate/review procedure; never silently repair IDs/hash |
| Entrance reconstruction packages | Blocked as navigation endpoints | Field/evidence review and real entrance coordinates with safe graph attachment |
| Synthetic buildings/framework fixture; procedural or inferred 3D details | Fixtures/concepts only | May support explicitly labeled tests/UI concepts subject to code/content rights; excluded from geographic facts |
| Commons/Mapillary/owner/developer/official reference leads | Unapproved metadata/reference candidates | Per-file or per-fact permission, identity, date and reviewer evidence; no photos/maps redistributable by assumption |

The selected raw whole-city snapshot contains 886 `access`, 214 `foot`, 1,726 `wheelchair`, 66 `bridge`, 30 `tunnel`, 43 `incline`, 273 `opening_hours` and 75 `entrance` tags across its top-level elements. The processed allowlist omits these access/grade-separation fields (and node connectivity), and all selected road/path outputs retain zero access/foot/wheelchair/bridge/tunnel/incline/opening-hours tags. Raw counts include features beyond any eventual approved pedestrian subgraph and cannot be read as verified accessible paths. The omission is concrete evidence that these outputs cannot serve as a safe routing authority.

All 18 inspected entrance files together contain only four entries: two `INFERRED` and two `UNKNOWN`, with zero entries having checked coordinate/geometry fields. They are architectural placement concepts; the whole raw snapshot's 75 `entrance` tags are merely source candidates, not field-verified navigable endpoints. No graph archive, PBF, GPKG, SHP, MBTiles, PMTiles or GTFS/transit dataset was found by the bounded `data/` filename search; this is discovery evidence, not a claim that every artifact in the prior project was examined. GLB 3D tiles and viewer navigation are not proof of offline native map resource compatibility or pedestrian navigation.

Open route safety risks: no approved walkable graph, field-grounded crossing/gate/barrier validation, legal access/freshness evidence, entrance attachment, wheelchair constraints, grade separation, manual-origin snapping, or boundary fallback policy. A line intersection alone cannot establish a traversable shared junction. No routing success is claimed.

## Negative cases and handoff

Eight deterministic synthetic checks passed: valid geometry with missing license remains permission-blocked; swapped longitude/latitude fails range validation; UTM metres cannot be treated as WGS84; missing projected CRS stays `UNKNOWN`; `always_xy` roundtrip is correct; two visually intersecting line segments have no shared source node; equal names preserve two distinct IDs; degree-length differs from metric distance. The output-to-previous-project guard was separately exercised and refused the write. These are narrow audit counterexamples, not production validator or route field-test coverage.

Changed paths are confined to `docs/evaluations/m0/gis/`. Parent must independently inspect/reproduce the evidence and explicitly ACCEPT before integration. M0 remains subject to the parent's other native/device/source gates. Follow-up ownership: parent for acceptance/license strategy and journal decisions; M1 for boundaries/IDs/contracts; M3 for any authorized source ingest/transform/topology work; field/human reviewer for route access safety. None of that follow-up was started here.
