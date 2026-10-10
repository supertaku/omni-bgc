# Independent canonical/GIS review — 2026-10-10

Reviewer: geography lane, read-only against the architecture lane's stable code.
Recommendation: **ACCEPT the additive provisional design and portable implementation
within DEC-040; do not accept the PostgreSQL/PostGIS runtime, operational replacement,
publication bridge, source rights or real geographic data.** Parent owns the decision.
No unresolved concrete blocker found in the final static/portable scope. The missing
server is a material validation gate, not a passing database test.

Reviewed `docs/architecture/M4_CANONICAL_DATABASE.md`, canonical README, all four SQL
migrations, runner, document helper, synthetic runtime fixtures, dictionary and lane
validation/journal. No canonical code or shared contracts were edited by this reviewer.
The architecture report accurately labels runtime/backup/restore/roles/bridge as
NOT_RUN or unimplemented and retains the operational SQLite bridge.

Independent execution on Python 3.13.7: **15 canonical tests PASS**, including three
actual pglast SQL/function-body/PLpgSQL grammar checks (none skipped); **4 additional
reviewer document probes PASS**; migration plan succeeds and independently reproduces
the four reviewed checksums. `migrate.py apply` independently exits **3**, reporting
psql unavailable/runtime NOT_RUN. No server connection, database creation, reset,
source collection, permission acceptance or publication occurred. Exact logs and
machine-readable findings are adjacent to this report.

Counterexamples raised and corrected by the author:

| Counterexample and evidence type | Final correction and current line reference |
|---|---|
| A route node/stop/edge could borrow another subject's approved geometry; static relational inference, no server execution | Subject/property bindings in `004_bindings.sql:39`; exact edge LineString endpoints in `004_bindings.sql:130`. Geographic safety/access still requires separate evidence. |
| A caller or temporary table could shadow unqualified function relations; static PostgreSQL contract inference | Function-local persistent path `pg_catalog, omni, public, pg_temp` at `004_bindings.sql:148`; PUBLIC execution revoked. [PostgreSQL function guidance](https://www.postgresql.org/docs/current/sql-createfunction.html) describes execution-time parsing and placing temporary schemas last. Production schema/role grants remain a separate gate. |
| Self-hashed, same-length fabricated passage could pass without matching original extraction; static counterexample | Immutable full extracted text/UTF-8 hash/length at `002_domains.sql:77`; exact source substring at `004_bindings.sql:106`; runtime negative fixture added but NOT_RUN. Extraction-to-raw authenticity still depends on trusted acquisition/QA. |
| Parent introduction/conclusion disappeared when a section contained children; independently executed synthetic probe before fix | Splitter preserves uncovered parent spans and rejects overlapping siblings. Author tests plus four independent probes pass, including Unicode code-point offsets, full coverage, reordering and changed citation identities. |
| Migration bytes could change between hash and second read; static runner analysis | Once-loaded checked bytes at `migrate.py:26`, embedded from the same load at `migrate.py:40`; manifest/history-prefix checks and advisory transaction lock. Actual concurrent apply is NOT_RUN. |
| A document-link fact could link the wrong document UUID; static relational inference | Exact asserted document UUID guard at `004_bindings.sql:141`. |
| Empty/multidimensional weekday arrays could pass NULL CHECK behavior; static PostgreSQL contract inference | Cardinality seven, one dimension and no NULL entries at `002_domains.sql:62`. |
| Nearby results could use an entity marked ambiguous; static publication inference | Verified entity location join at `003_publication.sql:103`. World ranges alone do not prove correct CRS/location. |
| Placeholder license/attribution/reviewer values could count as positive metadata; static publication inference | Shared meaningful-text predicate and explicit placeholder exclusions at `003_publication.sql:22`; eligibility uses it for rights and evidence metadata. This validates fields, never legal permission. |
| A queue could be closed by a decision on an unrelated subject; static relational inference | Same-subject queue resolution guard at `004_bindings.sql:120`. |
| `-h 127.0.0.1` could inherit remote PGHOSTADDR/service settings; static documented libpq counterexample and final mocked execution | Child environment strips services/defaults/PGOPTIONS and pins PGHOSTADDR at `migrate.py:66`; independent canonical mocked regression passes. [libpq connection parameters](https://www.postgresql.org/docs/current/libpq-connect.html) and [environment variables](https://www.postgresql.org/docs/current/libpq-envars.html) establish hostaddr precedence. |

Final inspection confirms immutable UUID/kind guards and append-only lineage; subtype
composite foreign keys; current explicit as-of validity; approved subject/fact/evidence/
snapshot joins; exact snapshot/hash/use-policy bindings; source revocation, contradictions,
open queues and current conflicting singleton facts deny eligibility. There is no app
AI implementation. Domain pointer immutability supports insert-time bindings; candidate
overlapping occupancy is intentionally retained for review. Some operational JSON
payloads bind subject/property without exhaustive typed validators, as documented;
those must not be exposed as approved live transit/hours endpoints.

Required remaining gates: install/select a reviewed PostgreSQL/PostGIS pair in a fresh
marked disposable database; create/apply/runtime adversaries/reapply; concurrent apply
and review; authenticated roles/privileges; query plans; backup/restore; canonical-to-
SQLite parity and conservative export; regional CRS/topology/field QA; device/offline
validation; independent human source-rights review and explicit distribution approval.
No source permissions or real records are accepted by this AI review.

Geography handoff cross-check: source register contains **14** rows and header 14
(earlier prose 15 was a counting mistake, corrected). Official/legal boundary remains
UNKNOWN. Proposed zones are research labels without membership geometry; all candidate
zone membership remains UNKNOWN/UNASSIGNED. DEC-041 authorizes only exact historical
acquisition-envelope internal discovery, not district completeness or publication.
Historical processed entity checksum mismatch remains quarantined and unexplained.
