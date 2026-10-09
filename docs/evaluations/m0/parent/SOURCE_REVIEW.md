# Parent source assignment review — 2026-10-09

Decision: **ACCEPT** the bounded M0 inventory/report and validator. This is evidence acceptance only; zero datasets or source records are approved for redistribution. Shared source-register header and content remain unchanged. M1 is not authorized.

Parent inspected all seven source artifacts, current candidate/status definitions, permission notes, local concept hashes, validation code and primary OSM copyright/raster-policy documentation. Requested optional validator output to preserve the subagent's checksummed evidence during parent rerun; revision completed.

Independent results:

- Reimplemented the header/status/duplicate/raw-hash/asset checks in `review_sources.py`: exit 0, 11 records (7 candidates, 4 policy references), 9 redistribution UNKNOWN, no approved/acquired records, no duplicate IDs or canonical URLs, four concept hashes verified.
- Reran the agent's validator with a parent-owned output: exit 0. See `source-validation.json` and `source-validator-rerun.log`.
- Parent counterexample verifies that conditional ODbL raw-data permission on the Geofabrik lead still does not establish an acquired/approved dataset or menu/photo reuse rights. Publicly accessible menu and transit examples retain UNKNOWN permissions; OSM public raster offline source remains excluded by its restriction and false permission.
- Reviewed exact mismatch: existing register has 18 columns, playbook 22. Five fields absent from current register plus current-only `source_version`; no silent migration.

Limitations: documentation access is not a saved raw snapshot, world freshness, merchant consent, legal approval, boundary authority or field verification. The Megaworld page retrieval failure remains explicit. Candidate URLs and concept identities do not establish a usable BGC dataset. Resolve the register contract and source rights only in separately authorized M1/data work.
