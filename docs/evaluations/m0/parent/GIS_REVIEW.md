# Parent GIS assignment review — 2026-10-09

Decision: **ACCEPT** the bounded M0 reuse audit, implementation and evidence. Zero geographic datasets, boundaries, route graphs, entrances or prior entity records are approved for app use/distribution. Prior project remains read-only.

Parent inspected all seven GIS artifacts and script logic, including coordinate interpretation, duplicate signals, source links, source hash computation, missing-CRS handling and output restrictions. Requested separate output support and removal of implicit CRS fallback; both revisions are present.

Independent evidence:

- Final audit rerun into `parent/gis-rerun`: exit 0, 67 files hashed, 21 layers, 3 raw snapshots, no parse errors, 8/8 synthetic negative cases. `gis-validator-final.log` contains actual stdout. Exact JSON digest comparison is in `gis-exact-reproduction.json`.
- Separately implemented `review_gis.py`, executed with existing isolated prior virtual environment: exit 0. Independently verified all 67 byte sizes/hashes, all three snapshot counts/raw checksums and unique OSM type/ID pairs.
- Independently reproduced the entity manifest checksum mismatch using the documented canonical serialization; it remains quarantined with no source correction.
- Independently inverse-projected a selected local-metre POI using its explicit stored offset/CRS; direct local coordinates fail WGS84 range. Broad transformed position sanity is not an approved service-area check.
- Parent adversarial case requested output in the prior project: audit refused it with process exit 2 before write.

Observed audit findings are useful blockers, not failed audit execution: access/grade-separation fields are lost in processed road/path layers; those are buffered areas, not graph connectivity. Four inferred/unknown entrance concepts have no checked coordinates. Geometry validity and recorded raw ODbL do not establish field safety, fresh business facts, legal boundary authority, source/media/code rights or an offline-native-ready pack.

The 13,840 inspected feature records overlap and include derived surfaces. They are not distinct places or a coverage denominator. Duplicate geometry/name signals remain unresolved; no records were rejected/merged/imported. Later follow-up requires separately authorized M1/M3, source/legal review and field review. No such work began during this audit.
