# OMNI-BGC — GEOGRAPHIC EXPANSION IMPLEMENTATION PLAN

**Project:** Omni-BGC  
**Program:** GEX — Geographic Expansion  
**Version:** 1.0  
**Status:** PROPOSED — PENDING IMPLEMENTATION APPROVAL  
**Date:** October 14, 2026  
**Repository:** https://github.com/supertaku/omni-bgc  
**Baseline:** `0b889c39220ff04679e1150f2cddadf64d59fe26`  
**Target platform:** Android-first, offline-first, iOS-compatible architecture

---

# 1. Executive Summary

## 1.1 Objective

Expand Omni-BGC beyond its existing Bonifacio High Street pilot into a continuous geographic experience covering the principal commercial areas of Bonifacio Global City, particularly:

1. Bonifacio High Street and the existing central pilot.
2. Uptown Bonifacio and its corporate developments.
3. Mitsukoshi BGC and surrounding commercial establishments.
4. The central BGC business district, including 30th and 32nd Streets.
5. St. Luke's Medical Center, Shangri-La The Fort, and neighboring commercial buildings.
6. SM Aura Premier, including its office tower.
7. Market! Market!, including its public entrances and adjacent commercial establishments.
8. The roads, public spaces, pedestrian connections, and relevant commercial properties linking these destinations.

The scope must also accommodate searchable company offices, business establishments, mixed-use developments, and public facilities.

**Residential neighborhoods outside the BGC project service area must not be expanded into detailed searchable coverage.** Limited surrounding geographic context is permitted where necessary for orientation or future transit connectivity.

The resulting product must remain functional without an internet connection.

## 1.2 Primary Success Criteria

The geographic expansion is successful when:

- The approved commercial service area can be explored continuously on the Android map.
- SM Aura, Market! Market!, Uptown, High Street, and the connecting commercial corridors appear at geographically correct locations.
- Roads, building footprints, parks, walkways, and major structures display without unexplained coverage gaps.
- Users can search for approved companies, buildings, establishments, and landmarks across the expanded area.
- Company search results resolve to the correct office building or verified premises.
- Excluded residential areas do not inadvertently become part of detailed coverage.
- Search, map rendering, and place details remain available offline.
- Existing High Street behavior is preserved.
- The new geographic data, identity mappings, source lineage, and offline resources pass deterministic QA.
- Native Android testing confirms acceptable performance and stability.
- No unapproved navigation, invented location facts, unauthorized content, or source-rights violations are introduced.

The plan does not require the local AI model to be complete before geographic expansion work begins.

## 1.3 Scope Boundaries

### Included in the initial geographic release

- Geographic service-area definition.
- Road and public pedestrian geometry.
- Building footprints and building parts.
- Parks and public open spaces.
- Existing 2.5D building rendering.
- Major commercial landmarks.
- Building identities and building-level search.
- Verified company and establishment records.
- Map camera, search, selection, and offline resource updates.
- Geographic coverage QA and physical-device testing.

### Deferred to separate milestones

- Complete company/tenant census of every BGC building.
- Live business hours, traffic, parking and transit updates.
- Indoor mall navigation.
- Floor-by-floor indoor maps.
- Turn-by-turn pedestrian navigation based on unverified paths.
- Full wheelchair-accessible routing.
- Photorealistic building reconstruction.
- Automatic web crawling of business directories.
- AI-generated location data or geographic coordinates.
- Cloud-dependent map infrastructure.

### Non-goal

Do not rebuild Omni-BGC as a new application, replace MapLibre with a different rendering engine, or introduce a mandatory server merely to support a larger geographic area.

---

# 2. Existing System and Engineering Baseline

## 2.1 Current Technology

Preserve the repository's existing pinned environment unless a specific, independently validated compatibility issue requires modification.

| Layer | Existing technology |
|---|---|
| Mobile application | Expo 57 / React Native 0.86 |
| Language | TypeScript |
| Map renderer | MapLibre React Native 11.5 |
| Geographic processing | Python, Shapely, pyproj |
| Map packaging | MVT and PMTiles |
| Local database | SQLite |
| Local text retrieval | SQLite FTS5 |
| Spatial retrieval | SQLite spatial-index architecture |
| Geographic CRS | EPSG:4326 |
| Metric processing CRS | EPSG:32651 |
| Route computation | Existing pure TypeScript A* infrastructure |
| Proposed canonical target | PostgreSQL/PostGIS, not yet operationally accepted |
| AI implementation | Separate ongoing program |

## 2.2 Existing Geographic Data

The current High Street service-area manifest resides at:

`data/manifests/service-area-v1.json`

Its bounding rectangle is:

| Direction | Coordinate |
|---|---|
| West | 121.04750 |
| East | 121.05205 |
| South | 14.54865 |
| North | 14.55240 |

The existing internal map pack contains 27 tiles and 548 historical source-geometry records.

The broader M4 research previously identified:

- 21,290 original historical OSM elements.
- 20,103 classified candidate source objects.
- 11,473 building-outline source objects.
- 179 building-part source objects.
- 4,662 highway/pedestrian source objects.
- 2,044 place/facility source objects.
- 60 business/facility research pointers.

These counts overlap and include external context. They are not unique in-scope establishments, a verified building census, or evidence of geographic completeness.

The M4 research report explicitly records zero approved/exported wider-area real records and zero navigation-eligible real graph edges.

## 2.3 Components Requiring Special Attention

| File or module | Existing constraint | Required treatment |
|---|---|---|
| `apps/mobile/src/map/MapCanvas.tsx` | Pilot camera center and rectangular outside-area checks | Replace with versioned polygon-aware coverage |
| `apps/mobile/src/map/bundled-style.ts` | Bundled pilot resource names | Add reviewed geographic pack selection |
| `apps/mobile/src/map/pilot-style.json` | Pilot-specific geographic source and style | Preserve as historical fallback; generate an expanded style |
| `apps/mobile/src/updates/contracts.ts` | Literal High Street `scopeId` and manifest validation | Extend scope acceptance without weakening trust checks |
| `apps/mobile/src/updates/index.ts` | Content-pack validation, recovery and dependency checks | Preserve exact integrity and rollback guarantees |
| `apps/mobile/src/updates/style.ts` | Verified local style loading | Support the approved expanded resources |
| `apps/mobile/src/routing/installed.ts` | Fixed High Street graph scope and boundary | Keep navigation gated; design future version compatibility |
| `pipelines/gis/geometry.py` | Existing specific metric scope/buffer contract | Generalize through reviewed scope metadata |
| `pipelines/gis/ingest.py` | Original pilot scope and input approvals | Add a separate validated expansion ingest path |
| `pipelines/map-pack/build.py` | Pilot manifest, fixed bounds, original PMTiles output | Parameterize versioned scope and artifact paths |
| `pipelines/map-pack/check.mjs` | Pilot-specific resource and style assumptions | Add expansion validation while retaining pilot regressions |
| `packages/database/export_mobile.py` | Strict evidence and publishing gates | Extend only for necessary reviewed entity types |
| `apps/mobile/src/features/explore/directory.ts` | Current presentation directory behavior | Support wider reviewed entities without mixing candidates |
| `apps/mobile/src/data/store.ts` | SQLite-backed reviewed fact retrieval | Reuse existing retrieval and freshness rules |

These are the current architectural touchpoints. Additional changes should be justified through code inspection rather than speculative refactoring.

## 2.4 Existing Invariants

The implementation MUST preserve:

1. Offline-first behavior.
2. Existing source attribution.
3. Immutable source snapshots and reproducible hashes.
4. Candidate/approved/stale fact separation.
5. Source-specific redistribution and retention policies.
6. Immutable canonical entity IDs.
7. Validated geographic coordinates.
8. Independent navigation-eligibility decisions.
9. Pack-integrity checks and rollback behavior.
10. Existing saved user records.
11. Existing UI and accessibility behavior.
12. The separation between geographic computation and local AI inference.

---

# 3. Geographic Coverage Specification

## 3.1 Coverage Philosophy

The proposed expansion boundary is an engineering service area, not an assertion of BGC's official legal boundary.

The user's supplied screenshot determines the desired visual and commercial scope, but is not itself georeferenced.

The engineering team must convert that intended scope into a reviewed polygon using verifiable geographic data.

Do not approximate the expansion using a rectangle alone.

## 3.2 Required Geographic Zones

| Zone ID | Name | Required coverage |
|---|---|---|
| GEX-A | High Street Core | Existing pilot and immediate commercial continuity |
| GEX-B | Central Business Corridor | 30th/32nd Street offices, healthcare, hotels and neighboring establishments |
| GEX-C | Uptown / North | Uptown Mall, corporate centers, Mitsukoshi and relevant nearby offices |
| GEX-D | Market / Aura | SM Aura, office tower, Market! Market!, adjoining commercial properties |
| GEX-E | Connecting Commercial Streets | In-scope commercial buildings and roads connecting A–D |
| GEX-F | Perimeter Access Context | Selected boundary roads, crossings, transit access points and surrounding reference features |

Zones are internal project classifications. They must not be labeled as official BCDA planning districts unless supported by independent authoritative evidence.

## 3.3 Mandatory Geographic Anchors

The reviewed scope must contain the relevant source-supported physical footprints of:

- Bonifacio High Street.
- Uptown Mall and associated relevant commercial buildings.
- Mitsukoshi BGC.
- St. Luke's Medical Center — Global City.
- Shangri-La The Fort.
- SM Aura Premier.
- SM Aura Office Tower.
- Market! Market!.

Additional anchors may be included after field/source review.

For each anchor, record:

- Canonical name and aliases.
- Source identifiers.
- Candidate or approved building/complex geometry.
- Zone membership.
- Boundary membership.
- Source version.
- Source quality and verification state.
- Whether public entrances are known.
- Whether a searchable company or establishment relationship is available.

Do not invent anchor coordinates or derive authoritative entrances from screenshots.

## 3.4 Three Geographic Coverage Classes

### Class 1 — Full detail

Inside the approved commercial service area:

- Building geometry.
- Commercial destinations.
- Verified company and business records.
- Roads and mapped pedestrian infrastructure.
- Parks and public facilities.
- Approved map labels.

### Class 2 — Limited context

Immediately beyond the service area, where necessary:

- Major connecting roads.
- Road intersections.
- Selected transport access points.
- Minimal environmental context.

Context features must be explicitly classified and sourced. They do not automatically become searchable destinations or routable network edges.

### Class 3 — Excluded detailed coverage

Residential neighborhoods outside the project-defined BGC scope:

- No expanded residential-unit listings.
- No residential building-directory enrichment.
- No detailed private entrances.
- No neighborhood-level business indexing solely because the neighborhood intersects the acquisition rectangle.
- No private or unsupported navigation.

Mixed-use or residential buildings physically inside the approved BGC scope may retain basic building geometry. Their private residences remain separate from legitimate publicly accessible commercial premises.

## 3.5 Required Geographic Artifacts

Create a proposed v2 scope with:

- Main service-area Polygon or MultiPolygon.
- Searchable entity-inclusion geometry.
- Limited-context geometry.
- Exclusion polygons or reviewed land-use filters.
- Zone geometries.
- Priority anchor registry.
- Candidate routing-support geometry, explicitly non-authoritative.
- Acquisition buffer definition.
- Boundary-source evidence and approval status.

Suggested files:

- `data/manifests/service-area-v2.json`
- `data/research/expansion/zones.geojson`
- `data/research/expansion/exclusion-areas.geojson`
- `data/research/expansion/priority-anchors.json`
- `data/research/expansion/coverage-policy.json`

Actual paths must conform to existing repository conventions and remain subject to parent approval.

## 3.6 Geometry Rules

- Store GeoJSON coordinates in longitude/latitude order.
- Use EPSG:4326 for geographic storage.
- Use EPSG:32651 for local metre-based buffering and measurement.
- Validate Polygon and MultiPolygon topology.
- Reject open, self-crossing, zero-area, malformed or otherwise invalid scope geometry.
- Preserve interior holes where applicable.
- Use boundary-inclusive membership semantics where the contract requires them.
- Maintain source feature identity independently of clipped display geometry.
- Never use a simple bounding-box test as final polygon membership.
- Never treat the acquisition buffer as authorized navigation coverage.

An initial 200-metre metric buffer may be evaluated for continuity with the original M3 design, but the correct buffer must be determined through actual connector and cut-edge analysis rather than assumed sufficient.

---

# 4. Geographic Data Acquisition and Verification

## 4.1 Primary Source Strategy

### OpenStreetMap / Geofabrik

Use as the initial source for:

- Road alignments.
- Building footprints.
- Building parts.
- Pedestrian ways.
- Crossings.
- Parks and landscapes.
- Tagged public amenities.

Prefer a reviewed regional extract and bounded local filtering over heavy live API queries.

Record exact extract version, acquisition time, source URL, file checksum, license and attribution.

### Overture Maps

Use as a supplementary candidate source for:

- Building coverage comparisons.
- Missing commercial building candidates.
- Additional POI candidates.
- Source-supported identity reconciliation.

Pin the exact Overture data release and schema version.

For the 2026 Places schema, evaluate `basic_category` and `taxonomy` rather than relying on the removed legacy `categories` field.

Overture records must not be assumed correct solely because they possess stable IDs.

### Authoritative property and business sources

Prioritize:

- SM Supermalls / SM Prime.
- Ayala Malls / Ayala Land.
- Megaworld.
- Official BGC district resources.
- BCDA geographic/planning references.
- Property managers and office-building operators.
- Official company office pages and authorized directories.

These sources are primarily for entity identity, building relationships, office addresses and validated premises information—not for unrestricted copying of website contents.

### Field verification

Reserve field verification for information that cannot reliably be determined from source geometry alone, particularly:

- Public entrances.
- Actual accessible access points.
- Passage restrictions.
- Crossings and barriers.
- Building/office occupancy conflicts.
- Floor/unit identification where a source is ambiguous.

## 4.2 Acquisition Governance

Before acquisition, determine whether the source permits the intended operation.

For every source, record independently:

- Automated access permission.
- Raw-data retention permission.
- Data transformation permission.
- Internal engineering use.
- Offline storage.
- Distribution or redistribution.
- Required attribution.
- Share-alike/derivative obligations.
- Use restrictions.
- Permission validity and expiration.
- Required human review.

Public website accessibility must not be treated as a license.

Do not use OpenStreetMap Foundation public raster/vector tile services to build offline archives.

Do not bypass access controls or scrape restricted business directories.

## 4.3 Immutable Acquisition Pipeline

Recommended pipeline:

1. Register source and permissions.
2. Freeze exact intended geographic extract.
3. Acquire data through an authorized mechanism.
4. Record source bytes, schema version and SHA256.
5. Preserve immutable raw evidence.
6. Parse into source-specific candidate representations.
7. Reject or quarantine malformed data.
8. Restrict features to reviewed acquisition bounds.
9. Preserve provider IDs, geometries and applicable tags.
10. Send normalized candidates to the geographic reconciliation stage.

Generated assets must not overwrite historical research snapshots.

## 4.4 Reconciliation Rules

A source object, a building, a building part and a tenant organization are different things.

The reconciliation process must:

- Keep original source identities.
- Identify possible duplicate building outlines.
- Preserve building-to-building-part relationships.
- Reconstruct supported multipolygon relations.
- Detect overlapping duplicate footprints.
- Detect buildings crossing the service-area boundary.
- Distinguish malls from associated office towers.
- Preserve unresolved and conflicting identities in review queues.
- Avoid inventing missing geometry.
- Record when visual geometry is clipped or approximated.

A geometric overlap or shared business name is a candidate matching signal, not automatic proof of identical real-world identity.

## 4.5 Coverage Accounting

Introduce separate measurements for:

- Source acquisition completeness.
- In-scope geographic candidate coverage.
- Valid building-geometry coverage.
- Reviewed building identity coverage.
- Verified company/establishment coverage.
- Approved public entrance coverage.
- Routable pedestrian coverage.

Do not report one combined percentage as “BGC completeness.”

A valid denominator must come from an independently reviewed geographic inventory. The count of raw OSM objects is not an appropriate denominator for unique physical buildings or operating businesses.

---

# 5. Geographic and Business Data Model

## 5.1 Canonical Entity Design

Reuse the existing M4 domain design wherever possible.

Required conceptual relationships:

**Building Complex → Building → Floor → Premises Unit**

**Organization → Business/Office Branch → Occupancy → Premises Unit**

**Place / Building → Public Entrance**

**Entity → Fact → Evidence → Source Snapshot**

Do not create a second database of company identities that conflicts with canonical records.

## 5.2 Business and Company Search

A company record must distinguish:

- Organization identity.
- Display name and aliases.
- BGC office or establishment identity.
- Actual building or complex.
- Floor/unit if verified.
- Geographic location.
- Source citations.
- Last reviewed date.
- Current, historical, candidate or stale occupancy.

An organization may have multiple branches and offices. The same building may have multiple organizations.

Search results should display the specific BGC office when verifiable.

Unknown floor information must remain unknown.

## 5.3 Geographic Locations Versus Entrances

The model must preserve distinct location meanings:

- Building footprint.
- Representative map-label point.
- Source-supported establishment coordinate.
- Verified public entrance.
- Valid navigation connector.

A representative building point may be calculated for label placement, with an explicit derivation method.

It must **never be promoted into a verified entrance or pedestrian-routing endpoint**.

This separation prevents an attractive but incorrect map from producing unsafe navigation instructions.

## 5.4 Temporal Occupancy

Support changes in building occupants without recycling canonical IDs.

For company relocation:

1. Preserve the organization's identity.
2. Retain historical occupancy as dated history.
3. Create or update the appropriate reviewed branch/premises relationship.
4. Re-evaluate dependent facts and search eligibility.
5. Avoid presenting a former office as a current destination.

If evidence is insufficient, classify occupancy as unknown or requiring review.

## 5.5 Data Quality States

Every real-world record should pass through explicit states such as:

| State | Meaning |
|---|---|
| RESEARCH_LEAD | A possible source or entity was discovered |
| CANDIDATE | Parsed and retained, not approved |
| REVIEW_REQUIRED | Identity, location, rights or freshness conflict |
| APPROVED | Required evidence and review passed |
| STALE | Essential facts or permissions no longer satisfy currency rules |
| REJECTED | Invalid or unsupported record |

Reuse existing repository status definitions wherever feasible rather than creating competing strings.

## 5.6 Directory Release Strategy

Use progressive approval.

**Initial release:** Verified principal buildings, major landmarks and a bounded set of independently validated company records.

**Subsequent updates:** Expanded office tenants, shopping-mall establishments, public services, and additional business categories.

Do not block the map geometry release merely because the company directory is incomplete.

However, do not create fictional company locations to make the directory appear complete.

---

# 6. Offline Map Architecture

## 6.1 Core Principle

Retain the existing pipeline:

Source geography → normalized geometry → vector tile generation → PMTiles → MapLibre.

Do not introduce a remote map tile dependency.

## 6.2 Versioned Geographic Packs

Create a new geographic pack identity rather than overwrite the accepted High Street baseline.

The new pack must declare:

- Scope ID.
- Scope version and geometry hash.
- Source snapshot hashes.
- Data/asset permission references.
- Tile format/version.
- Minimum and maximum source zoom.
- Geographic extent.
- Required style/glyph/sprite resources.
- Artifact hashes and byte sizes.
- Review status and compatibility metadata.

Internal candidate artifacts and publicly distributable content packs must remain separate.

## 6.3 Existing Installer Compatibility

The repository's current `PackManifest` has a literal High Street scope and strict validation.

Implement support for the new scope through a reviewed and tested extension of the contract.

Do not simply remove the scope check or accept arbitrary scope IDs from downloaded manifests.

Preferred approach:

1. Add a versioned local registry of approved scope definitions.
2. Validate the manifest scope against that registry.
3. Bind scope ID to the exact approved geometry hash.
4. Require compatible scope/version dependencies between map and content packs.
5. Preserve the exact reviewed manifest digest allowlist.
6. Reject incompatible mixed-scope active packs.
7. Preserve the existing pack rollback design.

If changes to the manifest format become necessary, implement an explicit compatibility migration instead of silently altering v1 semantics.

## 6.4 Atomic Resource Installation

The app must never activate a partially installed geographic release.

Use the existing installation lifecycle:

1. Stage new resources.
2. Validate all files.
3. Verify SHA256 and byte counts.
4. Validate style/source references.
5. Verify dependent content compatibility.
6. Publish the active resource pointer.
7. Retain the previous valid pack for rollback.

Test interrupted installation, insufficient storage, corrupted resources and expired source permissions.

No automatic online download or public catalog entry should be created until the relevant rights, review and distribution gates are satisfied.

## 6.5 Map Zoom and Rendering Levels

Use the existing 2.5D visual approach with progressive detail.

| Zoom tier | Rendering behavior |
|---|---|
| District overview | Major road corridors, parks, landmark labels and building masses |
| Neighborhood | Street labels, commercial building outlines and selected landmarks |
| Street exploration | Detailed buildings, relevant paths, public infrastructure and selected places |
| Close-up | Building facades, verified entrances when available, and high-priority commercial details |

The exact zoom thresholds must be tested against the installed MapLibre implementation and device performance. Do not automatically copy the current pilot's zoom thresholds into the wider scope without visual evaluation.

## 6.6 Building Appearance

Preserve the existing:

- Facade-family styling.
- Height-evidence metadata.
- Building-part treatment.
- Roof styling.
- Pavement and landscaping language.
- Source-specific road geometry.
- Illustrative versus source-derived distinctions.

Buildings with verified source height information can use those values.

Buildings with only floor counts may use explicitly marked visualization estimates.

Buildings with neither should use documented procedural/default height rules.

Unverified heights must not be advertised as measured facts.

## 6.7 Landmark Treatment

Prioritize higher-quality visual QA for:

- SM Aura.
- Market! Market!.
- Uptown Mall.
- Mitsukoshi.
- St. Luke's.
- Shangri-La The Fort.
- Existing High Street landmarks.

For each, verify footprint, building-part treatment, podium/tower relationships, reasonable height interpretation, dominant visual form, and map-label placement.

Photorealistic facade accuracy is not a release requirement.

---

# 7. Mobile Experience Requirements

## 7.1 Map Camera

Remove fixed pilot-boundary checks from `MapCanvas.tsx`.

The replacement should use the active, locally reviewed geographic scope.

Required behaviors:

- Initial camera frames the approved commercial map appropriately.
- Camera reset uses the active scope/default viewpoint.
- Search selection focuses the correct building or place.
- Selection padding respects the currently visible bottom sheet.
- Manual origin continues to work.
- The camera can pan across every supported zone.
- The user receives an accurate unsupported-area state when outside coverage.
- Prior map interactions and gestures remain usable.

Do not silently move an outside point inside the polygon to manufacture a route or place match.

## 7.2 Polygon Membership

Implement reusable geographic predicates with tests.

Required capabilities:

- Point inside supported service area.
- Point on boundary.
- Point in exclusion polygon.
- Point inside separate context area.
- Building polygon intersects supported area.
- Feature crosses scope boundary.
- Scope and map-pack identity validation.

Use consistent coordinate conventions across Python and TypeScript.

Bounding-box checks may serve as preliminary fast filters, never as authoritative membership decisions.

## 7.3 Company Search Experience

Expected flow:

1. User searches for a company, building, mall or establishment.
2. Search retrieves eligible local records.
3. Results identify the specific building or branch.
4. Selecting a result moves the map to the source-supported coordinate.
5. The details sheet shows verified name, address/building, optional floor, category and source status.
6. Directions are available only when a reviewed route exists.

When several companies share the same building, prefer a building-level selection and tenant list over overlapping map markers.

## 7.4 Marker and Label Management

Avoid displaying one marker for every available company at all zoom levels.

Use:

- Zoom-dependent label priority.
- Building-level grouping.
- Category-aware filtering.
- MapLibre-compatible clustering where appropriate.
- Selection highlighting.
- Density limits.
- Progressive disclosure through the details sheet.

At district overview, landmarks and roads should remain legible.

At street level, relevant commercial details may progressively appear.

All filtering must distinguish candidate data from approved public-facing records.

## 7.5 Offline Search

Preserve SQLite FTS5 as the default search foundation.

Index approved and current searchable fields, including company names, aliases, building names, establishment categories and supported office information.

Preserve the current evidence and freshness checks.

Do not use an LLM to fabricate a search result or guess missing coordinates.

If performance profiling demonstrates that the existing directory-search path is insufficient at the larger scale, optimize its SQL/indexing behavior before introducing an external search service.

## 7.6 AI Compatibility

The geography program must not modify model-loading, model-download, inference or AI conversation lifecycles unless a separately approved interface change is required.

The future assistant should use the existing reviewed retrieval service to resolve location requests.

Examples of eventual supported interactions:

- “Where is this company's BGC office?”
- “Show me SM Aura.”
- “Which approved companies are in this building?”
- “Find cafes near Market! Market!”
- “Show the location of St. Luke's.”

The AI may explain or rank retrieved facts, but the app remains responsible for deterministic database selection, coordinates, map focus and navigation eligibility.

All AI location actions should reference real entity IDs returned by validated tools.

---

# 8. Execution Milestones

# GEX-0 — Baseline Audit, Boundary Definition and Approval

**Objective:** Produce an accurate, versioned and independently reviewable geographic scope before modifying the map.

### Tasks

- Confirm clean repository state, latest approved branch and baseline commit.
- Audit pilot manifest, raw geographic evidence, current pack hashes and protected assets.
- Inspect the screenshot and identify all mandatory anchor destinations.
- Locate independently supported source geometries for those anchors.
- Construct candidate polygon and zone partitions.
- Explicitly define external residential exclusions.
- Identify context-only road and transit features.
- Compare polygon to historical acquisition envelope.
- Validate continuity with the existing High Street pilot.
- Check geometry topology and exclusions.
- Document unresolved boundary ambiguities.
- Seek parent review of the project-defined scope.

### Deliverables

- `service-area-v2.json`
- Reviewed zone geometries.
- Exclusion policy and geometry.
- Anchor inventory.
- Boundary QA report.
- Visual boundary comparison.
- Source and decision log.

### Acceptance Criteria

- All mandatory anchors are included using source-supported geometries.
- The existing High Street scope remains covered.
- No invalid polygon topology.
- No unexplained disconnected commercial service-area islands.
- No accidental external residential detailed-coverage expansion.
- All coordinate transforms are reproducible.
- Scope explicitly labeled project-defined, not legal.
- Parent records ACCEPT before GEX-1 integration.

**Gate:** GEX-0 ACCEPTED.

---

# GEX-1 — Reviewed Geographic Acquisition

**Objective:** Acquire and normalize geographic candidates covering the approved v2 scope.

### Tasks

- Review available historical OSM source material and its accepted provenance.
- Determine whether a newly pinned OSM extract is necessary and authorized.
- Pin the exact source version and checksum.
- Acquire permitted supplementary Overture candidates if required.
- Preserve immutable source bytes and metadata.
- Extract in-scope and relevant buffered geographic features.
- Preserve node IDs and complete way geometry.
- Preserve building and multipolygon relation membership.
- Classify buildings, roads, paths, crossings, parks and facilities.
- Record rejected, missing and contradictory source features.
- Produce zone-by-zone discovery inventory.

### Deliverables

- Immutable source-snapshot records.
- Candidate geographic features.
- Raw-to-candidate lineage.
- Acquisition and parsing audit.
- Source license/attribution register.
- Quarantine and duplicate report.
- Zone candidate-count report.

### Acceptance Criteria

- Every retained source feature resolves to a source snapshot.
- No fabricated coordinates.
- No silently repaired invalid geometry.
- Source identity collisions flagged.
- Raw and normalized counts reconciled.
- No unauthorized raw data acquisition.
- Identical inputs produce identical normalized output.
- Review acknowledges that source candidates are not approved world facts.

**Gate:** GEX-1 ACCEPTED.

---

# GEX-2 — Geographic Reconstruction and Spatial QA

**Objective:** Generate source-preserving geographic geometry suitable for accurate map rendering.

### Tasks

- Reconstruct valid multipolygon features.
- Preserve outer rings and interior holes.
- Resolve building-part associations.
- Distinguish mall podiums from tower structures.
- Identify duplicate and overlapping building candidates.
- Classify external residential/context geometry.
- Generate separately clipped rendering geometry.
- Preserve complete geometry for topology and identity review.
- Compute non-authoritative visual label anchors where needed.
- Evaluate priority-building alignment.
- Generate coverage-grid and edge QA reports.

### Special Cases

Test:

- Buildings intersecting service-area boundaries.
- Buildings intersecting exclusion boundaries.
- Multipolygons with interior holes.
- Shared building outlines and independent building parts.
- Disconnected relations and missing nodes.
- Overlapping footprints from different providers.
- Road crossings without connected source nodes.
- Closed private paths and public pedestrian areas.
- Polygon vertices on the exact service-area boundary.

### Deliverables

- Validated geographic layers.
- Building/complex candidate relationships.
- Render-only geometry.
- Geometry validation report.
- Duplicate review queue.
- Gap/coverage matrix.
- Anchor comparison evidence.

### Acceptance Criteria

- All output geometry passes format/topology validation or is explicitly quarantined.
- No silently merged source identities.
- Building-part conflicts are documented.
- Residential exclusions correctly enforced.
- Major anchors pass visual/geometric review.
- No geometry-derived entrance is marked verified.
- Navigation eligibility remains unchanged and conservative.

**Gate:** GEX-2 ACCEPTED.

---

# GEX-3 — Building and Company Directory Integration

**Objective:** Associate approved commercial buildings with verified companies, establishments and public facilities.

### Tasks

- Review existing M4 canonical identity and occupancy schemas.
- Identify minimum additional read-model requirements.
- Build an inventory of key commercial buildings.
- Collect permitted building-level identity evidence.
- Collect permitted company-office and establishment evidence.
- Separate organization, branch, building and premises identities.
- Resolve aliases and repeated company names.
- Preserve historical or ambiguous occupancy separately.
- Verify coordinates against reviewed geographic features.
- Publish only records satisfying existing source-rights and fact-approval gates.
- Generate SQLite projections using the existing controlled export process.

### Deliverables

- Building identity review register.
- Company/organization and branch candidates.
- Building occupancy relationships.
- Source-linked approved records, where permissions allow.
- Directory read-model updates.
- SQLite search-index tests.
- Ambiguity and freshness report.

### Acceptance Criteria

- No name-derived canonical UUIDs.
- No false same-name merges.
- No arbitrary entrance/floor assignment.
- Approved office coordinates and building relationships are consistent.
- Expired occupancy is not represented as current.
- Unknown facts remain unknown.
- Reviewed company search records resolve to the correct building.
- Existing candidate/demo content remains distinguishable from production facts.

### Delivery Note

The initial directory may be intentionally incomplete.

A complete list of office tenants is not required to finish the geographic renderer, but every published tenant record must satisfy its own identity, evidence, currency and use-rights requirements.

**Gate:** GEX-3 ACCEPTED for the reviewed dataset subset.

---

# GEX-4 — Expanded PMTiles and Styling

**Objective:** Produce a fully offline geographic map pack for the approved expanded scope.

### Tasks

- Refactor pack generation to accept a versioned service-area manifest.
- Remove assumptions specific to the pilot rectangle.
- Generate district and street-level vector tiles.
- Retain compatible local style conventions.
- Apply valid exclusion/context filtering.
- Generate building extrusion metadata.
- Verify map labels and glyph ranges.
- Generate or extend resource inventory.
- Validate tile and style references.
- Produce deterministic pack hashes.
- Run automated and visual map QA.

### Deliverables

- Candidate expanded `.pmtiles` archive.
- Expanded MapLibre style.
- Required local sprites/glyphs.
- Artifact manifest and checksums.
- Layer/feature inventory.
- Pack size and tile-count report.
- Reproducibility test results.
- Landmark and tile-boundary screenshots.

### Acceptance Criteria

- No unexplained blank map regions inside approved coverage.
- No missing expected tile payloads within the required zoom range.
- Road and building geometries align across tile boundaries.
- Building part rendering does not systematically create hidden or doubled towers.
- Styles pass applicable MapLibre validation.
- All referenced resources resolve offline.
- Existing visual hierarchy remains recognizable.
- All source-derived labels/fonts are supported.
- Rebuilding from identical approved inputs yields identical artifacts.

**Gate:** GEX-4 ACCEPTED as an internal geographic artifact.

---

# GEX-5 — MapLibre Mobile Integration

**Objective:** Make the expanded map navigable through the existing Omni-BGC mobile application.

### Tasks

- Implement a validated active-scope loader.
- Replace fixed `MapCanvas` bounds checks.
- Add polygon-aware coverage evaluation.
- Update initial camera and reset behavior.
- Integrate the expanded style and PMTiles resources.
- Preserve existing native map lifecycle.
- Integrate reviewed company/building search.
- Update place details and map selection.
- Preserve manual-origin and saved-place behavior.
- Ensure no unsupported route becomes available.
- Verify content-pack and map-scope compatibility.
- Maintain bounded user-visible error states.

### Deliverables

- Updated map and app integration.
- Active-scope contract.
- Expanded search and selection behavior.
- Local pack compatibility checks.
- Host-test results.
- Native integration evidence.

### Acceptance Criteria

- App launches with reviewed expanded offline resources.
- Users can pan and zoom throughout supported commercial zones.
- Search selection focuses correct reviewed destinations.
- Existing pilot search and map interactions still work.
- Unsupported regions are handled accurately.
- No incorrect “outside map area” warnings inside scope.
- No repeated camera focus or blank map caused by region transitions.
- No unrelated changes to AI inference behavior.
- No unapproved walking routes.

**Gate:** GEX-5 ACCEPTED for integration testing.

---

# GEX-6 — Android QA, Performance and Regression

**Objective:** Establish that the expanded map works correctly and reliably on a physical Android device.

### Required Tests

**Geographic tests**

- Verify all mandatory anchor locations.
- Pan from High Street to Uptown.
- Pan from central BGC toward SM Aura.
- Pan from SM Aura toward Market! Market!.
- Search and focus on multiple buildings across different zones.
- Verify boundary and exclusion behavior.
- Inspect camera transitions, tile edges and layer changes.

**Offline tests**

- Install reviewed resources.
- Enable airplane mode.
- Cold-launch the app.
- Pan across all supported zones.
- Search approved locations.
- Open place details.
- Switch Map and Assistant screens.
- Background and resume the application.
- Restart and verify installed resources.

**Integrity tests**

- Corrupted tile archive.
- Missing sprite or glyph.
- Manifest checksum mismatch.
- Incompatible map/directory scope.
- Interrupted pack installation.
- Out-of-storage failure.
- Stale or invalid manifest.
- Restoring a previous valid pack.

**Behavioral regression**

- Existing High Street search.
- Selected-place highlighting.
- Map gestures.
- Bottom-sheet camera padding.
- Manual origin.
- Saved places.
- Existing content-pack recovery.
- Screen-reader and text-scaling behavior.
- Current no-route policy.

**Resource contention**

When a tested local AI runtime is available, perform additional measurements with:

- AI model unloaded.
- AI model loaded but idle.
- AI generating while map is visible, where the architecture permits.
- App switching between map and AI screens.

Record memory pressure, rendering failures and lifecycle behavior. Do not block the geography-only functional gate on an AI model that is not yet available.

### Performance Metrics

Measure on the named reference device:

- Cold startup time.
- Time to first fully rendered map.
- Frame-time distribution.
- Memory consumption.
- Map-pack storage size.
- Tile decode/loading behavior.
- Search p50 and p95 latency.
- Camera transition latency.
- App crashes/ANRs.
- Battery/thermal trends for extended use.

Initial aspirational targets:

- Smooth exploration near 45–60 FPS where the device and baseline support it.
- Indexed local search p95 below 300 ms for a representative query workload.
- Zero reproducible blank-render transitions or missing required resources.
- No statistically meaningful regression in existing core operations without explicit review.

These are engineering targets, not validated benchmarks. Establish the actual budget after recording baseline hardware performance.

### Deliverables

- Installable internal Android artifact.
- Hardware and software test environment record.
- Before/after performance comparison.
- Screenshots and screen recordings.
- Functional test matrix.
- Crash/error logs.
- Regression evidence.
- Remaining limitations and blocked tests.

### Acceptance Criteria

- Mandatory functional tests PASS.
- Native map renders successfully across the defined coverage.
- Offline functionality verified on real hardware.
- No significant unaddressed reliability defects.
- Integrity/recovery tests PASS.
- Existing High Street regression suite PASS.
- Accessibility-critical defects resolved.
- Parent independently reviews the results.

**Gate:** GEX-6 READY_FOR_RELEASE_REVIEW.

---

# GEX-7 — Distribution Review and Controlled Release

**Objective:** Release only the geographic content and application changes that have passed the relevant publication, license and native-device gates.

### Tasks

- Review all data-source permissions and attribution.
- Verify exact approved manifests and datasets.
- Confirm current source/record eligibility.
- Confirm geographic and company data are publication-eligible.
- Produce an exact approved resource catalog if applicable.
- Review map/places pack dependency compatibility.
- Perform final regression and Android installation tests.
- Preserve a rollback path.
- Document the release version and source coverage limitations.
- Obtain explicit authorization before publication.

### Deliverables

- Release approval record.
- Distribution rights report.
- Reviewed artifact hashes.
- Versioned release manifest.
- Installation/rollback instructions.
- User-visible geographic coverage disclosure.
- Final implementation handoff.

### Acceptance Criteria

- No internal-only research assets inadvertently distributed.
- All public release data and resources have sufficient rights.
- Required attribution remains visible.
- Exact source and artifact lineage retained.
- Public-facing company and geographic claims are supported.
- Reviewed rollback tested.
- No unreviewed graph or assistant capabilities silently enabled.

**Gate:** GEX-7 RELEASE APPROVED.

---

# GEX-8 — Optional Future Navigation Extension

This milestone is intentionally independent of the geographic expansion release.

It should begin only when public access, entrances, crossing connectivity and routing graph topology can be reviewed adequately.

Do not enable real navigation just because geographic geometry is displayed.

Required future work includes:

- Entrance surveys.
- Original source-node topology preservation.
- Reviewed public access rules.
- Crossing and barrier verification.
- Walking graph coverage analysis.
- Origin/entrance connector approval.
- Path-access expiry and QA.
- Accessibility-specific review where supported.
- Independent physical navigation testing.

Existing A* and graph contracts should be reused.

The output of GEX-1 or GEX-2 must not directly create navigation-eligible edges.

---

# 9. Implementation Dependency Structure

Recommended execution order:

**GEX-0 → GEX-1 → GEX-2 → GEX-4 → GEX-5 → GEX-6 → GEX-7**

GEX-3 can execute in parallel after GEX-1 establishes source identity and GEX-0 approves the scope, provided database owners coordinate changes.

A geographic-only internal preview can reach GEX-5 before the wider company directory is complete.

However, the release must distinguish:

- Geographic rendering coverage.
- Searchable approved directory coverage.
- Verified office occupancy coverage.
- Pedestrian navigation coverage.

Each can have a different completion status.

GEX-8 is an independent future program and must not be treated as a dependency for the map expansion release.

---

# 10. Agent Coordination and Branch Strategy

## 10.1 Engineering Roles

**Parent integration and architecture reviewer**

Owns scope decisions, branch coordination, shared contract review, acceptance gates and merge authorization.

**GIS/data engineer**

Owns geographic acquisition, polygon validation, geometry processing, source identities, clipping and topology QA.

**Business data engineer**

Owns building/organization relationships, office occupancy, source evidence, freshness and reviewed SQLite projections.

**Map and rendering engineer**

Owns vector tile packaging, MapLibre styling, building representation and offline resource validation.

**React Native engineer**

Owns camera state, map integration, search UX, active-scope loading, storage integration and mobile lifecycle.

**Independent QA reviewer**

Runs adversarial tests, reviews source integrity, performs physical-device checks and challenges unsupported completion claims.

The same person or agent may fill multiple roles, but independent acceptance should remain separate from implementation.

## 10.2 Branching

Suggested feature branches:

- `codex/gex-0-scope`
- `codex/gex-1-geography`
- `codex/gex-2-geometry`
- `codex/gex-3-directory`
- `codex/gex-4-map-pack`
- `codex/gex-5-mobile`
- `codex/gex-6-validation`

Actual branch names may be adapted to repository conventions.

The AI implementation must retain ownership of inference-related modules.

Do not allow two agents to concurrently modify shared manifests, the same database migration, or update-contract code without explicit integration sequencing.

## 10.3 Integration Rules

- Work from a clean and recorded baseline.
- Preserve unrelated worktree changes.
- Never force-push or reset someone else's branch.
- Never overwrite previously approved evidence.
- Resolve changes through reviewed patches.
- Do not merge automatically after a subagent reports success.
- Do not reinterpret local host tests as physical-device proof.
- Record any baseline drift and re-review affected contracts before integration.

---

# 11. Testing and Validation Framework

## 11.1 Unit and Property-Based Tests

Add focused tests for:

- Polygon validity and coordinate order.
- Point-in-polygon, boundary and hole semantics.
- Projected metric buffering.
- Building/part associations.
- Feature clipping behavior.
- Source and identity preservation.
- Duplicate candidate review.
- Data freshness and occupancy.
- Search eligibility.
- Missing coordinates/entrances.
- Pack scope and dependency validation.

## 11.2 Integration Tests

Validate the complete workflow:

Pinned source → reviewed scope → GIS normalization → map tile pack → native rendering.

Separately validate:

Approved entity source → staging/review → SQLite projection → mobile search → map selection.

Ensure geographic scope changes are represented consistently across both flows.

## 11.3 Existing Quality Commands

Run relevant existing repository checks, including:

- `npm run typecheck --prefix apps/mobile`
- `npm run lint --prefix apps/mobile`
- `npm run format:check --prefix apps/mobile`
- `npm run check:dependencies --prefix apps/mobile`
- `npm run test:unit --prefix apps/mobile`
- `python apps/mobile/scripts/quality.py --output .g/gex/quality`
- `node pipelines/map-pack/check.mjs`

Use the established GIS, source-governance, database and routing test suites for touched components.

Where a command depends on ignored generated data, native toolchains, or additional approved assets, record the prerequisite and the actual result rather than substituting fabricated fixtures as proof of real-data acceptance.

## 11.4 Acceptance Matrix

| Test domain | Required result |
|---|---|
| Existing High Street behavior | No unexpected regression |
| Polygon validity | PASS |
| Mandatory anchor coverage | All reviewed anchors included |
| External residential exclusions | PASS |
| Source identities and hashes | PASS |
| Building/part geometry validation | PASS or explicit quarantine |
| Geographic reproducibility | PASS |
| Tile coverage and style references | PASS |
| Offline asset completeness | PASS |
| Company/building link correctness | PASS for published records |
| Candidate/approved separation | PASS |
| Manifest and pack recovery | PASS |
| Existing no-route protection | PASS |
| Native Android coverage | PASS |
| Physical-device performance | Measured and accepted |
| Public source rights | PASS before distribution |

No blanket “100% BGC coverage” claim should be produced without defensible denominators for the specific relevant measurement.

---

# 12. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Inaccurate boundary | Missing commercial destinations or unwanted residential expansion | GEX-0 polygon/anchor review |
| Historical or incomplete source data | Incorrect geography | Pinned snapshots, reconciliation and current-world review |
| Competing building identities | Wrong company locations | Source-backed building/occupancy model |
| Unresolved multipolygons | Broken malls/buildings | Relation reconstruction and geometry QA |
| Missing company/tenant evidence | Incomplete directory | Partial coverage with explicit unknowns |
| Licensing restrictions | Illegal or unauthorized offline redistribution | Existing source-use and human review gates |
| Large tile pack | Slow loading or storage pressure | Real benchmarks; simplify by zoom before changing architecture |
| Scope contract mismatch | Rejected or inconsistent content packs | Versioned scope registry and dependency tests |
| Rendering regression | Blank screens or navigation failure | Multi-zone device regression |
| AI/map memory contention | Crashes or poor performance | Separate resource measurements |
| False navigation claims | Unsafe user instructions | Preserve zero-edge/verified-entry gates |
| Parallel branch collisions | Lost changes or inconsistent schemas | Explicit owner and merge ordering |

Every unresolved material risk must have a documented owner and disposition before the affected milestone can pass.

---

# 13. Rollback and Recovery

Rollback must be designed before replacing the existing High Street resources.

Required guarantees:

1. Preserve existing approved pilot artifacts.
2. Keep local user data separate from replaceable geographic content.
3. Do not activate a partially verified pack.
4. Reject incompatible source/scope dependencies.
5. Retain a last-known-good content/resource version.
6. Restore a valid previous version when activation fails.
7. Present an honest error when required resources are unavailable.
8. Do not fall back to unapproved online tiles.
9. Do not silently substitute synthetic businesses or unverified geography.
10. Preserve evidence of failed installation and recovery.

A rollback must not delete saved places, itinerary data or unrelated local user state.

---

# 14. Documentation and Handoff Requirements

Every GEX milestone must produce:

- Scope and assumptions.
- Explicit changed files.
- Tool and dependency versions.
- Source snapshots and checksums where applicable.
- New architectural decisions.
- Implementation summary.
- Test commands actually executed.
- Actual pass/fail/skip results.
- Geographic or visual evidence.
- Unresolved gaps.
- Source/licensing status.
- Native test status.
- Recommended next milestone.
- Parent-review decision.

Suggested documentation:

- `docs/geography/GEX_IMPLEMENTATION_PLAN.md`
- `docs/geography/GEX_SCOPE.md`
- `docs/geography/GEX_SOURCE_REGISTER.md`
- `docs/geography/GEX_QA_MATRIX.md`
- `docs/geography/GEX_RELEASE_HANDOFF.md`
- `docs/evaluations/gex/...`

Respect the repository's existing decision journal and protected evaluation artifacts.

### Parent Review Protocol

For each milestone:

1. Worker submits implementation and evidence.
2. Parent inspects contracts, code and sources.
3. Parent independently reruns relevant validation.
4. Parent identifies unsupported claims or counterexamples.
5. Worker corrects issues.
6. Parent records ACCEPT, CHANGES_REQUESTED, REJECT, or a clearly scoped PARTIAL decision.
7. Only accepted outputs become dependencies of the next integration milestone.

---

# 15. Time and Delivery Estimates

The following is a planning estimate, not an implementation commitment.

| Workstream | Approximate effort |
|---|---|
| GEX-0 Boundary and design | 1–2 days |
| GEX-1 Geographic acquisition | 2–4 days |
| GEX-2 Reconstruction and QA | 2–4 days |
| GEX-3 Initial directory integration | 3–6 days |
| GEX-4 Offline map packaging | 2–4 days |
| GEX-5 Mobile integration | 2–4 days |
| GEX-6 Device validation | 2–4 days |
| GEX-7 Rights/release review | Dependent on permissions and acceptance |
| GEX-8 Navigation | Separate future estimate |

Some milestones can run in parallel.

A geographically expanded internal Android preview is tentatively achievable within 2–4 weeks of focused engineering effort, assuming source access and the development environment are available.

A complete, current company/tenant directory and public redistribution approval have no reliable fixed delivery estimate at this stage.

---

# 16. Definition of Done

## Geographic MVP

The geographic MVP is complete when:

- GEX-0 scope is approved.
- Source-preserving GIS processing passes.
- Required anchors display correctly.
- The expanded area renders offline.
- Residential exclusions behave correctly.
- Existing High Street functionality remains intact.
- Device integration checks pass.
- No unsupported navigation or source claims are introduced.

## Directory MVP

The directory MVP is complete when:

- Approved businesses and company offices are searchable.
- Published records resolve to verified building identities.
- Search operates offline.
- Source evidence and freshness are available.
- Unverified records cannot masquerade as approved facts.
- The directory and map use compatible geographic scope metadata.

## Internal Release Readiness

Internal readiness requires geographic and native test acceptance, with candidate or rights-restricted material confined to explicitly authorized internal uses.

## Public Release Readiness

Public release additionally requires appropriate source rights, redistribution authorization, compatible exact manifests, permitted assets, correct attribution, publication approval and a validated rollback path.

## Explicitly Not Required for Geographic MVP

- Native local LLM completion.
- Full company census.
- Complete indoor maps.
- Real-time transit.
- Public pedestrian navigation.
- Photorealistic city modeling.

---

# 17. Recommended Engineering Decisions

Adopt the following as proposed defaults, subject to GEX-0 approval:

**Decision GEX-D01:** Use a project-defined commercial service-area polygon, not a claimed legal BGC boundary.

**Decision GEX-D02:** Preserve High Street v1 artifacts and introduce a new versioned geographic scope.

**Decision GEX-D03:** Keep external residential areas context-only or excluded from detailed coverage.

**Decision GEX-D04:** Use OSM as the geographic baseline, with independently reviewed complementary sources.

**Decision GEX-D05:** Reuse the current MapLibre and offline PMTiles architecture.

**Decision GEX-D06:** Reuse existing canonical building/company/occupancy identity contracts.

**Decision GEX-D07:** Keep directory approval separate from map-geometry rendering completeness.

**Decision GEX-D08:** Replace hard-coded scope checks with reviewed active-scope contracts, not unrestricted dynamic manifests.

**Decision GEX-D09:** Keep pedestrian routing disabled unless independently approved graph evidence exists.

**Decision GEX-D10:** Preserve AI runtime isolation and expose geographic information through deterministic reviewed retrieval.

**Decision GEX-D11:** Benchmark one expanded PMTiles pack before adding pack partitioning or streaming complexity.

**Decision GEX-D12:** Require real-device acceptance and explicit source-rights authorization before distribution.

These are proposed decisions, not claims of prior acceptance. Assign official decision journal identifiers through the repository's established review process.

---

# 18. Authoritative Engineering References

Primary documentation should be used to verify implementation decisions and detect changes in external schema or SDK behavior.

**Project repository and contracts**

- https://github.com/supertaku/omni-bgc
- `AGENTS.md`
- `README.md`
- `docs/architecture/M3_GIS_INGEST.md`
- `docs/architecture/M4_CANONICAL_DATABASE.md`
- `docs/evaluations/m4/comprehensive/REPORT.md`
- `docs/UX_MAP_SPEC.md`
- `docs/OFFLINE_AI_IMPLEMENTATION_PLAN.md`
- `docs/refactoring/R1_IMPLEMENTATION_REPORT.md`

**Geographic acquisition**

- https://download.geofabrik.de/asia/philippines.html
- https://docs.overturemaps.org/getting-data/
- https://docs.overturemaps.org/guides/buildings/
- https://docs.overturemaps.org/guides/places/

**Licensing and map usage**

- https://operations.osmfoundation.org/policies/tiles/
- https://operations.osmfoundation.org/policies/vector/
- https://www.openstreetmap.org/copyright
- https://docs.overturemaps.org/attribution/

**Rendering and offline map resources**

- https://maplibre.org/maplibre-native/android/examples/data/PMTiles/
- https://maplibre.org/maplibre-style-spec/
- https://maplibre.org/maplibre-style-spec/sources/
- https://maplibre.org/maplibre-react-native/docs/setup/getting-started/

**Spatial and retrieval foundations**

- https://postgis.net/docs/
- https://shapely.readthedocs.io/
- https://pyproj4.github.io/pyproj/stable/
- https://www.sqlite.org/fts5.html
- https://www.sqlite.org/rtree.html

Do not treat architectural examples as proof that a particular API works with Omni-BGC's pinned native dependency versions. Verify compatibility against the installed versions and Android runtime.

---

# 19. Initial Implementation Instructions for Codex

## Engineering Role

Act as the parent Staff GIS, React Native, MapLibre, Data Architecture and QA Engineer responsible for implementing Omni-BGC's GEX geographic-expansion program.

Use the existing repository as the source of truth.

Do not rebuild the application or replace existing approved infrastructure without evidence of a specific technical requirement.

## Initial Task

Begin with **GEX-0 only**.

Before writing code:

1. Fetch and inspect the current repository and branch state.
2. Read `AGENTS.md` and the relevant GIS, database, map and scope documentation.
3. Review the existing High Street geographic contracts.
4. Inspect the screenshot-derived geographic expansion requirements.
5. Identify all geographic, source-rights and repository-contract ambiguities.
6. Produce a short task plan with risks, test strategy and expected artifacts.

Then:

7. Research the required commercial geographic anchors.
8. Construct a candidate expanded service-area polygon.
9. Preserve explicitly excluded external residential areas.
10. Validate geometry, coverage continuity and coordinate reference systems.
11. Produce versioned scope files and evidence.
12. Independently verify all geographic scope decisions.
13. Submit results for parent acceptance before initiating GEX-1.

## Autonomous Execution Rules

After GEX-0 acceptance, proceed through approved milestones in dependency order.

Independent workstreams may run concurrently when they do not modify competing contracts or shared files.

Do not bypass explicit parent, user, licensing or publication approvals.

Do not silently substitute:

- Candidate data for approved data.
- Estimates for verified geographic measurements.
- Source-object counts for physical building counts.
- A building centroid for an entrance.
- A geographic acquisition buffer for supported routing.
- Synthetic test success for physical-device success.
- Available public web content for an offline redistribution license.

## Reporting

At the end of each milestone, provide:

- Completed work.
- Changed paths.
- Test results.
- Source evidence and hashes.
- Remaining blockers.
- Independent review status.
- Recommendation for the next milestone.

Do not mark the entire GEX program complete unless every mandatory acceptance gate for the targeted release level has actually passed.

---

# Final Success Statement

**The objective is to transform Omni-BGC from a High Street pilot into a reliable, offline commercial-district explorer with geographically correct buildings, streets, landmarks and verified company locations extending through Uptown, SM Aura and Market! Market!, while excluding external residential neighborhoods from detailed coverage.**

**Geographic accuracy, source integrity, offline reliability, performance and maintainability take precedence over visual complexity and unverified directory completeness.**

The first implementation milestone is **GEX-0 — Geographic Scope Definition and Approval**. Subsequent development must build on its accepted outputs rather than independently guessing the geographic extent.