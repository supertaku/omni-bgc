# M4 geography, infrastructure, static transit and offline geography research

Date: 2026-10-10 Asia/Manila. Workstreams A/D and GIS portion of I/F. Implementation pending independent parent review. No commits, publication, new network dataset acquisition or contacts.

## Plan, criteria and risks

Audit exact historical hashes and current pack; discover official full-district source leads; extend only parent-authorized raw discovery; test source/coordinate/minimization/output gates; hand off structured inventories. Success means reproducible candidate records and honest coverage/rights states, not approval of world facts. Risks: historical snapshot envelope is not district authority; source objects differ from branches/buildings; rights cannot follow from public access; entrance/access tags do not establish safe routing.

## Actual outputs and counts

New raw-only adapter `pipelines/gis/research_inventory.py` checks raw/sidecar/query/old boundary before parse and honors `internal-scope-approval.json`. Parent explicitly accepted extension of internal research to the whole original acquisition envelope in this chat under **DEC-041** (parent journal owner). No old code, processed layers, entity IDs or inferred entrance records are reused. Real output remains ignored under `data/generated/m4/comprehensive/geography/run-a` and `run-b`.

| Observation | Count / disposition |
|---|---:|
| Original raw objects | 21,290: 4,720 nodes / 16,184 ways / 386 relations |
| Candidate classified source objects | 20,103 |
| Building outlines / named outlines | 11,473 / 345 |
| Building parts | 179 |
| Place or facility objects | 2,044 |
| Highway/pedestrian infrastructure objects | 4,662 |
| Static transit objects | 167 |
| Access/barrier objects | 2,180 |
| Landscape/water objects | 869 |
| Named classified source objects | 3,548 |
| Same-name review groups | 368, retained separately |
| Duplicate raw identity groups / rejected selected objects | 0 / 0 |
| Approved / exported / navigation eligible | 0 / 0 / 0 |

Category counts overlap. These are historical OSM object counts, including surrounding context and unreviewed whole ways; they are not establishment, branch, unique-building or district completeness counts. Original positions and node references remain exact. Relations remain unreconstructed. No way centroid or entrance location is synthesized. All district memberships UNKNOWN. Historical levels/access/names are source claims, not surveyed floors or current permissions.

Inventory is 19,981,911 bytes, SHA256 `14a5d8ea695de37424e42a0ca756b608ea76c9da89fb194ad1da71de7ceb4334`. All four outputs reproduce byte-for-byte. Separate audit compares every emitted tag, original coordinate/reference, source version/timestamp and negative publication/navigation state against raw originals: 20,103 checked. Twelve portable adversarial unit tests pass. Initial two test errors were Windows sandbox Temp write/cleanup failures; removed filesystem-dependent fixtures and reran successfully. No test-only records entered inventory.

`data/research/m4/geography/source-register.json` contains 14 source leads and technical references. `web-candidate-leads.json` has 20 additional official-web research leads, including parks, public medical service, parking, BGC Bus and external rail terminals. They are not added to the 20,103 count because identity overlap is unresolved. Web coordinates and entrances are all unknown; zero approved. No web page/media/menu bulk capture occurred, so page raw checksums are null rather than invented. Checked dates identify source discovery, not fact verification.

## Historical entity mismatch

Current entity file SHA256 `18d2cc189cf765c664e4190bfeb9bd257ce32437195e8339a05eb5fb7e9c202a` exactly matches independently accepted M0 bytes. Declared content SHA256 `5e401c1814fc43e2b8bd1dfc39588f063d614ed927fc647e52236ba1cf7af652`; canonical `{entities, complexes}` UTF-8 sorted compact recomputation remains `30089f6af014bb4943f97efb838075e8080dfa83359cd5a5224ea81c3671640e`. 31 entities, 2 complexes, no duplicate entity IDs. Four serialization probes fail to explain the declared hash. Prior Git inspection was denied by filesystem access. Owner explanation/regeneration history is absent. Disposition stays QUARANTINED_UNEXPLAINED_NO_REUSE; no IDs or hashes edited. See `current-byte-audit.json`.

## Boundary and geographic zones

Legal BGC district polygon remains UNKNOWN. M1 service boundary remains a project High Street pilot. Historical raw envelope `[south,west,north,east]=[14.537,121.04,14.563,121.0602]` is acquisition context, not a district boundary or a current service-area extension.

[BCDA's 2025 master-plan procurement](https://www.bcda.gov.ph/sites/default/files/2025-09/Bidding%20Documents%20for%20the%20Procurement%20of%20Consulting%20Services%20for%20the%20Preparation%20of%20the%20Updated%20Master%20Development%20Plan%20For%20Bonifacio%20Global%20City%2C%20Taguig%20City.pdf) search excerpt identifies six planning districts and a 240-hectare project area. These are useful authority-backed vocabulary leads; direct PDF fetch returned 403, so polygon/page/version details remain unverified. North Bonifacio, University Park, Bonifacio Center, Station Square East, Bonifacio South and Crescent Park West are retained without invented polygons. Proposed central/north/west/south research labels are separately marked project labels. External EDSA Ayala and MRT station research is explicitly transfer context. See `zones.json`. No percent coverage is reported without a credible independent denominator or reviewed polygons.

## Sources and rights

[Geofabrik Philippines](https://download.geofabrik.de/asia/philippines.html) is a read-only regional extract lead; no PBF acquired. Historical OSM remains bound to ODbL, attribution and exact accepted bytes. Future acquisition must review endpoint policy and pinned snapshot before download. OSMF public raster caching remains prohibited. [Overture attribution](https://docs.overturemaps.org/attribution/) offers buildings/transport/places leads with theme/source-specific licenses; no files or BGC counts acquired. Joining mixed sources needs derivative/collective rights review. [NAMRIA Geoportal](https://geoportal.gov.ph/) offers layer discovery; layer rights, datum/CRS, current ownership and permitted export remain UNKNOWN. No account request submitted.

[BGC permanent-attraction directory](https://bgc.com.ph/go/play/), [district FAQ](https://bgc.com.ph/faqs/), [Track 30th rules](https://bgc.com.ph/directory/track-30th/), [Mind Museum visitor guide](https://www.themindmuseum.org/visit-us/plan-your-visit), [St. Luke's public emergency service](https://www.stlukes.com.ph/health-specialties-and-services/institutes-departments-centers-and-services/emergency-service) and [DOTr-MRT3 static station map](https://www.dotrmrt3.gov.ph/station-map.pdf) are official-owner leads. Intended storage, transformations and offline redistribution remain UNKNOWN; authority of a fact and permission to distribute are separate. Track 30th's posted restriction on cycling demonstrates why a generic district bike-lane claim cannot approve park traversal. No photographed rules/menus, current fares or hours were imported.

## Static transit and graph contract requirements

No current official BGC GTFS feed was found in targeted official-domain searches. This is an observed search gap, not a claim that none exists. BGC FAQ provides service/terminal leads but no exact current stop sequence, stop coordinates, trips, fares or calendar. [JICA TOD study](https://openjicareport.jica.go.jp/pdf/1000056131.pdf) is an official planning-context lead, not a current operator feed. Older Sakay GTFS is explicitly modified from DOTC material and is not current official BGC operator data; its [mirrored DOTC license](https://github.com/sakayph/gtfs/blob/master/LICENSE.md) has purpose-limited, revocable obligations. Neither feed nor license lineage was approved or downloaded.

Implement permitted static intake against [GTFS Schedule](https://gtfs.org/documentation/schedule/reference/): versioned agency/routes/stops/trips/stop-times/calendar or calendar-dates, frequencies, shapes and optional pathways/levels. Keep operator feed vs authorized local transcription vs reconstructed candidate separate. Preserve `Asia/Manila`, GTFS times exceeding 24 hours, ordered stop sequences, source snapshots/evidence, service validity and review state. Unknown headways must not generate fabricated timed trips. A shape is not a walking route. Stop poles/platforms/entrances differ; transfer-path accessibility and rights need independent evidence. No GTFS-Realtime module.

Walking graph admission needs original node topology, reviewed access/grade/crossing/barrier/level/incline/hours, verified public entrance and current observation. Unknown crossings, private passage, missing node geometry, inaccessible entrances or source-only `foot=yes` remain excluded. No snapping or graph promotion implemented in this lane; existing A* contracts preserved.

## Offline pack audit and native risk

All nine currently generated pilot resource byte lengths/SHA256s match `offline-pilot-inventory.json`: 27 tiles, 548 historical geometry records, 212,121 resource bytes, zero eligible navigation edges, distribution unauthorized. Manifest SHA256 `2fa53a5bd54425bad58b86d592fd69baf687ac048a982e3e1e7489ed96cae808` remains exact. Prior all-tile geometry QA is evidence already reviewed under M5; this lane reran byte fidelity, not native/device rendering. Illustrative heights remain explicitly visual.

Current [MapLibre Android documentation](https://maplibre.org/maplibre-native/android/examples/data/PMTiles/) supports PMTiles local absolute file and asset URLs from Android 11.7.0. It explicitly distinguishes archive sources from OfflineManager pack downloads/caching. RN dependency is pinned 11.5.0 in repository; bridge/native artifact and iOS parity cannot be inferred from its package version. Existing installed-resource/update trust must continue handling archive/glyph/sprite/style atomicity itself. Physical cold-offline render, corrupted pack recovery, storage pressure and iOS remain unverified; new research does not change those gates.

## Coverage and remaining gaps

| Category | Status | Gap |
|---|---|---|
| Full-envelope raw geography discovery | PASS bounded engineering | Candidate source objects only; independent parent acceptance pending |
| District legal polygon / planning zone polygons | BLOCKED | Authoritative georeferenced evidence and direct procurement document access |
| Buildings/floors/complexes/tenant links | PARTIAL | Raw/name leads; branch identity, authorized directories and floor/entrance observations |
| Parks/landmarks/parking/static facilities | PARTIAL | Official leads; exact locations/public facilities/access/rights unresolved |
| Sidewalk/crossing/accessibility/cycling | PARTIAL | Raw tags and rules leads; no surveyed safe network or site-specific bike-rack inventory |
| Restrooms/drinking fountains/police/fire/help desks | PARTIAL | District FAQ/OSM category leads; no independently verified full-zone facility inventory |
| Current static transit feed / routes / stops / fares | BLOCKED | Operator export/permissions, stop/entrance surveys and dated schedules |
| Native Android/iOS full district offline map | NOT STARTED | Existing pilot checks only; source/data rights/device proof |
| Approved publication | BLOCKED | Zero approved facts, human rights clearance and user distribution authorization |

Every named planning/research zone has unknown denominator and unknown verified coverage. Search discovery reached district-wide official references, but systematic per-building/per-street surveys and zone audits remain incomplete. Do not claim Gate 1 full research completeness or any real-data publication gate passed.

## Search log and rejected alternatives

Targeted queries covered official BGC bus/routes/parks/parking/terms/GTFS; BCDA BGC area/masterplan; NAMRIA/Geoportal layer/download restrictions; Taguig official cycling; official hospital, Mind Museum and MRT3 access; Geofabrik/Oveture licenses; GTFS/MapLibre documentation. Search results from Google Maps, blogs, Reddit, unrelated BGC financial-company terms and commercial commute aggregators were not used as directory facts. Failed BGC `/go/transportation/` lookup was recorded and not guessed into a source. BCDA 403 was not bypassed. BGC terms search found no applicable explicit grant; rights stayed UNKNOWN. Public access/robots alone were rejected as a license. No loops, paid data, contacts, events, live feeds or restricted tiles.

Tools: Python 3.13.7 isolated `-I -B`, stdlib-only new inventory/QA; web browser research on listed sources; existing current pack read-only. Prior library runtime is used only as Python launcher. Daily work/rationale: reuse exact accepted immutable raw for discovery because it avoids new endpoint acquisition; reject old processed buffers/centroids/entities because they lose access/topology or fail checksum; preserve stable source refs instead of inventing canonical UUIDs. Recommended parent decision: accept bounded raw discovery implementation after independent rerun; retain legal boundary/rights/current-world/device gates; assign field and source rights review next.

## Handoff paths and reproduction

Changed paths: `pipelines/gis/research_inventory.py`, `tests/data-quality/research-gis/test_inventory.py`, `data/research/m4/geography/**`, `docs/evaluations/m4/comprehensive/geography/**`. Existing GIS/manifests/mobile/schema untouched.

Reproduce inventory into new ignored child directories using Python `-I -B pipelines/gis/research_inventory.py --output data/generated/m4/comprehensive/geography/run-c`. Run `tests/data-quality/research-gis/test_inventory.py` with the same interpreter. `audit_current.py` independently checks historical entity mismatch, all nine current pack resources, all original record values and run-a/run-b byte reproducibility. Tracked summaries contain aggregates; real geometry/tag/name-review inventories remain local ignored files.
