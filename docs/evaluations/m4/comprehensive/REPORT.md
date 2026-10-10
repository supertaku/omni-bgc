# M4 comprehensive foundation — engineering report

2026-10-10, `codex/m1-m14`, baseline `f77a5f0`. Parent **ACCEPTS bounded local
research metadata, exact historical discovery, portable software and provisional
canonical implementation** after independent review. This is a growing foundation;
comprehensive coverage, real publication and Android integration remain unaccepted.

| Acceptance gate | Status | Actual evidence / remaining requirement |
|---|---|---|
| 1 — Research completeness | PARTIAL | 44 data-source leads, 80 web pointers, 48 recorded searches; 219 zone/category cells have no pointer. Dedicated searches and systematic building/street inventories remain incomplete. |
| 2 — Architectural correctness | PARTIAL | Four additive PostgreSQL/PostGIS migrations; 63 logical domains mapped to 87 tables/views; portable/parser tests pass. Live migration/constraints/roles/backup/restore and the canonical-to-SQLite bridge are NOT RUN or unimplemented. |
| 3 — Acquisition correctness | PARTIAL | Exact historical OSM discovery repeats byte-for-byte; immutable permitted-export adapters and negative cases pass. Merchant/operator/official spatial exports are not acquired or normalized into real canonical facts. |
| 4 — Publication correctness | BLOCKED | Conservative audited local builder passes synthetic rights/lineage cases. Real approved/exported records are zero. Concrete rights, fact/field review and distribution approval are outstanding. |
| 5 — Application integration | BLOCKED | Shared native parser/services and typechecks pass host tests. Current ADB check found no attached device. Android SQLite/search/menu/offline-update evidence is NOT RUN; iOS remains unavailable. |
| Portable engineering validation | PASS | 241 deterministic cases passed across the consolidated suites; one optional historical case skipped in portable run and passed in the separate local 16-case GIS run. App and strict package typechecks pass. |
| Comprehensive Android data pack / public distribution | NOT STARTED | No current comprehensive pack exists. Pilot resources are unchanged; remote reviewed catalogue remains empty. |

## Research, counts and geography

Research covers buildings/complexes, roads/pedestrian infrastructure, access and
barriers, parks/landmarks, parking, cycling, static transport, restaurants/cafes/
menus, malls/retail/grocery, banks, offices/coworking, hotels/residences, healthcare/
pharmacy, education/government, sport/personal care, repair/telecom/logistics,
pet/community/religious services, emergency facilities and accessibility. Restrooms,
drinking water and several tenant/menu subtypes have sparse or missing evidence.
The [32-category scope](../../../../data/research/m4/program-scope.json) records
the proposed taxonomy and explicitly excludes events and live information.

Counts are different observation types and **must not be added into a business count**:

| Inventory | Count | Meaning |
|---|---:|---|
| Business/menu/facility web pointers | 60 | 30 source leads; names/URLs and field evidence only |
| Geographic/transit/facility web pointers | 20 | 14 source leads; uncertain district membership retained |
| Combined web pointers | 80 | 10 same-name review groups; no automatic merges |
| Historical OSM raw elements inspected | 21,290 | Exact September 14 raw acquisition; all types |
| Historical OSM candidate source objects | 20,103 | 3,548 named; 368 repeated-name groups; not distinct establishments |
| Real records approved / exported | **0 / 0** | No real intake promoted and no comprehensive mobile export |
| Real navigation-eligible graph edges | **0** | No inferred safe route, crossing or entrance |

Historical overlapping category counts: 11,473 building outlines (345 named), 179
building parts, 2,044 places/facilities, 4,662 highway objects, 167 static-transit
objects, 2,180 access/barriers, 869 landscape/water objects. Duplicate source
identities and rejected raw records: zero; repeated names remain separate. Full
original refs/coordinates/timestamps are retained in the ignored 19,981,911-byte
local discovery JSONL; SHA256 is in the geography summary. Contributor/contact
metadata is minimized. No geometry centroid or canonical UUID is invented.

Investigated named partitions: central High Street, Market/Aura east, Uptown
north, northern institutional, Burgos/Forbes west and southern BGC, with external
transfer context and unassigned observations. These are research buckets without
approved legal polygons. Historical envelope `[14.537,121.04,14.563,121.0602]`
(south/west/north/east) includes surrounding context and does not prove legal
district membership. Every zone remains incomplete; census denominator and
coverage percentage are null. The 219 empty matrix cells are pointer gaps, not
evidence that the corresponding facilities do not exist. Existing 290 pilot
leads are not added to the new full-envelope objects or treated as a census.

## Rights, evidence and source blockers

All web source data/content grants remain UNKNOWN. Restricted sources retain
minimal bibliography; page bodies, descriptions, menus, prices and photographs
were not retained. Business inventory records independent automation, retention,
transform, fact/text/menu/image, offline/redistribution and expiry dimensions,
failed access and permission tasks. Geographic sources similarly distinguish
ODbL historical reuse, mixed dataset licensing and layer-specific unknown rights.
Metadata hashes do not pretend to hash unavailable source bytes.

Primary source findings and exact URLs are in the two research handoffs. TONI&GUY
automation terms, Shangri-La stored-content permission and PSE personal-use
limits require review before acquisition. SM Aura/KMC/BCDA access failures,
dynamic locators, unavailable menu responses and absence of a discovered current
official BGC GTFS export were recorded without bypass. Neither public access nor
robots grants permission. NAMRIA/Geoportal layer terms, Overture mixed upstream
licenses, merchant menus/media and operator transit reuse remain unresolved.
No paid service, contact, licensing application or public distribution occurred.

The prior entity-manifest checksum mismatch was investigated and remains
**QUARANTINED_UNEXPLAINED_NO_REUSE**: exact bytes match the prior M0 audit; none of
four serialization probes matches the claimed content hash. Owner regeneration
history is unavailable. No checksum or ID was rewritten to make it pass. All nine
existing pilot resource hashes match, independently of native rendering proof.

## Architecture and implemented modules

DEC-040 selects PostgreSQL/PostGIS as the **provisional canonical production
target**, with immutable permitted raw snapshots and versioned offline SQLite
FTS5/RTree projections. Relational evidence/history, temporal branch occupancy,
typed menus and spatial review fit that target. Existing SQLite intake/export
remains operational until live target validation and bridge implementation.
DuckDB/Parquet is an optional later analytical tool; a separate graph/search
service adds unmeasured identity/rights/operational complexity. No accepted
staging/mobile schema or ID was silently changed.

Implemented additions:

- Canonical migrations 001 governance, 002 domains, 003 publication and 004
  exact bindings; checksum-aware, loopback-only marked disposable runner; rollback
  runtime assertions; normalized dictionary/ERD; authorized source-text sections
  and exact Unicode passage hashes/citation IDs. Runtime is **NOT RUN**.
- Research aggregation, gap/zone/source matrices, manual same-name suggestions;
  positive-permission immutable CSV/JSON/GeoJSON/GTFS Schedule format capture.
  Exact OSM discovery is a source-specific adapter. Generic format staging is not
  a merchant/operator scraper or GTFS semantic/official-feed validator.
- Portable exact GIS evidence gate; immutable local SQLite proposal builder with
  full retained identity/fact/evidence-link/snapshot/coordinate membership checks,
  atomic output, repeat checksums and separate personal state.
- Evidence-linked read-only Python services and native services over the existing
  current store, structured exact menu prices, explicit tag filters and citations;
  stale relationship exclusion. Existing Map/Search/Places/Menu/Transit interfaces
  continue to share that store. No new native runtime result is claimed.
- Extended existing read-only review dashboard with research, evidence/rights,
  coverage and identity/freshness queues. Portable CI adds new suites and pinned
  PostgreSQL grammar parser; remote CI itself was not run.

The [canonical architecture](../../../architecture/M4_CANONICAL_DATABASE.md),
[retrieval contracts](../../../../packages/database/M4_RETRIEVAL.md) and
[acquisition workflow](../../../../pipelines/etl/research/README.md) explain setup
and practical limits. Lexical SQL/FTS and evidence-linked document passages make
future assistant integration possible. **No AI inference, RAG, embeddings, vector
index, planning or in-app agent orchestration is implemented or installed.**
Document rights and citation spans remain governed like other source facts.

## Validation and acceptance limits

Final consolidated [results](validation/results.json) preserve exact commands,
exits, counts and logs: governance14, M1 25, GIS15 plus1 skipped, topology8, M4
intake30, mobile projection10, research13, raw-inventory12, retrieval/export20,
canonical/parser15, native pure contracts22, resume11, native retrieval7,
routing27, UI8 and itinerary4. Final app typecheck and strict domain/geo/routing
typecheck pass. The optional historical GIS run passes all16 locally. Geography
byte audit independently checked all20,103 original records, two identical
discovery outputs and allnine pilot resources. Business structural QA checks
all60 pointers and spot-checks separate branches. These tests do not verify
current businesses, grant rights, execute PostgreSQL or prove native behavior.

Independent review found and corrected stale menu/building relationships,
currency-only filtering, duplicate JSON keys, unretained injected fact/evidence
export, collapsed exact citations, nested document text loss, misbound geometry/
passages, migration byte reread and inherited libpq remote-service defaults.
Initial failing regression fixtures and Windows temporary/connection cleanup
failures were corrected; no failed run is counted as a final pass. See parent
journal and independent reviews. A wrong validator path initially failed and
was rerun using the actual script. No unresolved software counterexample remains
within the accepted host-tested scope.

[Host performance](performance.json) uses synthetic 1,000/10,000-entity content.
At10,000 entities the final warm medians were0.310ms single details,0.711ms lexical
search and5.163ms100m nearby query; SQLite size18,026,496bytes. An initial all-fact
scan took643.794ms for details and motivated restricted lineage reads. Seven
samples per query report median/max, not Android p95. Full listing/menu/native
scans, cold start, memory/power and real geographic pack size remain unmeasured.
Synthetic pack sizes are not projections of actual BGC content.

PostgreSQL preflight returned exit3 because psql is unavailable; no server was
modified. Current read-only ADB check returned no attached devices (sandbox
daemon startup initially failed; authorized local retry succeeded). Android
search/offline/lifecycle, accessibility, memory/battery and current APK tests are
NOT RUN; previous preview APK/device evidence is not a pass for these changes.
Dashboard screenshot and DOM checks confirm English language, labelled focusable
scroll regions, scoped headers, no form controls and no page overflow. Screen
reader/TalkBack testing is NOT RUN.

## Remaining acquisition and closure sequence

1. Complete dedicated source searches for every missing category/subzone, acquire
   an authoritative georeferenced district/scope source, and build independent
   building/street/tenant denominators. Review new scope versions explicitly.
2. Obtain operator/merchant/mall/district exports with snapshot-specific grants;
   authorization precedes contacts, applications or payments. Normalize supported
   IDs/branches/occupancy/menu applicability without name-only merges.
3. Execute live PostgreSQL/PostGIS migrations, adversarial constraints, roles and
   backup/restore; implement and review the canonical-to-SQLite bridge. Typed
   schedules/hours/amenities need fuller payload validators before publication.
4. Conduct current coordinate, entrance, floor, access, crossing and transit-stop
   surveys; independently resolve conflicts/closures and rights. Approve facts,
   evidence and exact source uses separately. Preserve rejected candidates.
5. Generate a real reviewed offline proposal; inspect every source/use/hash/notice,
   expiry and lineage. Request concrete distribution authorization before remote
   packaging. Keep remote trust catalogue empty until then.
6. Validate a current Android build on hardware with offline startup/search/menu/
   citations/map/update recovery, realistic volume, accessibility and lifecycle.
   Verify iOS resource transport independently. Existing security findings remain
   open and are not addressed by this data-foundation task.

No main merge, publication or commits were performed. Changed files remain on the
working branch, with raw/full discovery data in ignored local storage. Parent
approval, checksums, daily journal and artifact index accompany this report.
