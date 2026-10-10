# Architecture lane work journal — 2026-10-10 (Asia/Manila)

Owner: database/GIS architecture and future retrieval contracts workstreams G/H.
Parent assigned exclusive canonical/schema-document/test paths; no shared
staging/mobile SQL or existing exporter edits, commits or integration performed.
DEC-040 is parent-assigned and remains provisional pending independent review.

Plan and success criteria: inspect compatible M1/M4 contracts, compare official
database documentation, implement additive typed canonical migrations and
deterministic disposable setup, preserve UUID/source/rights/temporal semantics,
produce logical-domain mapping and retrieval spans, distinguish portable/parser
tests from live database evidence. Risk: no database runtime; code cannot be
accepted as a validated replacement. Risk: candidate domain relationships or
copyrighted text leaking through publication; retain private tables, deny PUBLIC
access, exact fact/geometry/text bindings and conservative rights gates.

Why: the accepted portable SQLite bridge is operational and should continue.
The canonical target adds transactional spatial review, temporal tenant and menu
relations and document provenance without changing mobile pack trust. How: four
versioned isolated PostGIS migrations, manifest-bound runner, disposable database
marker, atomic locked apply, rolled-back synthetic runtime assertions and
document span helpers. SQL source/rights/actor flags are assertions of reviewed
evidence, not legal grants or authentication. No actual sources are cleared.

Primary technical documentation researched: PostgreSQL constraints/functions/
licensing/full-text, PostGIS spatial predicates/install licensing, SQLite
FTS5/RTree/public-domain notice, DuckDB concurrency/Parquet/MIT, Neo4j data model
and pgvector's own repository. Technical leads and selected URLs are recorded in
`sources.json`; no raw BGC dataset, menu, photo, live feed or embeddings acquired.

Rejected alternatives: replace validated SQLite immediately; assume psql/Docker
installed; use graph/vector services for speculative future AI; identify a
branch by name/coordinates; treat a close point as a route; label a parser run a
database migration test; grant rights from public web visibility; reset old
PostgreSQL directories or real data. Program Files PostgreSQL 17/18 directories
had only prior data, no checked executable; they were inspected at directory
level and left untouched. Service inspection failed because Service Control
Manager access was unavailable; no escalation/installation was attempted.

Initial portable run: 12/14 PASS, 1 temporary-directory sandbox permission error,
1 incorrect expected SQL-function count. Corrected test temporary paths to
ignored workspace-generated storage and counted actual SQL functions. Later
meaningful rights helper and remote libpq regression increased the final suite
to 15. Final canonical suite 15 PASS, including three PostgreSQL syntax/parser
tests; existing M1 suite 25 PASS. Grammar parser: pglast 7.10 installed only under
ignored generated dependencies; Python 3.13. Portable tests also run without it,
explicitly SKIPPING three parser checks. See exact logs and `validation.json`.

Independent geography review found borrowed node/stop/edge geometry, caller/
temporary search-path shadowing, fabricated same-length passage, dropped parent
introductions, migration read/hash race, placeholder rights metadata and libpq
remote hostaddr/service inheritance. Corrected each in owned code and added
portable or runtime counterexamples. Parent must still run PostgreSQL/PostGIS
tests to validate actual execution. Runtime `migrate.py apply` actually exited 3
with `psql unavailable ... runtime NOT_RUN`; no local database was created.

Known limitations: PostgreSQL bridge/export is unimplemented; runtime constraints,
query plans, backup/restore, concurrent review, authentication/role provisioning
and Android performance are untested. Several static transit/hours/amenity JSON
payloads only bind fact subject/property and have no implemented live typed
publication endpoints. Source transformations and raw/extracted artifact
correspondence require trusted ingestion and independent QA; an administrator
can still provide false evidence. Historical rights replay and category-specific
freshness policy approval are not implemented; existing explicit per-fact/
evidence/policy validity must not be treated as an approved universal expiry.

Handoff: parent inspect code/dictionary/ERD/setup and hash/test evidence,
independently rerun portable checks, record bounded ACCEPT or changes. Select
runtime pair and execute disposable create/apply/test/reapply/backup/restore
before claiming Gate 2 or replacing SQLite. Data/license, route and publication
acceptance remain withheld; this lane approved/exported **0 real records**.
