# Research and permitted acquisition

`program.py` aggregates locally authored discovery pointers, named research zones,
source links, permission uncertainty, field-evidence pointers, searches and gaps.
Its counts represent observations, not resolved businesses or a census. Equal
normalized names produce a manual identity-review suggestion, never a merge.
The current official-source inventories are under `data/research/m4/`; source
metadata checksums are not hashes of inaccessible or unretained websites.

Rebuild coverage and the existing read-only reviewer dashboard:

```powershell
python docs/evaluations/m4/comprehensive/prepare_review.py
```

`capture.py` handles a **local, positively permitted export**; it does not fetch
web pages. Supported adapters: CSV, JSON, EPSG:4326 GeoJSON, GTFS Schedule ZIP.
GTFS validation here checks container/table syntax only. Operator authenticity,
required-field semantics, schedules, references, geography, fares and reuse
rights remain separate gates. Existing `pipelines/gis/research_inventory.py`
handles only the exact approved historical OSM acquisition with bound sidecar,
query and old boundary hashes; its output remains discovery-only.

Example after an authorized owner supplies an export and exact retained permission:

```powershell
python pipelines/etl/research/capture.py --help
```

Policy JSON requires source_id, owner, canonical_url, license_reference,
reviewer, decision_reference, retention_terms, decision=ALLOW_INTERNAL_RETAIN,
internal_storage_allowed=true, transform_allowed=true, fetched_at, reviewed_at,
valid_until, raw_sha256 and retained_permission={file,sha256}. All dates use full
UTC with Z; permission bytes must stay below the policy directory and match.
GeoJSON additionally requires source_crs=EPSG:4326. The CLI lists exact arguments.
UNKNOWN is not permission. Public OSMF raster caching is denied.

Each content-addressed ignored snapshot retains raw.bin, permission.bin,
policy.json, staging.json and manifest.json. Replays compare every byte; corrupt
existing snapshots and collisions fail. Failed parsing leaves no snapshot.
These staging files do not automatically populate canonical tables. Review the
source-specific mappings and create a bound M4 intake with stable provider IDs,
retained raw/evidence, exact snapshot/use policies and explicit relationships via
the accepted `pipelines/etl/place-intake/intake.py` workflow. Promotion is manual
and audited. Public directory/menu/photograph scraping is not implemented.
