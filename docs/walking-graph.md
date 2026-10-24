# Retained-input walking graph candidates

These are engineering candidates, **not an installed or approved walking graph**. The builder uses the retained OSM XML behind the display-context pipeline, not rendered PMTiles, display clipping, building centroids, screenshot pixels or an online routing service. The existing loader/catalog review gates remain unchanged. Every pack, node and edge has candidate review, no field date/reviewer/evidence/expiry, and all graph nodes have unreviewed barrier state. There are no entrance connectors.

## Rebuild and verify

Python 3.13.7 and its standard library suffice; no new dependencies or downloads are needed:

```powershell
python scripts/build-walking-graph.py
python scripts/build-walking-graph.py --corner-fallback
python scripts/check-walking-graph.py
```

Each build writes one deterministic gzip JSON `GraphPack` (`schemaVersion: 1`) and its independent receipt in `assets/generated/walking-candidate/`. Sorted canonical JSON, zero gzip modification time, sorted source traversal and stable source-derived identities make same-environment rebuilds byte-identical. The checker rebuilds both variants in memory and requires exact artifact/receipt equality. It verifies source inventory hashes before parsing, candidate status, valid in-scope coordinates, unique identities, positive edge lengths, endpoint alignment, source segment geometry, direction, retained components, snapshot hash and gzip output hash. The scope and boundary are compared with `src/routing/installed.ts`.

Fixtures cover compatible shared-source corners, grade-separated shared nodes, private/customers/foot=no/motorway exclusions, directional/conditional foot restrictions, unknown gates, fence intersections, unshared rendered intersections, pedestrian reverse direction, vehicle-only one-way direction, zero-length source segments, node/way grade conflicts, pedestrian areas, foot-turn relations and observed-but-unverified entrances.

## Pilot coverage and actual output

Both variants use exactly `omni-bgc:service-area:high-street-pilot-v1`: `[121.0475,14.54865]` to `[121.05205,14.5524]`, with the loader's closed rectangular ring. The larger commercial/display-buffer polygon does not authorize routing. Source segments with an endpoint outside the pilot are omitted rather than clipping an artificial junction onto the boundary.

| Candidate | Nodes | Edges | Weak components | Corner assumptions | Compressed bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `pedestrian.graph.json.gz` | 481 | 530 | 23 | 0 | 56,393 |
| `corner-fallback.graph.json.gz` | 697 | 713 | 59 | 13 | 68,204 |

The fallback contains the same 530 pedestrian-source edges plus 183 assumed street-centerline edges. Adding separate unconnected scaffolds increases the component count; the builder never joins gaps merely to improve a coverage metric. Components are undirected topology diagnostics, not a directed reachability, safety or accessibility finding. There is no completeness percentage: no independent surveyed pedestrian denominator exists.

The retained pilot has **65 tagged crossing nodes and 2 tagged entrance nodes; 0 field-verified entrances, 0 approved edges, 0 surveyed entrance connectors**. Tagged entrances do not establish a public business entrance, access hours, floor, current availability or a usable graph connection. They are never converted into destination records. These pilot counts differ from the wider display-context inventory of 522 crossing observations and 56 entrance observations.

## Source and hash lineage

`assets/generated/context/source-inventory.json` pins sixteen 2026-10-20 OSM grid extracts and six 2026-10-21 source-complete relation supplements: all 22 retained gzip files, their exact sizes and SHA-256 values. The same inventory is already used by `scripts/build-map-context.py`; this builder reads the original XML rather than the context pipeline's geometrically altered display output. Source acquisition remains outside this task. The source grid covers `[121.035,14.530,121.070,14.575]`, including the entire pilot; mapped pedestrian connectivity can still be incomplete.

The graph embeds a `sourceSnapshot` descriptor containing the sorted inventory, source identity, ODbL-1.0 license and **© OpenStreetMap contributors** attribution. `sourceSha256` is SHA-256 of that descriptor's canonical UTF-8 JSON, **not** a fabricated approved manifest or a claim that the concatenated XML has that digest. `sourceSnapshotId` is `omni-bgc:osm-retained:2026-10-20-21`. The source inventory digest and builder digest are recorded separately in each receipt. Graph `sourceEvidence` retains source way IDs, versions, original node-reference sequences, original tags and contributing file names, tagged source nodes and relevant barrier ways. Original coordinates remain recoverable from the hash-pinned XML; accepted graph segments retain their exact original coordinates without rounding or offsetting.

Current hashes:

| Binding | SHA-256 |
| --- | --- |
| Source inventory bytes | `eb0502a6353daf4067997b4b96e9ebd1e2e26f1101c9253b8abc5c00f7f9b0c9` |
| Canonical source snapshot | `a648739e37973de0fdd8954c949385cb66aafe940a7e9c85964e4d793301054d` |
| Canonical pilot boundary | `617a4f2fa2e97005b051161e4ccdb5aafaa4361bdbd8a84f06902907dfed1ce1` |
| Pedestrian gzip artifact | `09dbb73e85c73639d2ea05f0adeec459701063f4364e54ee88fbff80196d0f40` |
| Corner-fallback gzip artifact | `3884a2d2befd5bb5bf51b50dc3b2e5669897c034bd89484806370488ba4c3df2` |

The receipts contain uncompressed payload hashes and all current counts; the embedded snapshot lists every individual source hash. No reviewed catalog or source manifest is populated by this process. Retain upstream attribution/license and the existing internal-preview/distribution restrictions.

## Geometry, access and corner assumptions

The default variant uses source `footway`, `path`, `pedestrian`, `steps` and `living_street` ways. A source segment becomes a candidate edge only when both original endpoints are inside the pilot and its geometry has positive length. Shared source node IDs connect only at matching source grade signatures. Equal coordinates with different source node IDs are never merged. Closed pedestrian areas are excluded because a perimeter does not establish traversable plaza topology. Real source curves survive as consecutive exact source segments; no line-of-sight shortcuts are constructed.

Explicit restrictions and unknown access tokens are conservative vetoes: private/customers/foot=no ways or nodes, motorways, barrier ways/nodes, crossing=no nodes, ambiguous grade tags and foot-specific restriction relation members cannot become eligible fallback paths. Directional foot restrictions veto the entire affected way; conditional access/foot rules are excluded because the candidate does not interpret a timetable. Any retained barrier line intersecting a candidate segment vetoes that segment, including touches; a barrier intersection never becomes a junction. This can reject valid openings and different-grade crossings conservatively until surveyed evidence resolves them. Non-foot turn restrictions and vehicle-only one-way tags do not invent pedestrian restrictions. Explicit `oneway:foot` is preserved; pedestrian-source one-way direction is preserved. Unknown pedestrian one-way values are rejected.

The opt-in `--corner-fallback` adds candidate centerline scaffolds from retained residential/service/unclassified/tertiary/secondary/primary ways that pass the same exclusions. A road keeps its original through-way geometry. Roads share junction topology with other roads or a source pedestrian node only at an actual shared OSM node with at least three distinct retained road arms, a compatible grade signature, and an approximately orthogonal pair of arms (70–110 degrees, using local metric axes). This is the explicit candidate interpretation of horizontal/vertical corner crossings in the rotated local street grid. Each qualifying source node, grade and adjacent source-node list is recorded in `diagnostics.cornerAssumptions`.

**There are no measured sidewalk positions, added lateral crossing strokes, synthetic opposite corners or diagonal connectors.** The fallback records an assumption about pedestrian corner connectivity on the source street-centerline scaffold. Geographic line intersections without a shared source node do not connect. Grade signatures include layer, level, bridge and tunnel; different signatures remain separate even if an OSM node is shared. Missing layer/level default to zero and missing bridge/tunnel to surface solely as an explicit unverified candidate source convention. Unknown/multilevel tags are rejected, and no stair/ramp/lift grade transition is claimed verified. Node-level grade conflicts are vetoed. Steps retain candidate status and provide no accessibility assurance.

Rejection details and counts are embedded in each graph and summarized in receipts. The baseline omits 95 boundary-crossing segments and 10 segments intersecting retained barrier geometry; fallback omits 146 and 10 respectively. Gate/access node vetoes remove 143 baseline segments and 168 fallback segments. Counts mix way-level and segment-level rejection events as labeled in each diagnostic; they are not a census of missing real-world paths.

## Evidence still blocking release

Independent pedestrian field review must establish actual sidewalk/corner/crossing geometry and safe connectivity, grade transitions, barriers and openings, public access/hours, construction conditions and accessibility where claimed. Every approved object needs genuine evidence IDs, reviewer, verification date and validity period. Current source defaults and assumed street-centerline topology cannot satisfy this review.

Destination routing additionally needs verified public entrance identity/coordinates, place association, floor/access facts and surveyed directed connectors to approved edges. There are currently zero such entrances or connectors. Missing or disconnected pedestrian segments require retained geographic evidence, not fabricated joins. Production installation separately needs reviewed source rights/snapshot binding, an approved core pack and local reviewed catalog entry under the existing update gates; this builder supplies none of these approvals.

Host fixtures and exact regeneration establish engineering reproducibility only. They do not establish current street conditions, phone acceptance or permission to operate a device. No network acquisition, OSM raster caching, GPS upload, phone/USB/ADB action or native build is performed by these scripts.
