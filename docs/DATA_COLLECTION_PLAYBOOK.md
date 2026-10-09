# Omni-BGC — Data Acquisition and Quality-Control Playbook

Owner: Data Acquisition Lead. Parent reviewer: GIS/Data Quality Engineer. Source/merchant licensing and safety-critical walkway facts receive human review.

## A. Coverage inventory by workstream

| Workstream | Extracted baseline | Verification approach | Common failure modes | Release rule |
|---|---|---|---|---|
| District limits, streets and address system | Licensed OSM extract, audited prior BGC asset | Official boundary evidence or project-defined coverage; visual comparison; field intersections | Mistaking bbox for district; street alias mismatch | Real georeferenced geometry, boundary confidence documented |
| Buildings and complexes | OSM polygons, old BGC geometry, official directories | Name, stable identity, entrance/floor association | Split complex / duplicate parts; entrance from centroid | Approved canonical building IDs and footprints |
| Restaurants & cafes | Official directory leads, operators, merchant-owned pages, field survey | Menu consent; dish/photo licenses; opening hours with date | Closed branches, outdated menu, inferred fish ingredients | No menu presented as current without evidence/freshness label |
| Offices & tenants | Building directories, permitted official corporate sites, signage | Address/building/floor, office visibility/access rights | Restricted tenant lists, confidential office entries | Mark coverage incomplete; no guesses from nearby businesses |
| Retail & malls | Mall directories, official store websites, venue signage | Branch, floor, shopfront location | Multiple same-name branches; floor shorthand | Stable branch distinction and verified floor |
| Parks and public amenities | Geographic objects and field surveys | Entry/exit accessibility, restrooms, opening hours | Restricted park gates and private facilities | Clear access classification |
| Transit | Operator-approved routes, official static guides, field stops | Stops, sequence, operating times, service exceptions | Stale route shapes/schedules, terminal outside BGC | Static-only, verified timestamp, no live-arrival claim |
| Pedestrian graph | OSMnx walking network, survey/geometry audit | Crossings, sidewalks, grade separation, passage hours, accessibility | Imaginary crossing, locked gates, bridges at wrong levels | Field-tested route samples before public navigation |

## B. Source register required fields

`source_id, owner, category, source_url_or_document, jurisdiction, source_kind, data_license, redistribution_allowed, images_allowed, menu_text_allowed, attribution_text, collection_method, fetched_at_utc, source_published_at, raw_sha256, data_extract_version, retention_terms, restriction_notes, consent_reference, reviewer, review_status, review_timestamp`

Any `UNKNOWN` or `redistribution_allowed=false` source stays a research lead and **must not** be merged into a distributable offline pack until resolved. Storing raw downloaded material for evidence also requires a policy review depending on the source terms.

## C. Establishment fact collection form

- Candidate UUID and aliases; category subtype; building/complex relation; canonical floor; exact premise or entrance point; business state; field observed date; hours/holiday exceptions; contact and homepage where permitted; source ID; menu status (none, unknown, merchant-provided, observed-with-permission); pricing last-checked timestamp; accessibility evidence; uploader/reviewer and approval. Avoid collecting customers/employees' identifying information.
- Store menu items in structured form with explicit dish names, fish/seafood category only where supported, sourced allergens and source freshness. Do not infer ingredients from dish title alone.
- Record separate coordinates for business icon/label placement and entrance navigation. GeoJSON serialized `[longitude, latitude]` and validated against service polygon + buffer.

## D. Candidate matching / review

Normalize Unicode and whitespace; transliteration/alternate spellings; maintain owner/operator links. Candidate matches with conflicting floors or multiple branches go to manual review. Retain original source IDs and every merge/split event. Tests: duplicate same store across official/Osm, two branches in one mall, moved venue, closure, multi-level department store, unverifiable branch, office whose building is known but floor is missing.

## E. Verification matrix

- **Verified**: source valid for intended redistribution plus sufficiently authoritative current fact, reviewed and timestamped.
- **Provisional**: credible indication with unanswered uncertainty; visible but explicitly caveated where safe.
- **Candidate/Unknown**: internal review queue; not listed as a factual place recommendation.
- **Closed/Historical**: keep identity lineage; do not show as operating.
- Verified status is per *fact*, not a permanent stamp on the entire establishment.
- Sources may contradict each other: record conflict, prefer higher-authority/recent evidence but do not silently destroy other facts.

## F. Geographic QA

Automated: geometry validity, coordinate range, impossible zeros, polygon repair deltas, duplicate IDs, overlapping mistaken building parts, no orphan tenant/building refs, building entrance proximity, path intersections, graph connectivity, expected crossing controls. Visual: overlay paths and building entrances in QGIS; verify high-risk pedestrian links; independent review. Field: spot-check routes and entrance access; label unverifiable access and exclude unsafe graph edges.

## G. Coverage reporting

Show `verified / candidate / unknown / closed` counts by category and zone, plus menu coverage, entrance coverage, number of source providers, latest refresh and independent audit sample. Completeness percentage is only shown when a defensible denominator exists. Distinguish geographic area coverage from place category coverage and menu depth. Report missing office tenants rather than claiming exhaustive inventory.

## H. Operational schedule (proposed)

Initial pilot High Street, later districts in waves. Daily or weekly source issue triage; monthly priority restaurant refresh; operator-event transit updates; quarterly general fact revalidation where material. Track every change through approval queue, journal event and publishable pack diff. Unsafe routing discoveries trigger immediate map warning/hotfix review.

## I. Practical data collection deliverables

1. `source-register.csv` + source rights review.
2. `raw-manifests.json` with immutable checksums and citations/URLs.
3. `candidates.geojson` and structured candidate tables.
4. `dedup-review.csv`, `conflicts.csv`, `field-survey.csv` with identifiers only (no personal data).
5. `verified-places.sqlite`, `navigation-entrances.geojson`, `routing-provenance.csv`.
6. `coverage-dashboard.json` and QA error report.
7. Parent-approved versioned pack manifest, evidence and release notes.

No bulk website crawler should be started before its source permission gate; no generated text from agents is accepted as evidence for a place fact.
