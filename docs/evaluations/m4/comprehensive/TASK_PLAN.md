# M4 comprehensive program — 2026-10-10

Baseline: clean `codex/m1-m14`, HEAD `f77a5f0`. Reuse M1 staging/mobile migrations,
M4 immutable intake, M13 read-only dashboard, mobile content/user-state split,
and exact historical OSM source checks. Real approved places/menus/entrances/
transit remain zero. The 290 historical pilot leads are not a district census.

| Wave | Owner / exclusive files | Success criterion | Main risk |
|---|---|---|---|
| 1/3 | Architecture agent: canonical subtree, canonical tests, architecture report | Additive migrations and explicit runtime gate; no rewriting accepted contracts | PostgreSQL absent; static checks cannot prove migrations |
| 2/4 | Business agent: business research subtree | Source/branch/menu/facility leads with exact primary links and rights uncertainty | Public pages do not grant redistribution |
| 1/2/4 | Geography agent: geography research, new inventory extractor/tests | Exact raw checks and BGC research-context inventory; no inferred doors/routes | Historical envelope is not legal BGC or current truth |
| 3–7 | Parent: portable GIS gate, research aggregation, local acquisition, retrieval/export, dashboard/CI | Deterministic safety/regression tests and repeatable coverage | Mixing discovery, approval and currentness |
| 7/8 | Parent plus independent review after research | Inspect diffs, challenge claims, rerun tests, ACCEPT bounded artifacts | Device/rights/field gates cannot be inferred |

Workstreams A–J are scheduled across these owners, not ten simultaneous agents.
Inherited supported models are used; suggested unavailable Terra is not assumed.
No public publishing, paid service, contact, destructive migration, AI runtime,
embedding/vector index, or main merge. A local research report may retain pointers
to public sources with UNKNOWN content rights; it is never an approved dataset.

Research zones are named project partitions, without legal polygon authority:
central-high-street, east-market-aura, north-uptown, north-institutional,
west-burgos-forbes, south-bgc, external-transfer-context, unassigned.
Coverage denominator stays null until an independent census is reviewed.

Validation records actual exit codes/tool versions. Historical local raw checks
are optional in portable CI and explicitly run here when available. Native tests
and PostgreSQL runtime remain separate; prior preview results are not new passes.
