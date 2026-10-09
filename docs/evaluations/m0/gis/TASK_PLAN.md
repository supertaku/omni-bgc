# M0 GIS audit task contract

Date: 2026-10-09. Owner: GIS/reuse auditor. Parent review: PENDING.

1. Read the M0 contract and geographic invariants, then discover bounded metadata from the read-only prior `C:\Users\joshu\Documents\BGC` project and local GIS tools.
2. Inspect source/license/CRS evidence and hash selected raw snapshots, processed geographic layers, and relevant provenance/configuration documents. Count inspectable records, geometry defects, and duplicate signals without importing or approving data.
3. Execute deterministic read-only QA and mandatory synthetic negative cases. Record actual outputs, unchecked properties, command errors, reuse classes, boundary/topology risks, and parent handoff.

Success: reproducible per-file SHA256 inventory and counts; explicit lineage/license statuses; separation of observed geographic data, synthetic/procedural concepts, and candidates; safe-coordinate and identity counterexamples; no M1 schema, graph, ingest or source acquisition work.

Risks: valid geometry can still lack permission; projected local-metre GeoJSON can be mistaken for WGS84; a visual street/path skeleton may lack routing topology or legal access; repeated names cannot determine identity; a working boundary cannot prove an official service area or complete coverage. No prior file is modified. No downloads, installs, scraping, publishing, precise user-location exposure, or raw-data copies are authorized.
