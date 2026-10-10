# Omni-BGC — Engineering Decision Journal

**Journal policy:** Append-only dated record of material product/architecture/data/UI decisions. Preserve superseded decisions as `SUPERSEDED`, create new decision ID that references the former ID. Every accepted milestone must update this journal and its relevant ADR. Never retroactively rewrite rationale to match the implementation. Parent agent reviews all entries; user approves irreversible product choices and external distribution/license decisions.

Statuses: **ACCEPTED** (baseline), **PROVISIONAL** (needs spike), **OPEN** (awaiting evidence), **REJECTED**, **SUPERSEDED**. Initial journal entries document our current decisions; they do *not* imply source code has been written or field data verified.

| ID | Date | Decision / status | Why, including alternatives | Validation / trigger for revisit |
|---|---|---|---|---|
| DEC-001 | 2026-10-09 | Name is **Omni-BGC** — ACCEPTED | Describes the comprehensive geographic scope; no branding conflict search or trademark clearance completed yet | Trademark/store-listing review before release |
| DEC-002 | 2026-10-09 | Core application **offline-first**, no mandatory account — ACCEPTED | Preserve navigation utility during connectivity loss and reduce friction; online-only maps rejected | Airplane-mode release tests |
| DEC-003 | 2026-10-09 | Android first, iOS architectural compatibility — ACCEPTED | Faster iteration on accessible Android hardware while keeping platform code portable | Native dependency compatibility matrix and eventual iOS build |
| DEC-004 | 2026-10-09 | Expo + React Native + strict TypeScript — PROVISIONAL | Reuse platform code, native modules via development builds; bare React Native is fallback only after technical blocker | M0 actual native build |
| DEC-005 | 2026-10-09 | Expo **development build + Metro** for iteration; release APK for offline acceptance — ACCEPTED | Expo Go cannot provide needed custom native map stack; release build proves stand-alone behavior | M0 + M14 device tests |
| DEC-006 | 2026-10-09 | MapLibre native renderer for geographic layers — PROVISIONAL | GPU rendering, style control, geo primitives; canvas-only/map-as-image rejected for routing accuracy | M0 FPS/native stability proof |
| DEC-007 | 2026-10-09 | Original game-inspired **2.5D visual identity**, not copied Pokémon art — ACCEPTED | Delight with readable actual geospatial relationships; full 3D game scene too costly for first mobile release | M2 design and M6 performance/legibility tests |
| DEC-008 | 2026-10-09 | **Two main tabs:** Map and Assistant — ACCEPTED | Short, stable IA; Saved/Settings accessible contextually to avoid persistent tab clutter | M2 user tests |
| DEC-009 | 2026-10-09 | Assistant UI shell only; no LLM, RAG, embeddings or fake chat in current scope — ACCEPTED | Decouple deterministic product from later AI reliability/runtime | M12 code audit |
| DEC-010 | 2026-10-09 | Building != tenant != entrance in canonical data model — ACCEPTED | Ensures accurate mall floor results and door-to-door route endpoints | M1 schema fixtures |
| DEC-011 | 2026-10-09 | Licensed raw OSM geographic data + verified owned/permitted business records — ACCEPTED | Avoid prohibited OSM tile prefetch and copyrighted third-party directory/menu scraping | Source/legal register; ODbL review |
| DEC-012 | 2026-10-09 | Reuse earlier BGC geospatial datasets *after lineage/quality audit* — PROVISIONAL | Avoid duplication of prior OSM/geometry engineering; existing artifacts not presumed distributable | M0/M3 audit |
| DEC-013 | 2026-10-09 | Offline map pack tech **NOT YET LOCKED** — OPEN | Compare offline packs against local PMTiles + fully local assets; Android native support alone is not proof for iOS+RN | M5 forced-offline cold start |
| DEC-014 | 2026-10-09 | SQLite + FTS5 local record/search store — PROVISIONAL | Low operational cost and reliable structured lookups; remote API and vector store deferred | M0 native query and M7 scale tests |
| DEC-015 | 2026-10-09 | GIS ETL via Python, GeoPandas, Shapely, OSMnx, QGIS — PROVISIONAL | Reproducible transformations plus visual QA; OSMnx walking network is only a starting topology | M3 reproducibility + field spot checks |
| DEC-016 | 2026-10-09 | Real entrance-based pedestrian graph; A* on device — ACCEPTED | Avoid straight-line routing and incorrect centroids; graph provenance and field corrections required | M9 field route tests |
| DEC-017 | 2026-10-09 | Origin: foreground GPS, manual pin, landmark confirmation — ACCEPTED | Device accuracy variability; no location permission lockout | M8 denial/stale accuracy tests |
| DEC-018 | 2026-10-09 | Transit: GTFS-compatible static records with explicit freshness — ACCEPTED | Facilitates future bus planning, avoids pretending to know live arrivals | M10 operator/source verification |
| DEC-019 | 2026-10-09 | Menus/dishes require per-fact evidence, unverified != absent — ACCEPTED | Fish-meal queries rely on item evidence; no inferred pricing/ingredients | M4 menu audits |
| DEC-020 | 2026-10-09 | Versioned pack + SHA256 + atomic swap/rollback — ACCEPTED | Avoid partially corrupted map/POI data during interrupted updates | M13 fault injection |
| DEC-021 | 2026-10-09 | Category chip row + contextual bottom sheet; avoid persistent clutter — PROVISIONAL | Reduce friction and map occlusion, one action emphasis at a time | M2 five-participant usability study and M6 on-device review |
| DEC-022 | 2026-10-09 | Parent model `gpt-6.1-sol`, medium by default/high gates; Astra low for rare complex independent review — PROVISIONAL | Optimize reasoning cost while retaining oversight | Compare task accuracy/usage; verify account availability |
| DEC-023 | 2026-10-09 | Default max three independent subagents simultaneously — PROVISIONAL | Avoid shared-file contention and review bottlenecks | Measure wall-clock, merge conflicts and cost |
| DEC-024 | 2026-10-09 | Parent-agent signoff required at every milestone — ACCEPTED | Engineers must assess evidence not agent confidence; independent reviewer catches defects | Milestone checklists and PR audits |
| DEC-025 | 2026-10-09 | Brand concept: navigation pin + compass + city greenery, blue/teal on cream — PROVISIONAL | Clear launch-icon silhouette and distinct map identity; generated draft is not a final compliant export | Small-size legibility, adaptive icon clipping, trademark review |
| DEC-026 | 2026-10-09 | Build a verified High Street pilot before claiming full BGC — ACCEPTED | Prevent data-gathering scale from masking core topology/UX problems | M4/M9 exit criteria and expanded zone plan |
| DEC-027 | 2026-10-09 | Privacy by data minimization; precise location stored locally by default — ACCEPTED | Position data sensitive; avoid avoidable collection and online dependencies | M14 privacy/legal review and device permissions inspection |

## Decision log record template

```markdown
### DEC-0XX — Title
- Date / author / reviewer:
- Status: PROPOSED | ACCEPTED | OPEN | REJECTED | SUPERSEDED
- Context and problem:
- Options considered:
- Evidence / official references and limitations:
- Decision and rationale:
- How implemented (file paths, commands, schema version):
- Trade-offs, risks, and rejected alternatives:
- Validation / test / measurable outcome:
- Impacted systems and migration plan:
- Revisit trigger:
- Approved by:
```

## Daily engineering work journal template

```markdown
### YYYY-MM-DD / Mxx / Agent role / Model + effort
- Objective and previously approved contract:
- Inputs and source snapshots:
- Tools used: NAME -> WHY -> HOW (commands/versions):
- Decisions / ADR references:
- Changes (paths, commits/branch):
- QA performed and actual results:
- Evidence links: traces, screenshots, data diff, build artifact:
- New risks, blockers, open questions:
- Parent review: ACCEPTED | CHANGES_REQUESTED | REJECTED (with reasoning):
- Next owner/task:
```

## Milestone review entry template

```markdown
### Mxx final review — YYYY-MM-DD
- Requirements completed / incomplete:
- Deliverables and artifact hashes:
- Test matrix and command output references:
- Data quality counts, source permissions, and unresolved conflicts:
- Mobile screenshot / usability and accessibility evidence:
- Offline validation (airplane mode, cold launch, storage):
- Parent's independent negative tests:
- Reviewer findings severity + resolution:
- Final status: PASS | PASS_WITH_DEFERMENTS | FAIL
- Deferred work, owner, deadline/condition:
- Decision journal changes:
- Approval / merge commit:
```

## Audit rules

- A successful test that was never run must not be recorded as PASS.
- Extrapolations/guesses are explicitly labeled; do not record them as verified observations.
- Each tool choice has a WHY/HOW/REJECTED ALTERNATIVE entry in `TOOL_RATIONALE.md` or an ADR.
- Routine implementation details may be batched in the daily log; architectural, licensing, data-quality, safety and UX-direction changes require explicit decision IDs.

### DEC-028 — Isolate the M0 native feasibility candidate
- Date / author / reviewer: 2026-10-09 / parent engineering agent / parent independent review.
- Status: PROVISIONAL. DEC-004, DEC-006 and DEC-014 are not silently promoted into production approval.
- Context: initial Omni workspace contains the blueprint and concepts only, no app or Git repository. Current native APIs and versions require an actual spike.
- Decision: keep a disposable Expo 57.0.27 / React Native 0.86.3 / React 19.2.3 / MapLibre RN 11.5.0 / Expo SQLite 57.0.4 candidate under `apps/mobile`. Use the New Architecture and CNG-generated native folders with mandatory prebuild before assembly. Direct versions are pinned and transitive integrity is recorded in the lockfile.
- Why / alternatives: current SDK template, package recommendations and peer requirements form a coherent candidate. Expo Go cannot provide this custom native map. Independent RN swaps and blind audit-force downgrades rejected. Full product scaffolding would exceed M0.
- How / evidence: `docs/evaluations/m0/mobile/COMPATIBILITY.md`, source/config/lockfile, exact command logs; parent TypeScript and protocol-relative remote-style adversarial checks pass. Empty background and synthetic SQLite fixture have no geographic authority.
- Risks: npm audit reports 23 dependency advisories (16 high, 7 moderate); compatible remediation/reachability review remains open. Native build/runtime results are recorded separately by the final M0 gate. iOS compilation, performance and production offline resource delivery remain unproven.
- Migration / revisit: retain no canonical domain/database schema in this spike. Revisit candidate at native failure, upstream security fix or package update; DEC-013 remains OPEN until M5 proof. M1 requires user approval.
- Approved by: parent approves the bounded spike approach, not production compatibility/security or M0 completion from host checks.

### DEC-029 — Quarantine prior-project reuse hazards
- Date / author / reviewer: 2026-10-09 / GIS auditor and parent / parent independent reproduction.
- Status: ACCEPTED as a reuse constraint; DEC-012 remains PROVISIONAL.
- Context / evidence: `Documents/BGC` read-only audit checked 67 files, 21 layers and three raw OSM snapshots. Raw counts/hashes match recorded sidecars; prior `pilot-entities.json` internal content checksum does not. Parent reproduced computed digest `30089f6af014bb4943f97efb838075e8080dfa83359cd5a5224ea81c3671640e` against claimed `5e401c1814fc43e2b8bd1dfc39588f063d614ed927fc647e52236ba1cf7af652`.
- Decision / why: do not reuse that entity manifest until owner explanation and reproducible content/ID review. Processed geometry uses local metres despite upstream `source_crs`; do not import directly as WGS84. Processed road/path buffers omit access/grade-separation/connectivity and cannot define safe walking routes. Four inferred/unknown entrance concepts lack checked positions.
- How: inventory and explicit blocked classifications only, `docs/evaluations/m0/gis/`; no source edits, repairs, imports, ID changes or graph work. Parent acceptance is in `parent/GIS_REVIEW.md`.
- Rejected alternatives: silently recompute a checksum, adopt visually plausible buffers as a graph, accept source-provided status as field verification, or treat working boundary as legal district.
- Limits / revisit: valid geometry/hash does not clear legal rights, world freshness, field access or boundary authority. Later M1/M3 and human/field review only after authorization; no previous-project modifications performed.
- Approved by: parent for the quarantine/audit disposition only. Zero datasets approved for distribution.

### DEC-030 — Preserve the source contract pending authorized M1
- Date / author / reviewer: 2026-10-09 / source investigator and parent / parent independent validation.
- Status: ACCEPTED as M0 scope/approval constraint.
- Context: current source register has 18 columns; collection playbook requests 22. Missing fields are `jurisdiction`, `source_published_at`, `data_extract_version`, `retention_terms`, `review_timestamp`; current-only `source_version` is not silently equivalent to extract version.
- Decision / why: leave the shared header-only register byte-identical during M0; record 11 research references/candidates using its current header in a separate evaluation inventory. Accept audit evidence separately from source/dataset permission.
- How / validation: parent independent CSV/checksum/status checks and agent-validator rerun pass; 7 candidates, 4 policy references, 9 redistribution UNKNOWN, no duplicates, zero acquired raw datasets or approved records. See `docs/evaluations/m0/parent/SOURCE_REVIEW.md`.
- Alternatives rejected: silently add columns, fabricate raw checksums for unfetched data, treat a public menu/transit page as republication permission, or use OSMF public raster service for offline packs.
- Migration / revisit: explicit compatibility/migration and source rights review belong to separately authorized M1. ODbL raw data rights do not grant merchant/media rights or establish field correctness.
- Approved by: parent for the bounded evidence and unchanged M0 contract; no distribution or M1 authorization.

### DEC-031 — Bound the M0 Windows, dev-client and FTS lifecycle fixes
- Date / author / reviewer: 2026-10-09 / mobile owner / parent plus independent Sol High native reviewer.
- Status: ACCEPTED for the isolated M0 spike; production SQLite/security/offline suitability remains PROVISIONAL.
- Context / actual failures: parent incremental build reproduced Ninja's260character include-path failure. Initial phone install needed user's OS approval; local Metro transport and missing splash support were distinct launch findings. Native query/render markers then preceded two SIGABRT crashes in SQLite closure.
- Decision / why: use short project-local `apps/mobile/.g` Gradle cache and two workers, exclude native/cache/archive paths from Metro, force process-local IPv4-first localhost Metro, add SDK-matched expo-splash-screen57.0.9. No system path/DNS/security setting changes.
- SQLite disposition: set `finalizeUnusedStatementsBeforeClosing:false` on this disposable connection, retain explicit awaited close and all app statement finalization. Verify FTS positive/absent/integrity assertions, close, reopen without rewriting the record, reverify persistence/integrity, close again; emit PASS only after both closes finish.
- Evidence / limitations: matching native BuildId symbolication resolves FTS internal finalize inside close; local wrapper sweeps all statements by default. [Primary Expo issue38168](https://github.com/expo/expo/issues/38168) supports the scoped workaround but does not prove a current fixed release. This option is typed but @hidden in57.0.4; re-audit on upgrades. Full native review: `docs/evaluations/m0/native-review/REVIEW.md`.
- Rejected alternatives: ignore transient post-PASS crash, leave connection open, remove FTS, disable allocator protection, downgrade unrelated RN/MapLibre, force an incoherent SDK audit fix, bypass phone review or change global Windows settings.
- Actual validation: short-cache independent parent ARM64 build PASS11s (exit0); physical model2311DRK48G/API36/arm64 native SQLite3.50.3 bothclose cycles and maprender PASS, parent fresh process survives60s without fatal markers. Screenshot and source code inspected. Exact evidence: `docs/evaluations/m0/parent/`.
- Revisit / ownership: database/mobile parent before production search and on every SQLite update; explicit statement/connection ownership contract and iOS lifecycle tests remain deferred. Current tests prove narrow M0 feasibility, not long-term leak absence or release performance.
- Approved by: parent for isolated changes and recorded diagnostic evidence only; final milestone decision is separate below. M1 still requires user approval.

### 2026-10-09 / M0 / Parent engineering and QA review
- Objective / approved contract: execute recon/native feasibility only; independently inspect all delegated work; stop before M1. Initial13-file workspace had no app/dataset/Git metadata. Baseline fingerprints are in `evaluations/m0/parent/initial-files.json`.
- Delegation actually used: Sol Medium mobile and sources, Sol High GIS, Sol High separate hard-native review, Luna Low journal drafts. Non-overlapping paths and no more than three initial subagents. Parent session model/effort is not introspectable/changeable through the harness; Terra is not exposed, not silently substituted. No Astra escalation was needed after deterministic failure isolation.
- Inputs: original blueprint/decisions/concepts; read-only prior `Documents/BGC`; current official native/policy references. No raw source acquisition, field survey, merchant intake or legal clearance.
- Tools / WHY / HOW: PowerShell/rg and SHA256 for bounded inventory; Node/npm/Expo for exact pinned candidate and native diagnostics; existing JBR/SDK/Gradle/NDK for real builds and matching-library symbolication; existing GIS venv for isolated read-only geometry/hash audit; independent Python/Node scripts, app-scoped ADB and image inspection for parent reproduction. Versions, exact commands and alternatives are in TOOL_RATIONALE.md and lane reports.
- Changes: isolated `apps/mobile/**`; evaluation/architecture/handoff artifacts; append-only shared journals. Existing source header, blueprint and concept bytes preserved. No Git branch/commit/merge/publication; no prior-project changes or canonical schema/ID modifications.
- QA / actual results: source reimplementation and validator PASS; exact GIS report reproduced with8negative cases and separate67hash/count/coordinate/entity checks PASS. Final TypeScript/style/adversarial protocol-relative import checks PASS. Parent offline incremental ARM64 build PASS11s, exit0. Fresh physical model2311DRK48G/API36/arm64 render and SQLite3.50.3 positive/absent/integrity, completed closes and persisted reopen PASS; samePID stable60s. Screenshot independently viewed. Text contrast11.3:1/code labels/scrolling checked; TalkBack/200%text/full UX NOT_RUN. Final integrity output is linked from the handoff.
- Failures / resolution: historical install denial resolved by user's OS approval; local Metro transport corrected process-locally; Windows Ninja path fixed with short workspace cache; FTS close native abort independently symbolicated and narrow option=false lifecycle regression passed. Early PASS-before-close was rejected as insufficient evidence. No security/allocator/global settings bypass.
- Current risks: final audit24 (16high/8moderate) supersedes historical23 (16high/7moderate) in DEC-028/earlier tool entry. Hidden SQLite cleanup option requires future ownership/upgrade review. iOS, standalone complete-resource offline release, production usability/source rights, prior hash/CRS/topology and boundary/CSV decisions remain open. Detailed owners/closure conditions: `evaluations/m0/parent/RISK_REGISTER.md`.
- Decisions: DEC-028–031; original production/provisional/open decisions preserved.
- Parent review: ACCEPT source/GIS bounded evidence, mobile feasibility, native failure-analysis contribution and journal drafts. Draft journal's earlier pending-native status is historical, superseded here. Production/data/distribution acceptance withheld.
- Next owner/task: user review of M0; no M1 or later execution without approval.

### M0 final review — 2026-10-09
- Requirements completed: existing-project/source audit; compatibility matrix; Android debug build, local native SQLite/FTS5 and MapLibre render; initial design constraints; command evidence; risk register and parent decision.
- Deliverables/hashes/tests: `milestone-handoffs/M0.md`, all lane reports and parent review records; final APK SHA256 `88B93613AFF3E92CAB09CCA8C1CD7696FF86E82E9AC02522A32D37EA7D877B39`; immutable lane manifests and parent artifact integrity/final manifest. Parent tests include independent remote-import adversarial rejection and forbidden GIS output-path rejection.
- Data/license status:11source records (7candidate/4research,9redistribution unknown),0approved/acquired raw datasets;67prior file identities and21layers audited, not imported or cleared. No completeness/route safety inference.
- Mobile UX/offline: physical screenshot and bounded contrast/code a11y checked; full accessibility/participant UX and iOS NOT_RUN. Empty background has no map resources/geography; local Metro needed, so M5/release airplane-mode cold launch NOT_RUN.
- Findings: native abort was blocking until close/reopen and parent fresh-launch dwell passed; remaining risks are explicit M0-R02–R11 with owners and conditional later gates.
- Final status: **PASS_WITH_DEFERMENTS — parent ACCEPT for bounded M0 only.** All requested M0 artifacts and native feasibility evidence complete; no production compatibility/security/data permission granted.
- Deferred ownership/condition: mobile/security before distribution; database/mobile before production search and any SQLite update; native before M5/release and iOS acceptance; data/GIS/legal before ingestion/reuse; UX/QA before production UI. Later work requires separate authorization.
- Approval / merge: parent engineering ACCEPT of this M0 evidence; no user M1 approval, merge, commit, publish or external communication. Stop at M0.

### DEC-032 — Execute the authorized pre-AI program with dependency gates
- Date / author / reviewer: 2026-10-09 / parent / direct user authorization, with independent parent review at each milestone.
- Status: ACCEPTED for execution policy; no milestone or production success inferred.
- Context: the user explicitly authorized M1–M14 and later instructed continuation after subagent service usage interruptions. This supersedes M0's historical stop-before-M1 instruction, without rewriting the M0 record.
- Decision / why: work on `codex/m1-m14` from existing clean Git baseline `795179d`; commit accepted milestones separately, never merge to main or publish. Advance only after independent parent ACCEPT. Blocked prerequisites permit only genuinely independent work.
- Model routing actually available: Sol Medium contracts/database fallback because Terra is absent; Sol Medium governance; Sol High UX; Astra Low independent M1 architectural review. No more than three implementation owners initially. Parent inherited model/effort is not introspectable/changeable; no runtime override claimed.
- How / evidence: `evaluations/program/TASK_PLAN.md`. Existing SDK ADB confirms a connected physical Android model2311DRK48G and emulator; this is availability only, not a new native or release test. Two agents and later the third stopped on service usage limit; saved drafts were resumed after the user's continuation instruction.
- Rejected alternatives: declare all milestones done from scaffolding, fabricate participants/field observations, infer merchant/menu rights, introduce AI dependencies, force insecure SDK downgrades, or treat historical phone evidence as validation of new code.
- Version control: task-local `.gitignore` excludes Python caches and raw/generated datasets; scoped `.gitattributes` preserves new checksum-reviewed artifact bytes without renormalizing historical M0 files. Dataset redistribution rights remain separate from committing engineering code/evidence.
- Risks / revisit: missing Figma/participants, merchant/operator consent, field QA, macOS/iOS access, complete-resource offline proof and security/native lifecycle gates must be dispositioned with actual evidence. External authorization is requested only for concrete blockers or the user's enumerated approval categories.
- Approved by: user for execution; parent owns individual engineering acceptance. No production or distribution authorization.

### DEC-033 — Approve the M1 source migration and engineering pilot strategy
- Date / author / reviewer: 2026-10-09 / governance owner / parent plus independent Astra Low review.
- Status: ACCEPTED as engineering policy. DEC-030's M0 header preservation remains historical; its authorized M1 migration trigger is now satisfied.
- Decision / why: preserve the original18CSVfields and append five (23total), retaining source_version separately from data_extract_version. Use a project-defined High Street rectangle and200m metric ingest buffer specification, distinct from legal district authority, completeness and safe routes.
- How / evidence: source v1 backup and checksummed migration; `architecture/M1_DATA_GOVERNANCE.md`; `data/manifests/service-area-v1.json`; parent independent governance QA and14tests. Zero canonical source rows; historical11M0records byte-identical.
- Internal reuse: allow only reviewed Geofabrik acquisition or the two exact M0-audited raw OSM snapshots after current hash/sidecar/license/origin/query/boundary validation and parent engineering acceptance. Oldest pilot without sufficient metadata, prior code/media/processed graph/entity manifest remain excluded. No raw source acquired by M1.
- Distribution: separately require source/use/snapshot-bound rights, human rights review, notices/obligations, expiry/current evidence and explicit user distribution authorization. Public OSMF raster offline caching is categorically denied. Public menus/directories remain research leads.
- Rejected alternatives: silently drop source_version to match22field playbook, reuse an inferred/legal boundary, assume ODbL grants merchant media, or require distribution clearance merely to design internal ingest.
- Approval: parent ACCEPT for M1 policy and scope strategy; source/data/route/production approval withheld. M3 must materialize and assess the buffer and map engineering scope refs to canonical UUIDs explicitly.

### DEC-034 — Approve immutable identities and conservative fact-level distribution contracts
- Date / author / reviewer: 2026-10-09 / contracts owner / parent plus independent Astra Low.
- Status: ACCEPTED for M1 schemas/contracts; native and production stack decisions remain provisional.
- Decision / why: normalized staging plus compact mobile read schema, random immutable canonical UUIDs, separate branches/floors/doors, explicit unknown states, current fact/evidence metadata and exact snapshot/use rights. Reject identity replacement/recycling and unbacked relationships, including default SQLite REPLACE/UPSERT behavior.
- How: versioned transactional SQL migrations with subtype/subject guards, fact ledger, source snapshot/use policies, proposed taxonomy v1, FTS5 update/delete indexes and R-tree points. Local exporter never publishes or supplies human permission. M1 mobile projection intentionally excludes later polygon/route/transit/saved-history APIs.
- Native ownership: drain owned work, finalize each application statement, then await close. M0's hidden Expo option=false remains pinned/version-specific; no broad native/iOS/leak approval from desktop SQL tests.
- Actual review:25owner contract,14governance and15independent architecture tests PASS in parent reruns; strict TS PASS; final manifests/source hashes matched. Initial invalid-positive counterexamples are preserved and fixed. Parent source-policy revisions reject whitespace/case-varied placeholders and padded raster kinds; historical lane manifest plus explicit revised hashes retained.
- Rejected alternatives: names/coordinates as changing IDs, entity approval as all-fact approval, blanket denial without positive controls, rights copied between snapshots, centroid routing, or host tests as native lifecycle evidence.
- Revisit: property-specific real intake validation and later pack migrations, any schema/native upgrade, production search/device/field gate. Parent ACCEPT for M1 only; no real facts or rights cleared.

### 2026-10-09 / M1 / Parent engineering and QA review
- Authorized objective: M1–M14 dependency-ordered program; user continuation resumes saved drafts after service usage interruptions. Branch `codex/m1-m14`; no merge/publication.
- Actual delegation: Sol Medium contracts fallback/Governance, Sol High independent M2 design, Astra Low M1 architectural reviewer; all scoped owners. Parent independently reviewed code/SQL/data/policy, reran54tests and strict TS, verified final hashes and source/header/scope conditions.
- Actual defects: subtype/NULL/evidence constraints, timestamp/metadata/raster disagreement, native ownership limits, identity recycling and dangling associations challenged; all M1 blocking counterexamples corrected. Parent review script initially had unmatched parentheses and was corrected before its successful independent run. No failed result counted as PASS.
- Inputs/tools: existing pinned Expo/M0 stack, Python stdlib SQLite3.50.4 and SHA256, Node22.20.0/TS6.0.3, current primary policy/advisory pages. No GIS data acquisition, user position, merchant scrape, media reuse, participant fabrication or native app change.
- Security reconnaissance: fresh online audit24(16high/8moderate); first sandbox DNS failed, approved registry retry succeeded. Offline audit zero rejected as evidence. Actual M0 Android JS source-map inspection finds no affected package sources; initial Hermes temporary-write failure retained and inspection-only no-bytecode retry passes. Production security not accepted.
- Evidence: `milestone-handoffs/M1.md`, `evaluations/m1/parent/APPROVAL.json`, parent/lane logs/manifests, independent architecture report, `evaluations/program/security/`.
- Parent disposition: **ACCEPT M1 / PASS** for engineering contracts/policy. Zero approved real records; native/field/release/legal acceptance withheld. M2 full gate BLOCKED; independent draft review continues. M3/M4 can start after the separate accepted M1 commit.

### DEC-035 — Consolidate integration under the accelerated user instruction
- Date / author / reviewer:2026-10-09 / parent / direct latest user instruction.
- Decision: retain accepted M1 and existing work; implement against reviewed engineering foundations concurrently and consolidate native/regression validation. Routine compilation/focused tests permit development continuation; critical data, rights, security and navigation acceptance still require actual evidence. Full external M2/M4 gates remain BLOCKED, while interface/UI/engine development proceeds without inventing inputs or presenting them as passed prerequisites.
- Actual routing: three implementation owners Sol High UI/routing and Sol Medium ETL fallback (Terra unavailable). Parent owns native dependencies, pack/map integration and commits. User testing replaces no source permission or field safety evidence. No dataset publication/main merge or production acceptance.
- Native changes: SDK-matched pinned expo-location57.0.20, file-system57.0.7 and crypto57.0.3; foreground location only, optional/manual alternative, no position upload/retention. Native build required once integration completes.

### DEC-036 — Accept historical raw GIS for internal pilot packaging
- Parent ACCEPT exact raw/sidecar/query/scope/UUID mapping, then fresh internal derivation. No prior processed geometry/code or inferred entrances reused. Existing raw ODbL bytes reused without editing API requests; historic acquisition-policy conformity remains unverified. All graph edges CANDIDATE/navigation denied;386relations quarantined. Parent independent original raw edge checks and21tests passed.
- PMTiles Android asset proof uses pinned native13.6.1 support, local glyphs from verified Noto Sans/OFL bytes and project-authored procedural sprites.28tiles/878renderable geometries, package assets247,847bytes; exact repeat manifest9d5a262ce05e5bac0bed1e2d43b9159d9c3bbae2ed50f292920edf986d073b5b. Heights are explicitly illustrative visual values, never surveyed dimensions. Android device proof pending; iOS local resource installation unresolved, no iOS success claimed.
- Retain ignored raw/derived/font/APK resources; commit reproducible tools and evidence only. Font/ODbL notices retained locally. Dataset redistribution and public release rights remain separate human/user gates.

### 2026-10-09 / accelerated integration
- M1 committed d775bbd. M2 engineering draft parent ACCEPT (8model/5browser reruns, screenshot inspection,95hashes); full Figma/participant gate unrun. M3 parent ACCEPT internal candidate GIS (21tests,3,249raw-edge checks,19lanehashes). M4 tooling parent ACCEPT (30focused rerun,15hashes); actual verified coverage zero. New handoffs distinguish engineering artifacts from full acceptance.
- Agents resumed saved work after transient usage interruption; account read-only check showed ordinary usage available. No purchase/reset performed. Owners now implement native UI, safe routing engine and local data/updates in exclusive paths. Parent native pack generator uses isolated pinned free libraries, local fonts/sprites and no raster service. Consolidated final build/device/regression phase remains pending.

### DEC-037 — Explicit content projection and reviewed local activation
- Date:2026-10-09–10 / parent. Parent authorizes new mobile002 local saved state and003 entrance/transit projection;001 and immutable IDs remain unchanged. Content versions1/1,3 differ from local1,2. Each current claim/association requires retained evidence; no building-centroid entrance or inferred transit shape.
- Final native integration uses optional SDK-matched foreground location, explicit statement ownership/finalization, two-slot immutable packs, exact local manifest trust, version/dependency/rights/expiry gates, strong ETag/range resume/cancel and local style paths. Download catalogue remains empty until real rights/source/parent review. Approved-core loader binds graph source/version/scope/expiry and clears missing/untrusted data before routing.
- Parent reviewed critical code and independently inspected final QA:172final cases, strict package/app TS; historical owner hashes preserved with later parent/loader revisions explicitly bound. These are desktop results, not device/search/route performance or data approval. Original game-inspired garden styling uses accurate retained footprints and procedural original art; generic flat-map substitution rejected. Flat view zeroes illustrative extrusions for navigation/readability.

### DEC-038 — Honor explicit skip of physical tests; retain acceptance blockers
- Date:2026-10-09–10 / parent / direct user reply: "dont do the test just keep developing". Stop the planned phone testing; continue independent code/build work. Physical phase records NOT_RUN_USER_REQUEST. M0 historical SQLite/render results are not reused as current passes. Production and full native/field/UX milestone acceptance remain BLOCKED.
- Current real approved places/menus/entrances/transit and graph-eligible edges are0. New exact-source internal queue has290historical leads/9ambiguous name groups; no canonical merge, currentness or mobile promotion. Real source permissions/field evidence cannot be fabricated to satisfy tomorrow's target. No main merge, public dataset/APK distribution, paid service or purchase.

### DEC-039 — Final map pack and Windows build reconciliation
- Corrected DEC-036's initial prototype: remove40outside-pilot trees and290point-road records, omit unused zoom13's sub-pixel sliver. Final reviewed pack27tiles/548records/212,121resource bytes, manifest2fa53a5bd54425bad58b86d592fd69baf687ac048a982e3e1e7489ed96cae808. Independent all-tile geometry error≤0.416093m within tested quantization bound; glyph/atlas/source/hash checks pass. Native proof skipped, not inferred.
- Authored style and metadata inventory are tracked; geographic/font/tile raw/generated bytes remain ignored. CNG verifies exact inventory/style/resource SHA+size before packaging. iOS resource installation remains absent; app explicitly reports it.
- First integrated release compilation succeeded. Final permission-reduced rebuild failed in Ninja on a261character transform path. Task-owned cache moved within verified workspace containment to repository .g (249character equivalent); CMake outputs archived, no source/global system edits. Retry/resumed logs remain separate; completion is recorded only by final build/ARTIFACT evidence. Background task-owned M0 Metro writer was stopped after process-chain ownership verification; appended warnings preserved separately and original historical log restored.
- Fresh final online npm audit remains24(16high/8moderate); forced incompatible SDK downgrades rejected. Security/native lifecycle/public release approval remains withheld.

### 2026-10-10 / parent final preview artifact review
- The short-path retry reached compiled packaging but its process ended across chat resumption; no completion was inferred. Cached resumed build exited0 with BUILD SUCCESSFUL in4m23s,583tasks/12executed/571up-to-date. Final local ARM64 preview APK41,287,919bytes, SHA256ab8909682dfcf8401a6c7ccd844d292e2db73eb0d8c6eff0c7740068969c17ba, packagecom.omnibgc.preview/version0.1.0/SDK24–36.
- Independent ZIP/resource/manifest/apksigner checks PASS:9exact resources and authored style/inventory, release bytecode, ARM64 only, valid APKv2 development signature, backup/debug false, background location/audio/overlay/external storage absent, Expo auto-updates false.730source-map entries contain none of3direct advisory packages (braces/node-forge/uuid); all24dependency findings and native/host security assessment remain OPEN.
- Parent ACCEPT bounded code/data-pipeline/QA and INTERNAL_PREVIEW_ARTIFACT_ONLY. Full native, user study, field navigation, source rights, iOS and production acceptance BLOCKED. Physical testsNOT_RUN_USER_REQUEST. Separate scoped engineering commits record partial deliverables without declaring blocked milestones passed; no publication/push/main merge.
