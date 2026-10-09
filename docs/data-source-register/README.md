# Source register v2

M1 explicitly migrates the canonical header-only register from 18 to 23 columns. `source-register-v1.header.csv` is the exact byte backup; `register-migration.json` records both SHA256 values and the zero-row count. The M0 evaluation inventory remains historical and unchanged: its 11 rows have not been promoted into this register.

The exact ordered v2 header is the original 18 columns followed by `jurisdiction,source_published_at,data_extract_version,retention_terms,review_timestamp`. `source_version` identifies the upstream document/data version; `data_extract_version` identifies the extraction implementation/revision. They are never aliases. Version-aware readers must reject a mismatched header. Source IDs and all original cell values must survive migration verbatim; adding fields never allocates new IDs or upgrades review status.

Permissions use `true`, `false`, `UNKNOWN`. Review status uses `CANDIDATE`, `RESEARCH_ONLY`, `APPROVED`, `REJECTED`, `BLOCKED`, `STALE`, `REVOKED`. `APPROVED` is a reviewed source disposition, not a universal right to export every content class. `UNKNOWN` for intended rights remains research-only. Unused image/menu permissions may remain UNKNOWN for data-only intake; they cannot be used for media/menu export.

Unknown publication dates remain blank or `UNKNOWN`; never substitute retrieval time. UTC timestamps use ISO8601 ending `Z`. Raw SHA256 is lowercase 64 hex characters for actually acquired bytes. Documentation verification without raw acquisition never receives an invented raw dataset hash. Every acquisition creates a separately identified immutable snapshot and evidence; changed content/version gets a new snapshot, preserving source ID. The CSV is a registry of providers/rights metadata, not a replacement for snapshot evidence or per-fact verification.

Migration: `python pipelines/sources/migrate_register.py` from repository root. It refuses a second migration if the backup exists. Reverse compatibility must be explicit: older 18-column consumers either use the historical file or receive a documented projected export; they must not silently discard new governance fields.

Policy and gates: [M1 governance](../architecture/M1_DATA_GOVERNANCE.md). The collection playbook's 22-field list omits legacy `source_version`; the accepted M1 proposal preserves it, making 23. Parent must review this explicit extension before integration. No shared playbook was silently rewritten.
