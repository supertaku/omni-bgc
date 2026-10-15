# Independent GEX-0 boundary review — 2026-10-14

**Original perimeter: CHANGES_REQUESTED. Revised proposal: ACCEPT for bounded internal engineering, subject to explicit parent acceptance of the exact proposal and conditions below.** This accepts an acquisition/processing/preview envelope. It does not approve legal district boundaries, current-world coordinates, entrances, individual searchable records, source distribution, runtime activation or walking navigation.

The user explicitly chose the written requirements over the missing screenshot. Screenshot reconciliation is therefore no longer a dependency. Earlier records of that missing evidence remain historical.

Reviewed source bytes are the previously accepted historical OSM snapshot, not newly acquired or current-survey data. Independently verified raw/sidecar/query/old-boundary hashes, 21,290 objects, zero duplicate identities, zero coordinate conflicts and zero coordinate errors. Exact hashes and tool versions are in `boundary-review-r2.json`. Python from the existing BGC virtual environment supplies Shapely/PROJ; the default host Python lacks Shapely. No install or environment change was made.

## Geographic findings

The authored perimeter included identifiable external residential fringes. Source geometry and adjoining original road names establish concrete counterexamples without requiring a blanket survey of BGC:

| Source | Original overlap, m² | Interpretation and disposition |
|---|---:|---|
| `osm:way:28541386` | 10,931.11 | Northern residential envelope runs north of the hospital near Negros and Guimaras streets. It overlaps none of the mandatory anchor polygons. Exclude the intersecting fringe. |
| `osm:way:28993541` | 16,578.30 | Older unnamed residential envelope along Minipark Road beside the Aura complex. Exclude; retain identity independently of newer overlapping source. |
| `osm:way:1476336381` | 17,886.14 | Named Minipark neighborhood envelope; partially duplicates the preceding source. Exclude. Do not sum duplicate overlap areas. |
| `osm:way:28997881` | 32,985.44 | Southeastern residential envelope containing Jasmin, Ilang-Ilang, Morning Glory, Sunflower, Dahlia, Mayflower, Calla and Tulip streets. Exclude the fringe. |

Named Forbes Park North/South, Consular Subdivision, Teachers Compound, Villa Kalayaan, Sitio 8 West Rembo, East Rembo Zone 4, McKinley Hill Village and McKinley West polygons had zero area intersection with the original scope. Two residential relations could not be reconstructed because original member ways are absent; two residential nodes are not area polygons. They were not silently repaired or interpreted as full neighborhoods. These facts limit any completeness claim.

Internal Serendra, Two Serendra, High Street South, Park Triangle, Avida Towers 34th and Uptown Ritz/Parksuites remain basic geometry candidates, consistent with the written mixed-use rule. The Uptown residential envelope `way/746785974` contains named Uptown Ritz and Parksuites building polygons. Residential tags alone are insufficient reason to erase these internal developments. Private units, private entrances and residential directory enrichment remain denied.

## Exact proposed correction

`data/research/expansion/scope-review-r2.geojson`, SHA256 `e7e3541fccd087467093f00a9fb6011a73abd1da7061fb5c715240d904ca77d0`, is a separate inactive engineering proposal. Derivation: original `scope-design.json` Polygon **difference** the union of the four exact reconstructed external residential polygons above. No buffers, precision grid, simplification, snapping, polygon repair or fabricated location coordinates were used. Overlay vertices describe engineering coverage, not entrances or legal parcels. Full original source geometry remains separate and unchanged. This proposal contains source-derived boundaries and has no public distribution grant.

Independent result: valid connected Polygon, 48 ring positions including closure, zero holes; area 1,456,920.705 m²; removes 62,572.047 m² of exterior fringe. The unchanged pilot is fully covered. All 14 physical building/part footprints are fully covered, as are both High Street multipolygons and the other required anchor sites. Twenty of the 21 original source geometries are entirely covered. All four exterior fringe intersections are zero within a documented `1e-6 m²` numerical overlay test tolerance: the only residue is `2.0871570848848223e-9 m²` for `way/28993541`. That tolerance must not admit residential records or expand scope; deny the four source identities explicitly during feature processing.

The exception is Aura's broad `landuse=retail` **site/context** polygon `way/97061942`, which overlaps Minipark by 1,295.398277 m². Neither the mall building `way/221590005` nor tower part `way/531903361` intersects the excluded area. Preserve the entire source site polygon in research with `SITE_CONTEXT` and `crosses_boundary=true`; do not mistake its envelope for a physical building or enlarge service to encompass the conflict. Every physical footprint remains intact. The distinction resolves the requirements without inventing geography or silently changing source geometry.

## Distinct Aura tower identity

[SM Prime's office inventory](https://www.smprime.com/sm-offices/) separately identifies Aura Office Tower. Its [2013 project release](https://www.smprime.com/company_releases/sm-prime-creates-new-landmark-with-sm-aura-sets-new-standard-in-green-development/) places the office component at the southern end of the integrated development. A [2014 tower launch on the owner's site](https://www.smprime.com/latest_news/sm-aura-premier-launches-office-tower/) supports a connected but distinct office tower. These are metadata-only research references; no photos, plans, menus, tenant lists or website bodies were copied into the dataset.

The original `way/531903361` is an unnamed tall part at the southern end of the mall building, geometrically distinct from `way/221590005`. This supports **OWNER_CORROBORATED_SPATIAL_CANDIDATE** for scope planning and preservation of a separate tower identity. It does not supply a georeferenced authoritative match or approved entrance. Historical OSM claims 32 levels; the owner's 2014 launch describes 29 stories. Retain conflicting source claims without publishing a reconciled count. The separately named Brittany Hotel is another tall building within the broad retail site and must not be substituted for this tower. Owner-operator direct fetch timed out and the office-inventory target returned 404; no bypass or repeated bulk access was attempted.

## Parent decision and next gates

Recommend explicit parent **ACCEPT** of the revised proposal for GEX-0 bounded internal engineering, with source-role distinctions, identity-level exterior residential denial, full-source provenance retention, and candidate-only Aura tower identity. That permits GEX-1 source/rights auditing and later host implementation under the supplied milestone dependency order. The former requirement that all 21 historical site envelopes fit inside service should be replaced by full coverage of physical footprints plus separately classified crossing site context; this is a material decision for the parent journal.

Current-world fact approval, georeferenced tower/entrance identity, source-specific access/retention/transformation/distribution rights, connector/cut-edge analysis and device/release evidence remain separate gates. Scope approval cannot grant those rights or claims. No device probe, USB operation, app launch, Git mutation, prior evidence overwrite or shared-file edit was performed. Later app tests require the user's explicit USB-debugging permission because another agent owns that session.

Validation: 13 GEX host unit tests PASS; original serialized verifier PASS_CANDIDATE_ONLY; independent raw reconstruction, metric overlay and proposal coverage assertions PASS. No screenshot of the expanded app or physical-device result is claimed. This review owns only this report, `boundary-review-r2.json` and the separately authorized proposal GeoJSON.
