# GEX-1 / GEX-2 internal historical geometry handoff

2026-10-14. Ready for parent review of the bounded internal implementation. This is an engineering candidate artifact, not an accepted world-fact inventory, public dataset, routable graph or device-validated release. GEX-0's revised engineering envelope is bound to `parent-review-r2.json`; the geographic pipeline does not grant any additional approval.

Owned paths: `pipelines/gis/expansion/ingest.py`, `pipelines/gis/expansion/validate_geography.py`, `tests/data-quality/gex/test_ingest.py`, this handoff, and ignored `data/generated/m4/comprehensive/geography/gex-geography-*`. No mobile/pilot assets, canonical database/schema, office/food work, shared journal, source approval or permissions were edited.

## Task plan and evidence

Success criteria: retain original source identities/complete geometry; rebuild valid multipolygons strictly by node endpoints including holes; separately clip display geometry; explicitly exclude four reviewed exterior residential identities; preserve building relations/parts; reconcile source counts; create zone, overlap, connector, coverage and anchor review evidence; prove identical regeneration. Risks: historical source facts, incomplete relations, floating-point boundary predicates, missing physical-device and current-world evidence. The exact historical `research_inventory.authorize()` raw/sidecar/query/prior-boundary gate remains unchanged and executes before raw parse. No new acquisition was necessary for this bounded historical experiment; the historical snapshot is not a current-world completeness denominator.

Frozen final output: `data/generated/m4/comprehensive/geography/gex-geography-r2/`. SHA256 of `artifact-manifest.json`: `02cf39d563b4de9abc5bde7661f065fa68e9ca7327445db5dd867eb321d4f298`. Exact service manifest SHA256: `f6cbcc7b33ad4a53821858dc4c3c56e13f30997aad082fcb9fb189eddc5f9db9`. Exact historical raw SHA256: `c7c77bdee83947293624a3a6036089e809c2fb2c1cec4d5283fb1c89535a8ac3`. Individual artifacts, context, exclusion, zones, accepted scope review, pipeline and source checksums are bound in the artifact manifest. Intermediate r1 is preserved and superseded because the parent revised the scope; do not package r1.

Actual raw reconciliation: 21,290 original objects = 10,019 retained complete geometries + 10,932 valid geometries outside acquisition + 333 quarantined objects + 6 membership-only building relations. Retained: 6,936 ways/multipolygons and 3,083 tagged source nodes. Display: 2,641 way/relation pieces and 2,259 service-only tagged points. Twenty-three source multipolygons were reconstructed. Quarantine: 7 missing-member multipolygons and 326 unsupported relation-geometry types; all retain original identities and reasons. Duplicate identity groups and coordinate conflicts: zero in this snapshot. No source repair, snapped endpoints, invented source nodes, silently merged IDs or approved navigation edges.

Review evidence includes 162 source road cut-edge records, 68 visual road crossings without shared source junctions, 161 building-part containment candidate associations, 194 intersecting building/part footprint pairs, duplicate-geometry groups, explicit relation-member render supersession, per-zone category inventories, a bounded coverage grid and exact comparison of all 21 frozen priority anchor geometries. Source site `osm:way:97061942` remains complete with the crossing flag; it is not conflated with the mall building or tower. Geometry containment is not tenant occupancy, a verified entrance or canonical tower identity. Raw/zone counts are source-object counts, never physical-building/business census figures.

`osm:way:28541386`, `osm:way:28993541`, `osm:way:28997881` and `osm:way:1476336381` retain complete source geometry but cannot enter rendering. Service detail clips all other geometry to the reviewed polygon. Only explicitly selected major-road classes may render in the outside context ring; these use `:context` display IDs and `LIMITED_CONTEXT`, with the original `source_ref` unchanged. Context and detail clips are separate; no context buildings or place points are exported for display. Original source tags needed by the map pack, including building heights/parts and safety/grade/access tags, remain available. Contributor account and contact data are omitted.

## Validation

Twenty adversarial host tests PASS. They cover reversed endpoint stitching, holes, multiple disconnected shells, unsupported/missing/duplicate members, wrong endpoint IDs at coincident coordinates, missing/conflicting nodes, explicit area closure, natural-water polygons, complete source vertex retention, exact service/context clipping, explicit residential identity denial, crossing topology/grade tags, part ambiguity, duplicate geometry, immutable writes, exact authorization-before-parse and real mask leaks beyond numerical tolerance.

Serialized verifier PASS: 10,019 complete features, 4,900 display features, exact raw/source/scope/review/resource hashes, canonical JSON, source vertex sequences, no superseded-member rendering, no denied identities, exact source clip reconstruction and all 21 frozen-anchor geometry comparisons. A separate build into `gex-geography-r2-rebuild` produced byte-identical contents for all 13 files including the manifest. Runtime reused without upgrades: Python 3.13.7, Shapely 2.2.0, pyproj 3.7.2 from `pipelines/map-pack/.venv`.

Initial test attempt using the host sandbox's default temporary directory failed with filesystem permissions; tests now use a bounded temporary directory in the ignored repository subtree. Initial strict `covers()` QA flagged floating-point GEOS clip boundary slivers. The geometry remains untouched: validation now independently checks exact clip equality and measures at most 0.000001 m² polygon outside area or 0.00001 m line outside length in UTM51N. Actual initial maximum was 0.0000000652 m² / 0.00000000316 m. Tests reject real metre-scale leaks. Existing `shapely.ops.transform` deprecation warnings are observed; no runtime upgrade was made.

Reproduce from repository root with the existing runtime:

```powershell
& pipelines/map-pack/.venv/Scripts/python.exe -m unittest discover -s tests/data-quality/gex -p test_ingest.py -v
& pipelines/map-pack/.venv/Scripts/python.exe pipelines/gis/expansion/ingest.py --output data/generated/m4/comprehensive/geography/gex-geography-r2
& pipelines/map-pack/.venv/Scripts/python.exe pipelines/gis/expansion/validate_geography.py --output data/generated/m4/comprehensive/geography/gex-geography-r2
```

The same-output generator permits only byte-identical no-op regeneration; changed inputs require a fresh revision. The raw geometry remains ignored and immutable. ODbL attribution and exact source lineage are retained; distribution authorization remains false.

## Parent review and limits

Parent should independently inspect the source reconstruction, clip/source identities, four residential exclusions, quarantined relations, priority footprint comparisons and connector queues before accepting GEX-1/GEX-2's internal artifact. Geographic confidence for source-derived candidates remains separate from accepted engineering scope. Buffer adequacy for navigation and current-world coverage remain unknown. No routing is approved, no company identity or floor count conflict is resolved by this pipeline, and no public release is authorized.

The map-pack agent has the exact r2 source manifest contract and verifies it independently. Physical app tests, Android measurements and offline device restart evidence were not run. USB debugging was not used and requires the user's explicit confirmation before any later device step. No commit, push or merge was performed.
