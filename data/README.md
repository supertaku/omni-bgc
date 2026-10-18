# Research data hub

This directory is the authoritative host location for BGC working data. Model
weights live separately in [`models/`](../models/README.md).

| Location | Purpose |
| --- | --- |
| `raw/food-research/` | Original supplied restaurant/menu CSVs |
| `raw/map-assets/` | Retained map/font source inputs |
| `research/` | Geography scope, office configuration, source catalogs and research definitions |
| `generated/offices/` | Imported office CSV/workbook snapshots, candidates and review records |
| `generated/m3/`, `generated/m4/` | GIS/intake/database working outputs and retained evidence |
| `generated/place-review/`, `generated/map-pack/` | Directory review and offline pack working outputs |
| `generated/retained-cleanup/` | Unique BGC data recovered from obsolete workspace copies, grouped by content hash |
| `manifests/`, `licenses/`, `fixtures/` | Required inventories, rights guidance and synthetic test inputs |
| `generated/research-catalog.json` | Local file index with sizes and SHA256 values; regenerate with `python scripts/cleanup.py --catalog` |

There is currently **no single populated canonical database containing all
research**. SQLite intake and mobile content databases coexist with food and
office research CSV/JSON collections. PostgreSQL/PostGIS is an implemented schema
target whose live migration and export bridge remain unvalidated. The file index
above is an inventory, not a factual database or an approval of its contents.

The app consumes packaged copies under `apps/mobile/assets/generated/`; those
are required build inputs, not separately maintained research. Keep the original
inputs and use the retained importers/pack builders to update those copies.
User-created app state and conversations remain in app-private SQLite storage.

Raw and generated data remain ignored. Research candidates, source rights,
immutable IDs, historical snapshots, coordinates and review status are unchanged.
This organization grants no dataset publication or model redistribution rights.
