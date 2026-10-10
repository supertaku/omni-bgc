# Omni-BGC — Pre-AI Engineering Implementation Plan

> Historical pre-AI baseline. The user's 2026-10-11 instruction authorizes the subsequent [offline AI program](OFFLINE_AI_IMPLEMENTATION_PLAN.md). Its audit and physical-device benchmark gates precede production runtime selection; the engineering/data invariants below still apply. UX V2.1 decisions DEC-049–051 supersede earlier navigation/presentation scope.

**Version:** 1.0 | **Prepared:** 2026-10-09 | **Status:** Proposed baseline, pending repo/device audit  
**Platforms:** Android first; iOS compatibility maintained | **Operating mode:** Offline-first  
**Boundary:** No on-device LLM, model downloads, embeddings, RAG generation, AI orchestration, or AI itinerary reasoning in this program. Deliver the assistant *UI shell only*.

## 1. Product contract and acceptance scenario

Omni-BGC is an original, colorful, game-inspired but geospatially accurate BGC explorer. Main tabs: **Map** and **Assistant**. The Map tab is the functional product in this phase; Assistant is an accessible, polished, non-deceptive preview with local visual fixtures or an explicit “Coming in a later release” state. It must not simulate real AI or imply that fabricated data are verified.

Core offline journey: install the release APK and obtain the required offline pack; disable Wi-Fi and mobile data; force-stop and relaunch; pan/zoom BGC; filter places; search verified business/menu records; inspect a place; select manual origin or request GPS; choose destination entrance; render a navigable pedestrian path; save a local itinerary/list; browse verified bus stops/routes; open the Assistant UI without crashing. No account required.

Do not treat the name “everything inside BGC” as a promise of complete coverage. Track coverage by sub-area, category, evidence freshness, and verified vs candidate status. Represent gaps visibly.

## 2. Quality invariants

1. Geographic coordinates are real, stored as WGS84 `(longitude, latitude)` for GeoJSON and correctly labeled `latitude/longitude` in device APIs. All distance calculation uses a projected CRS in meters or geodesic calculation. Never interpret lat/lon degrees as meters.
2. Offline map rendering and basic POI search/navigation require **no** third-party runtime requests.
3. No fabricated businesses, dishes, hours, prices, entrances, routes, or passenger facilities. Source, retrieval date, license, verification state and validity period are mandatory for user-facing facts.
4. A navigable route follows the walkable graph; a straight bearing line is allowed only with explicit “direction only” labeling.
5. A building, an establishment (tenant), and an entrance are separate entities; one building can contain many tenants and entrances.
6. A user can fully use the Map screen without granting location permission. Device location accuracy/age is displayed; manual pin always remains available.
7. Map appearance is distinctive but secondary to legibility: never cover the route with excessive 3D features or decorative labels.
8. The app remains usable without an AI model and without signing in.
9. All native dependency choices are proven on a physical Android test device; compatibility with iOS is checked through official library support and later builds, not assumed.
10. Parent reviewer signs off every milestone. Compilation success alone does not imply correctness.

## 3. Proposed stack and its rationale

| Tool | Why | How it is used | Validation |
|---|---|---|---|
| Expo / React Native / TypeScript | Shared Android+iOS UI with mature native integration | Expo Router, strict TS, native development builds | Clean install, tests, debug and release builds |
| MapLibre React Native | Native GPU map camera, layers, labels, extrusions, offline manager | MapLibre style JSON, GeoJSON source and tiles | Physical-device pan/zoom, fonts and sprites offline |
| SQLite + FTS5 | Stable, compact transactional on-device POI data + lexical search | Migrated tables, FTS triggers, prebuilt indexes | Integrity and deterministic query tests |
| R-Tree or spatial bounding boxes | Efficient nearby candidate lookup | R-tree index, precise geodesic distance post-filter | Correct proximity over boundary cases |
| Python + GeoPandas/Shapely | Reproducible geographic ETL | Transform, validate, normalize, split input layers | Geometry tests, diff reports |
| OSMnx + NetworkX | Rapid pedestrian-network foundation | Build graph, validate topology, export mobile-friendly weighted nodes/edges | Graph quality and field route review |
| Osmium / GDAL / QGIS | Regional extraction and manual GIS inspection | Clip licensed PBF; visualize and correct suspect geometries | Reproducible GIS pipeline and QA artifacts |
| Tippecanoe or alternative tile generator | Create compact stylable vector tiles | Prepare appropriate zoom-level layers | Device archive-size / visual tests |
| PMTiles or MapLibre offline packs | Offline geographic resource distribution | Compare local archive vs downloaded region with complete style assets | **Decision deferred until Android + iOS prototype** |
| Expo Location | Foreground device positioning | Permission on request; accuracy/staleness gates | Outdoor/device field scenarios |
| Zustand or minimal state store | Shared search/filter/map selection state | Small normalized app-level state; avoid duplicate models | State restoration tests |
| React Native Reanimated + Gesture Handler + bottom-sheet library | Smooth contextual sheets and touch interactions | One draggable detail sheet at a time | Gesture conflict / accessibility QA |
| Figma | Map-first design system, interaction studies | Low-fidelity wireframes, visual tokens and variants | Five task usability tests |
| Jest/Vitest, React Native Testing Library, Maestro/Detox | Unit, UI and end-to-end confidence | Deterministic data, mocked location + physical device smoke tests | CI pass, test recordings |
| GitHub Actions | Reproducible quality gating | Typecheck, lint, data validation, tests, assets checks | Required checks on PR |

Tool/version choices are provisional until M0. No production app may reference demonstration tile URLs.

## 4. Canonical data acquisition program (critical path)

### 4.1 Source priority, compliance, and scope

- P0: OpenStreetMap raw *data* from licensed Geofabrik extracts; existing project geospatial assets subject to origin/license checks; independently observed public geographic facts.
- P1: Official BGC directories, mall/operator tenant lists, operator transit guidance, merchant-controlled websites and menus. Treat public pages as **verification leads**, not automatic republication permission.
- P2: Field-verified storefronts, building signage, merchant-submitted business/menu records with consent/license metadata and retention terms.
- P3: Community error reports submitted through moderated channels; no public unmoderated overwrites.
- Never create offline caches of OpenStreetMap Foundation **public raster tiles**; public tile policy prohibits bulk/offline downloads. Self-generate vector tiles from licensed data or license a provider permitting offline packages.
- Review ODbL attribution and derivative database obligations, and separate OSM-derived layers from independently licensed merchant/media layers. Commercial directory/menu/photo rights need explicit case-by-case checks. Legal review before distribution.

### 4.2 Geographic area model

Obtain an approved **BGC service-area polygon** from a reliable source or explicitly define/document a project coverage boundary. Do not treat a convenient bbox as an official legal district boundary. Buffer the ingest area sufficiently to connect access paths and terminals outside the target polygon; visually show the supported region and boundary behavior. Use named subzones for completeness reporting (e.g. High Street pilot; North/Uptown; central; south/perimeter), pending validation.

### 4.3 Taxonomy

Buildings/complexes; building entrances/exits and access points; outdoor walkways; sidewalks; pedestrian crossings; bridges and passages; parks; public restrooms; stairs/ramps; parking; transit stops/terminals; transit routes and schedules; restaurants/cafes; menus and dish tags; retail/malls; offices/coworking; accommodation; banks/ATMs; clinics; pharmacies; schools; government/public services; entertainment and attractions; accessibility features.

Menus have their own level of evidence: dish name, optional description, price/currency/last price check, potential allergen tag (unverified unless explicitly confirmed), availability window, source, source license, last-verified and restaurant association. Do not infer actual ingredients from cuisine or marketing images. Preserve absent versus not-applicable versus unverified.

### 4.4 Source evidence and entity resolution

Every source import must record: `source_id`, authority/owner, canonical URL/document ID, license/consent, retrieval timestamp, publication date if known, usage restrictions, raw-content checksum, extractor version and reviewer. A fact needs `evidence_id`, `observed_at`, `verified_at`, `verification_method`, `status`, `confidence_reason`, and optionally `valid_from/valid_to`.

Stable identifiers use UUIDs or immutable canonical IDs **not based on the current name or coordinate**. Maintain aliases; store external OSM IDs separately. Entity resolution combines normalized names, building relationships, address/floor, phone if lawfully available, and spatial proximity; send ambiguous candidates to review. Prevent silent merge of different branches in one mall or nearby buildings. Track closures, moves and historical records without destroying audit trails.

Pipeline: SOURCE INVENTORY -> LICENSE GATE -> RAW SNAPSHOT -> PARSE -> NORMALIZE -> GEOLOCATE -> ENTITY MATCH -> CLASSIFY -> GEOMETRY QA -> EVIDENCE REVIEW -> APPROVE -> EXPORT -> OFFLINE PACK -> DEVICE TEST.

### 4.5 Coverage metrics / audit sample

Measure candidate places, source-supported places, verified places, entrance coverage, verified menus, menu-item currency, transit route coverage, and routable entrances per category and zone. Define the denominator from *two or more independently collected inventories* when possible; never claim 100% BGC coverage solely because every imported item passed checks. Each source snapshot must be versioned.

Pilot target (engineering gate, not a count of existing businesses): 30–60 approved distinct POIs spanning at least eight categories, 10–15 restaurants with usable source-supported cuisine/menu coverage, 15+ verified destination entrances, and a connected pedestrian subgraph with representative crossing conditions. Increase targets only after baseline census confirms feasibility.

For reviews, use a stratified sample by category and location rather than only spot-checking easiest central landmarks. Treat accessibility, sidewalk barriers, one-way pedestrian gates and entrance position as high-priority field verification.

### 4.6 Fieldwork operations

Use a field-survey checklist and structured form: place ID/candidate ID, facade/entrance position, street-side, venue/floor, open/closed state, available hours and contacts, pedestrian accessibility, observed signage, survey time, surveyor, evidence record and consent if collecting private material. No need to collect personal images/identifiers. Publish photos only with permissions. Field surveys confirm facts; avoid trespass and restricted areas.

### 4.7 Refresh and incident management

Daily/weekly: discover changes and pending queue; monthly targeted refresh of high-change restaurants and malls; operator-event-driven transit refresh; geometry periodic release; immediately flag unsafe routing corrections. These are operational goals, not claims about source refresh schedules.

Use diff reports and a reversible approval process. Record prior values and reasons. Expose “last verified” or “information may have changed” as appropriate. A user report never changes public facts before human or trusted-source review.

## 5. Proposed normalized database

`service_area`, `zone`, `building`, `building_geometry`, `entrance`, `place`, `place_alias`, `business`, `category`, `place_category`, `menu`, `menu_item`, `menu_tag`, `operating_hours`, `holiday_exception`, `public_facility`, `transit_agency`, `transit_route`, `transit_stop`, `transit_trip`, `transit_stop_time`, `source`, `evidence`, `fact_evidence`, `review_queue`, `audit_event`, `route_node`, `route_edge`, `route_access_restriction`, `saved_place`, `saved_itinerary`, `saved_itinerary_stop`, `pack_manifest`, `schema_migration`.

Indexes: FTS5 on names/aliases/menu descriptions; category/zone/building composite indexes; bounding boxes via R-tree; separate immutable graph IDs and snapping indexes. Build a normalized editing/staging schema and a separate compact read-optimized mobile distribution schema. Avoid a remote production API dependency.

Coordinates: use WGS84 consistently in exports; route-weight lengths measured in meters in a suitable local projection or geodesic method. Model entrance coordinates and floor levels distinctly from tenant display points.

## 6. Map rendering and UI/UX design contract

### 6.1 Visual philosophy

Game-like, inviting and distinctive, but **not a game engine reproduction and not derivative of Pokémon IP**. Render geographic roads/paths and building footprints faithfully; stylize geometry with original palette, limited 2.5D extrusions, textured greenery and landmark icons. Perspective tilt is moderate for exploration, minimal/flat during routing. Use real geometry for hit-testing and routing; decor has no navigation authority.

**Suggested color tokens (provisional):** ink `#10243A`; canvas `#F7F6F0`; navigation blue `#276EF1`; teal `#13B69E`; park green `#A7D48E`; path `#FFFFFF`; route outline navy + blue center. Enforce contrast with real on-device overlays. Logo concept artwork is a design starting point, not approved final geometry or export.

### 6.2 Minimal-screen layout

- Full-bleed map is dominant.
- A single rounded search field at top (tap opens search results); an optional horizontal chip row: All, Food, Coffee, Offices, Shops, More. Keep to one row; do not show the entire taxonomy at once.
- One floating “locate me” button in comfortable thumb reach; optional layers action inside overflow / map settings, not a column of FABs.
- 2-item primary navigation: **Map**, **Assistant**. Saved places/itineraries and preferences from contextual settings rather than extra persistent tabs.
- Place selected: compact peek sheet with name, category, walking distance (only if origin known), confidence/freshness cue, prominent Directions action, secondary Save, and drag-to-expand. Expanded sheet offers menus, hours, accessibility, entrances and sources.
- Route active: replace discovery chips with minimal direction banner; bottom navigation summary and route actions; visible path remains visually dominant. No simultaneous tall place sheet, large filters and route instructions.
- Filters: dedicated sheet with categories and optional toggles; chosen chips summarized in one row. Provide obvious clear/reset and results count.
- Search: text field -> local suggestions / results with map/list switch; keyboard dismissal and focus restoration; no need to open chat for deterministic search.
- When map contains dense POIs, use category-dependent zoom thresholds and clustering; do not display a sea of identical markers.
- Portrait phone is reference layout. Tablet/landscape adapts to side sheet.

### 6.3 Interaction budget and friction goals

No onboarding blocker, no compulsory account, no required GPS permission. Search/place details/directions reachable with clear direct controls. Primary map exploration should keep about 65–75% of the viewport unobstructed at rest (design objective measured per device, not a physical constant). Buttons at least 48 dp touch areas; support TalkBack and scalable text. No hidden gestures as the only way to perform actions. Test one-handed operation and assistive tech.

**Non-negotiable scenarios:** direct category filtering; a building containing multiple tenants; ambiguous same-name establishments; selected multi-entrance destination; long menu and empty menu; user outside service boundary; no network; missing GPS; invalid route; stale transit timetable; very long place names; font scaling; keyboard plus bottom sheet; offline assets missing; orientation switch; app resume after backgrounding.

### 6.4 Design deliverables and visual acceptance

Figma tokens/components; low- and high-fidelity designs for map idle, filter sheet, search results, place peek/expanded, location selection, navigation, transit routes, saved itinerary, assistant UI shell, offline pack status, errors, permission denial, data freshness. Usability study with at least five diverse participants (initial heuristic test) then iterate. Define tasks and measure task completion, wrong taps, time-to-destination and confusion. Screenshot tests on multiple display densities.

An image-generated UI board is supplied only for mood/visual direction. It contains fictional place names and layout decisions that must **not** be accepted as product facts or a literal design specification.

## 7. Offline map pack architecture: prove, then choose

Two candidate delivery modes:

A) **Self-hosted licensed vector styles/tiles + MapLibre OfflineManager** for user-downloaded offline regions. Validate local persistence, error handling, tile/style/glyph/sprite completeness, attribution and explicit resource size. The production app must not depend on a demo tile URL.

B) **App-shipped or separately downloaded PMTiles archives** plus a fully local style, fonts/sprites and overlays. MapLibre Native Android documents local `pmtiles://file://` support; do **not** assume the React Native bridge and iOS native runtime expose the same behavior until demonstrated. Native PMTiles sources are not automatically interchangeable with OfflineManager packs. Measure memory/IO and upgrade behavior.

Spike acceptance: airplane-mode cold launch after force-stop and after device restart; map visible at all required zooms; building details, localized fonts, symbols, attribution and styles work; no failed external network requests; pack corruption detected; installation/update flow handles partial downloads; storage limits documented. Only then choose and record the mechanism.

## 8. Geolocation and routing

Allow origin from (1) permissioned GPS with age/accuracy and timeout, (2) manually dragged pin, or (3) offline landmark/street choice + confirmation. Request foreground location only at point of use. GPS/GNSS itself can provide offline fixes; availability and urban canyon accuracy vary. Last-known position is labeled stale and never passed off as live.

Preprocess the walkable graph with explicit sidewalks, pedestrian shortcuts, crossings, signals, ramps/stairs, restricted paths, footbridges and destination entrance links. OSMnx is a seed; field-verified exceptions and topology repair are mandatory. Prevent non-real intersections where lines cross at grade-separated levels. Remove paths with unverified access as required for conservative navigation. Track graph edge provenance.

Mobile algorithm: nearest eligible edge candidate -> origin connector with snap-distance/accuracy checks -> endpoint target at approved entrance -> A* with admissible distance heuristic -> reconstructed geometry -> direction instructions -> progress matching with hysteresis. Provide fallback “route unavailable” with straight-line bearing explicitly labeled *direction only*. Do not route to building centroid. Implement wheelchair-accessible options only for sufficiently verified edges; never infer wheelchair access from proximity.

Verify selected pilot routes by tracing them in the field and auditing disconnected components, barriers, unsafe crossings, implausible shortcuts and routing changes across graph versions. Simulate inaccurate locations, outside-BGC origin, no fix and app backgrounding. Routing calculation is on-device with no server dependency.

## 9. Transit information

Create GTFS-compatible structures for routes, stops, trips, stop-times, calendars, shapes, agency and exceptions. If official data does not exist, build a clearly labeled verified local static feed from authorized records and route survey; do not imply operator sponsorship. Offer routes, stops, route shape, boarding guidance and posted operating times **only when verified**. Do not claim live bus arrivals or unrestricted transfers. Mark stale schedules and walking links to transit stops. Phase transit routing behind pedestrian route correctness; if incomplete, show browse-only route information.

## 10. Local favorites and simple non-AI itinerary

Implement saved places, recent searches (optional local only), manually ordered itinerary stops, explicit start time and user-supplied durations, offline storage/export. The app can calculate pairwise walking legs and aggregate travel time deterministically. No LLM-generated recommendations, semantic planning or autonomous calendar actions in this phase.

## 11. Assistant tab — UI contract ONLY

Implement a clean conversational screen, accessible header, message component variants, suggestion chips, place-card renderer, route-card renderer, itinerary-card renderer, source/verification metadata display, keyboard and scrolling behavior. Use static mock fixtures in Storybook/test environment; in production display a clearly labeled “AI Assistant coming later” state with safe navigation back to the Map. Do not generate fake conversational answers presented as operational AI. Define typed future interfaces but no model runtime, embeddings, vector database or RAG engine.

## 12. Updates, distribution, privacy and reliability

Develop offline packs as separately versioned artifacts: `core-geometry`, `places`, `menus`, `transit`, `map-style` (and optional imagery if legitimately licensed). Each package records SHA-256, schema/API version, coverage polygon, source snapshot IDs, license bundle, creation/validity dates, dependencies, size and update channel. Downloads use temp files, checksum validation, transactional swap, free-space checks, resume/retry and rollback; never overwrite the sole valid dataset before validation. Small starter pack should keep first use approachable; optional content downloaded with Wi-Fi.

Protect saved locations and itineraries in platform-private storage, minimize precise location retention, enable delete-my-local-history actions, and avoid location uploads. Provide privacy notice and permissions justifications appropriate for Philippine privacy law; obtain qualified legal review prior to public distribution. Never present an APK or icon as production-ready until signed, visually approved and tested on target devices.

## 13. Execution milestones and dependencies

| Milestone | Owner lane | Deliverable and acceptance gate | Prerequisites |
|---|---|---|---|
| M0 — Recon + feasibility | Parent, mobile, GIS | Existing-project audit; current native compatibility matrix; Android debug build + local SQLite + MapLibre render; source inventory | None |
| M1 — Data contracts + licensing | Parent, data governance | Approved service boundary strategy, taxonomies, source policy, immutable IDs, normalized schemas, journals | M0 |
| M2 — UX and brand foundation | UX, frontend | Figma component system, icon/wordmark variants, uncluttered Map and Assistant flows, initial user testing | M0 |
| M3 — GIS extraction and reuse | GIS | Reproducible BGC geospatial ingest; route candidate graph; quality/coverage report | M1 |
| M4 — Place and menu intake | Data research, ETL | Versioned approved pilot inventory with sources, evidence, aliases, floors, menus, entrances | M1; parallel M3 |
| M5 — Offline pack proof | Native map | Verified fully offline style/tiles/glyph/sprites and device storage/update strategy, including iOS risk report | M0 + M3 sample |
| M6 — Map visual system | Map, UX | Stylized layers, labels, clusters, rendering tiers and visual regression passes | M2, M3, M5 |
| M7 — Search, filters, place details | Mobile, data | Offline FTS5 search, data-backed filters, place/tenant/floor detail sheets; empty/stale states | M4, M6 |
| M8 — Location UX | Native mobile | Permission at use, location quality, draggable/manual/landmark origin, selected origin state | M6 |
| M9 — Walking navigation | GIS + routing + mobile | Precomputed validated graph, A*, entrance routing, accessible route UI, route field QA | M3, M4, M8 |
| M10 — Bus and transit discovery | Transit + mobile | Source-verified static routes/stops and map/stop detail UX; no live arrival claims | M4, M6 |
| M11 — Favorites and planning UI | Mobile, UX | Saved POIs, manual itinerary editing, deterministic leg estimates, no model dependency | M7, M9 |
| M12 — Assistant UI shell | UI | Responsive, accessible chat screen and typed fixture card components, production placeholder state | M2, M7 |
| M13 — Update pipeline/admin | ETL + release | Review dashboard, approved/versioned database packages, checksum/rollback/update flow | M4, M5 |
| M14 — Hardening and release | Parent + QA | Airplane-mode release APK, field routes, accessibility, privacy, permissions, performance report, iOS feasibility status | All release-relevant milestones |

**Parallelism:** No more than three implementation agents concurrently at first. When one agent writes `packages/data-contracts`, no second agent edits that directory. Assign a single integration owner per shared file/package. Independent reviewers can inspect without writes. Milestone handoff requires a manifest/checklist, test logs, screenshots/video for UI, data counts and documented unknowns. Changes are not merged automatically.

**Scale gates:** Pilot High Street slice -> extended central BGC -> all supported BGC coverage. Never scale to the next zone until error rates, data source permissions, route connectivity, device performance and update rollback are acceptable in the current zone.

## 14. Multi-agent model / effort assignment

Models below are *coding-time assistant models*, unrelated to the future on-device AI. Availability depends on the user's Codex/Work/API account and client. For systems that do not support heterogeneous models inside one parent/subagent tree, run separately configured agent sessions; the Responses multi-agent beta may force one model for the tree.

| Role | Default model | Effort | Escalation | Owns |
|---|---|---|---|---|
| Parent / engineering lead | `gpt-6.1-sol` | High at milestone gates; Medium between | `gpt-6-astra` Low for difficult independent review | Acceptance, architecture, integration, decisions |
| GIS / topology | `gpt-6.1-sol` | High | Astra Low/Medium on graph defects | CRS, geometry, pedestrian topology |
| Data sourcing / licensing investigator | `gpt-6.1-sol` | Medium | Astra Low for ambiguous data rights/merges (legal counsel for definitive advice) | Provenance/permissions/source strategy |
| ETL / database engineer | `gpt-5.6-terra` | Medium | Sol High if correctness uncertain | Transformations, contracts, SQL/indexes |
| Batch normalization / documentation | `gpt-6-luna` | Low | Terra Medium | Drafts, reports; deterministic validation always |
| Product/UX designer | `gpt-6.1-sol` | High for information architecture, Medium for variants | Astra Low for challenging usability conflict | UX specifications/flow logic |
| Mobile/MapLibre engineer | `gpt-6.1-sol` | Medium | High for native bridge or tile issues | Map renderer, offline styles/packs |
| Frontend implementation | `gpt-5.6-terra` | Medium | Sol Medium | Accessible RN screens/components |
| Pedestrian routing engineer | `gpt-6.1-sol` | High | Astra Low for serious topology safety decisions | Graph and shortest-path algorithm |
| Transit specialist | `gpt-5.6-terra` | Medium | Sol High | Static GTFS and route validation |
| QA / tests engineer | `gpt-5.6-luna` | Low on routine tests, Medium for negative cases | Sol High on critical flaws | Tests and structured evidence |
| Security/privacy reviewer | `gpt-6.1-sol` | High at release gates | Astra Low if warranted | Risk and release acceptance |
| Journal/ADR scribe | `gpt-6-luna` | Low | Parent review required | Decision and tool rationale entries |

Default escalation rule: deterministic tools and tests first; if a model fails twice with the same independently reproducible blocker, escalate one tier or effort level. Do not use Astra for routine boilerplate or repeated CSV normalization. Astra is an independent adviser, never a substitute for field verification or source licenses.

## 15. Parent-agent review gates

For each assignment, parent sends a scoped task contract with owner, changed paths, dependencies, acceptance criteria and forbidden changes. Subagent creates evidence: changed files, diff summary, tests run/results, exact command outputs, screenshots/recordings where relevant, source citation/license where data-related, and risks/deviations.

Review sequence: (a) confirm evidence and no invented facts; (b) inspect changed code/data, diff and contract; (c) execute regression/tests on integration branch; (d) independent counterexample test; (e) confirm journal/ADR updates; (f) inspect mobile UI on device for relevant work; (g) accept / request revision / reject. Review-only QA agent must not modify the feature branch while evaluating it.

Re-review on schema changes, new dataset license, routing behavior changes and native package updates. Human approval is mandatory for data publishing and safety-critical walkway corrections. Red/blocked findings remain open until reproducibly closed.

## 16. Quantified non-AI success targets (proposed gates, not existing metrics)

- Map cold-open offline: first usable rendered viewport within 4 seconds on reference mid-range Android after local resources are installed (measure median + p95).
- Map interaction: sustained ≥ 30 FPS on reference device; prefer 60 FPS for idle pan where possible; profile in release configuration.
- Offline name/category search: p95 < 300ms on a representative dataset; instrument latency and device context.
- Routing: p95 < 500ms for supported pilot pedestrian journeys; correctness outranks speed.
- Data: zero user-facing records lacking provenance state; ambiguous location/duplicates quarantined from “verified” results.
- Pilot entrance routing: all named field-test paths must avoid prohibited crossings/physical barriers; no route-to-centroid shortcuts.
- UX: five-person formative study followed by independent follow-up; ≥ 80% unassisted task completion on critical journeys is an initial target, not a claim.
- Accessibility: 48dp touch regions, scalable text, TalkBack flow, legible route contrast, color-blind comprehensibility.
- Build: development build works with Metro; signed/test release APK works without Metro and in airplane mode; errors clearly surfaced on missing/corrupt packs.
- Release: fail closed on unsupported offline data version, insufficient storage and bad checksum; prior valid version remains usable.

## 17. Repository structure

```text
omni-bgc/
  AGENTS.md
  .agent/PLANS.md
  docs/
    IMPLEMENTATION_PLAN.md
    DECISION_JOURNAL.md
    TOOL_RATIONALE.md
    architecture/
    data-source-register/
    evaluations/
    milestone-handoffs/
  apps/
    mobile/ (Expo app, Map & Assistant UI)
    admin/ (internal review/publishing UI)
  packages/
    domain/ (canonical IDs/interfaces)
    database/ (read-optimized schemas/migrations)
    geo/ (coordinates and geospatial types)
    routing/ (routing runtime, no AI)
    ui/ (tokens and reusable components)
  pipelines/
    sources/
    etl/
    gis/
    route-graph/
    tile-build/
    pack-release/
  data/
    fixtures/ (synthetic only)
    manifests/
    licenses/
  tests/
    e2e/
    data-quality/
    routing/
    offline/
  assets/
    branding/
    map-icons/
```

Keep raw licensed sources in non-public storage as appropriate and avoid committing raw giant datasets, personal information, secrets or unapproved merchant photos into a public repo.

## 18. Key references (primary documentation)

- Expo native development builds: https://docs.expo.dev/develop/development-builds/introduction/
- MapLibre React Native / Expo: https://maplibre.org/maplibre-react-native/docs/setup/expo/
- MapLibre offline packs: https://maplibre.org/maplibre-react-native/docs/modules/offline-manager/
- MapLibre Native Android local PMTiles: https://maplibre.org/maplibre-native/android/examples/data/PMTiles/
- Expo SQLite/FTS5: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Expo location: https://docs.expo.dev/versions/latest/sdk/location/
- OpenStreetMap ODbL: https://www.openstreetmap.org/copyright
- OSM tile policy: https://operations.osmfoundation.org/policies/tiles/
- Geofabrik Philippines extract: https://download.geofabrik.de/asia/philippines.html
- OSMnx: https://osmnx.readthedocs.io/en/stable/getting-started.html
- GTFS: https://gtfs.org/documentation/overview/
- Android accessibility: https://developer.android.com/design/ui/mobile/guides/foundations/accessibility
- OpenAI model choices: https://developers.openai.com/api/docs/models
- Agent multi-agent API: https://developers.openai.com/api/docs/guides/agents-api/multi-agent
- Codex AGENTS instructions: https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra

## 19. Release boundary: handoff to AI phase

At end of M14, freeze documented interfaces for place search, venue/route citations, route planning, itinerary storage and conversational result cards. The later AI team must consume these deterministic APIs, never replace the geographic database with generated guesses. AI feature flags remain off until that separate program has been approved.
