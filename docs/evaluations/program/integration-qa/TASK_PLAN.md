# Integration QA plan

## Scope

Run one deterministic integration pass over the currently accepted governance and contract suites, synthetic M3 quality/topology, M4 intake, mobile SQLite/projection, mobile JavaScript contracts, UI state, routing, and itinerary behavior. Verify final handoff artifact hashes for M2, M3, M4, mobile UI/data, routing, and the GIS pack review after the owners' files are final. Run the mobile app typecheck once against the final mobile/data snapshot. Add a Linux GitHub Actions quality workflow for Node 22, Python 3.13, pinned Shapely/pyproj, pure contract tests, and strict domain/geo/routing types.

## Success criteria

- Exact commands, tool versions, exit codes, and test totals are recorded.
- Every in-scope final handoff artifact hash matches; missing or changed artifacts are reported.
- The single final-snapshot app typecheck result is recorded.
- CI does not ingest source data, require ignored real datasets, build native Android/iOS targets, publish artifacts, or use special secrets.
- Report device, iOS, design-participant, rights, and real approved-record limitations as unresolved where applicable.

## Risks and boundaries

- Owner handoffs may still change; do not hash or overwrite manifests until the parent confirms the final snapshot.
- Local GIS test libraries may differ from the CI pins; report observed versions exactly.
- Synthetic contracts and static pack checks do not establish data rights, field truth, or native offline behavior.
