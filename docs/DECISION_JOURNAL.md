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

### DEC-040 — Provisional canonical spatial target with the accepted SQLite bridge
- Date/author/reviewer:2026-10-10 / architecture owner / parent plus independent geography reviewer.
- Parent decision: **ACCEPT additive implementation and architecture recommendation only**; production replacement and full architectural gate PARTIAL. Select PostgreSQL/PostGIS for relational/temporal/spatial canonical review, retaining immutable permitted raw and offline SQLite FTS5/RTree. Existing SQLite intake/export remains operational; no accepted schema/identity edits.
- Why/how: normalized occupancy, branch-menu/variant prices, exact evidence/history/doc spans and geography need a governed transactional store. Four isolated migrations and63logical mappings/87tables/views, marked disposable loopback runner and exact migration hashes. DuckDB remains optional analytics; another graph/search/vector system adds unmeasured ownership complexity. No AI feature or dependency.
- Review evidence:15portable/actual grammar-parser tests, four independent document probes and M1 regression pass. Counterexamples for geometry subject/endpoints, exact source-text passages, temp search_path, lost parent prose, link UUID/calendar arrays, hash reread and remote PGHOSTADDR/service defaults corrected. Actual local preflight exit3:psql absent. Static parsing is not live SQL/PostGIS correctness.
- Revisit before operational use: server migration/constraints, production roles/authentication, backups/restore, typed schedule/amenity validators, canonical-to-SQLite bridge and query/export tests. No real rights/data/publication acceptance. See `architecture/M4_CANONICAL_DATABASE.md` and independent canonical review.

### DEC-041 — Exact full historical acquisition-envelope discovery
- Date/author/reviewer:2026-10-10 / geography owner / parent.
- Parent **ACCEPT** the full exact September14OSM raw envelope for local internal discovery under current user-authorized broad M4 research. This deliberately extends the prior pilot discovery scope without changing production raw allowlists, service-area IDs or asserting an official district boundary.
- Raw SHA256c7c77bdee83947293624a3a6036089e809c2fb2c1cec4d5283fb1c89535a8ac3; sidecar/query/oldboundary/approval hashes bind before parse. 21,290elements inspected;20,103candidate sourceobjects, not establishments.20,103original values independently checked; two outputs byte-identical. Contributor/contact data minimized; no centroids/canonical UUID/door/route inference. Every record unapproved, district membershipUNKNOWN, publication/navigationfalse.
- Historical processed entity mismatch remains unchanged/unexplained after four serialization probes and is quarantined. Nine current pilot resource hashes pass; no native render inference. Rejected: fix checksum claims, reuse prior processed geometry/code, infer district membership or promote old tags as current.
- Rights: ODbL attribution/lineage retained; human obligations, fact/currentness/field review and concrete distribution authorization remain separate. No main merge, publishing, new endpoint download or rights-restricted scraper.

### DEC-042 — Deterministic M4 readers and immutable local export proposals
- Date/author/reviewer:2026-10-10 / parent / independent business software reviewer.
- Parent **ACCEPT bounded host-tested software**, separate from full data/publication/native gates. Reuse accepted M1/M4 gates and read projection3, keep personal1/2state separate, require every exported fact/evidence-link/identity/point/snapshot to match exact immutable retained intake and bytes. Proposal manifests remain nonremote, publicationfalse; M13 catalogue remains empty.
- How/why: explicit current relationships, source-linked unknown/stale outputs, lexical search/RTree+geodesic proximity, exact currency/decimal budgets and explicit tags provide useful assistant-ready access without AI. Native parser/services add structured prices and exact optional citations; no SQLschema migration or relation guess. Atomic immutable capture supports authorized local CSV/JSON/GeoJSON/GTFS format exports, with GTFSsemanticreviewpending. Permissions read once after hashcheck, no reread race.
- Independent failures fixed: native stale menu/building parents, currency-only filtering, duplicate JSONkeys, injected canonical fact/evidence exports and collapsed same-source citations. Newly added tests protect these interfaces. Host10kbenchmark revealed full-fact scans; details/search/proximity narrowed to entity lineage. Final median0.310ms/0.711ms/5.163ms are synthetic host measurements only, no Android budget/real pack projection.
- Final evidence:241deterministic cases PASS, one portable historical skip separately exercised locally, app/strict package typechecks pass. Current ADB read-only retry succeeded with0devices; PostgreSQL absent. Device, rights, source census, field/topology, canonical bridge/recovery/security gates remain open. No install/rebuild/device write, precise-position upload, dataset publication or Git integration/commit.

### DEC-043 — Ordinary product presentation with source-derived local browsing
- Date/author/reviewer: 2026-10-10 / parent, following the user's approved UI program and explicit request to remove demonstration labeling. Supersedes the supplied program's visible Demo indicators for this local app experience; does not grant verification, publication or navigation approval.
- Parent authorizes an isolated local presentation directory from the exact retained OSM review inventory. 161 named point records keep original coordinates, candidate status and source citations. Separate namespace `1fe2ab32-2b72-570b-a423-bc34fa81312f` produces stable UUIDv5 display identities without changing canonical IDs. Same-name records remain distinct. Menus, ratings, opening hours, entrances and routes are not invented. `Place.cuisines` is an explicit additive optional presentation field populated only by literal source cuisine tags; no SQLite/schema migration.
- WHY/HOW: make real search, category browsing, selection, saves and Assistant handoffs usable for visual review while the user completes integrity work later. Normal screens avoid demo/pilot banners; source status remains accessible behind disclosure. Approved projection readers/exporters, graph/entrance gates and the empty reviewed download catalogue are preserved. Reject silently promoting candidates or copying fictional reference businesses.
- Parent independently inspected the three bounded agent lanes, reran focused contract/route/source/search tests and contrast/hash checks, then ACCEPTED host-tested UI implementation. Device interaction and source publication approval remain separate. Map/Assistant stay mounted to preserve camera/conversation; actual lifecycle behavior requires Android evidence.

### DEC-044 — Verified app-private offline resources and bundled visual identity
- Date/author/reviewer: 2026-10-10 / map engineer and parent. Installed MapLibre RN11.5.0/native Android13.6.1 lacks the asset byte-range fix from upstream4360/4602. Parent ACCEPTS streamed asset copy, exact SHA/size checks and atomic private directory activation; renderer receives local file URLs without a speculative dependency upgrade.
- Original source-aligned pastel extrusion families,19map sprites and a six-entry generic source-footprint landmark registry retain geographic geometry and ODbL notices. Nunito700/Nunito Sans400/600 and Ionicons are bundled with licenses; static font generation disables timestamp nondeterminism. Safe-area-context5.7.0 handles Android/iOS bars. No runtime remote assets or AI dependency.
- Review caught resource-copy timing mismatch and missing U+2019 glyph coverage; the first successful APK was superseded. Final build/resource hashes and validation are in `docs/evaluations/ux-program` and the UX program handoff. Mock resource-install tests and successful packaging do not prove native rendering. Read-only ADB/AVD inventory found no device/emulator, so cold launch, screenshots, FPS/memory, TalkBack, gestures and iOS resource proof are NOT_RUN.
- No main merge, push, dataset publishing, permission expansion or production acceptance. The user retains final aesthetic/interaction review on an Android device.

### DEC-045 — Narrow Android bridge compatibility and portable candidate rejection
- Date/author/reviewer: 2026-10-10 / parent Staff Mobile Engineer, following explicit crash/CI/build instructions.
- WHY/HOW: installed MapLibre RN11.5.0/Android13.6.1 JSX iconPadding setter reads a float array while serializing scalar8 unchanged. Remove that override; retain scalar padding in directly parsed style JSON. Guard installed JS serialization against installed Kotlin getters in required CI; no Expo/RN/MapLibre upgrade or map-resource/geometry change.
- Required portable routing tests use a committed project-authored M3-shaped candidate export and a valid synthetic GraphPack with candidate status. Both reject install, clear an existing usable graph and deny navigation. Preserve real historical assertion separately; missing ignored input explicitly NOT RUN. Reject dropping assertions or redistributing historical data to fix CI.
- Parent ACCEPT host implementation/packaging and remote Quality run38045341923 on5176fe9, including final strict TypeScript. Native gate remains BLOCKED:0ADB devices. Rebuilt development-key ARM64 preview hash4094d40a1ca8fbcfd86a4093b9654803ef3ee2d3cb4996ce946a098c07c99a7d;10offline resources/3font weights/Ionicons/signature verified. Real launch/gesture/offline/TalkBack evidence is not implied. See `docs/evaluations/android-ci-stabilization/HANDOFF.md`. Fix branch pushed as requested; no main merge or dataset publication.

### DEC-046 — Observable startup and native SQLite capability correction
- Date/author/reviewer: 2026-10-10 / storage engineer / parent Staff Mobile Engineer. Parent **ACCEPT bounded host implementation** after independent workflow/source/SQLite regression checks. Physical startup confirmation remains pending.
- WHY: the exact accepted initial schema creates an RTree; Expo SQLite57.0.4 defaults FTS flags only. Historical APK library lacks ENABLE_RTREE/module strings. HOW: enable the documented custom native RTree flag, check actual compile capabilities and integrity before migration, retain exact accepted migrations and original saved rows. Rebuilt native library includes RTree and FTS5. This is binary/source proof, not device execution.
- Content reads now own content connections independently of local preference failure; typed startup stages share one in-flight attempt, return null for unavailable saved state, and retain graph rejection receipts. Save writes are disabled until storage is usable. Missing local structures use exact accepted transactional recovery; malformed/corrupt data remains preserved and rejected. Reject clearing the database, hiding failures or blaming every stage on Saved Places.
- Evidence: `docs/evaluations/ux-v2/storage-handoff.md`, capability reports and focused storage tests. No schema/ID/permission expansion or silent saved-data loss.

### DEC-047 — Tabless explorer shell and explicit fictional working examples
- Date/author/reviewer: 2026-10-10 / parent plus mobile UI engineer. User's UX V2 brief supersedes the two-tab presentation in the original implementation/UI plans and DEC-043. Parent **ACCEPT host-tested code and internal APK**, full gesture/accessibility/memory acceptance remains PARTIAL.
- HOW: two continuously mounted screens in a native-driven280ms horizontal track; Gesture Handler2.32.0 from installed Expo57 compatibility map; inset one-finger map handle instead of a whole-map pan recognizer, vertical-scroll failure thresholds and explicit Assistant/Back controls. Reduced motion disables duration; hidden pages exclude touch/accessibility. Keyboard return uses explicit Back. Screen state/draft/conversation/selected place remain; leaving written walking instructions requires confirmation. Live GPS guidance is not claimed.
- Compact48dp search,34dp visual chips within48dp targets,140dp place peek, header-only drag and measured camera padding replace oversized chrome. Secondary Data/Privacy preserves diagnostics and attribution. Rejected broad map gesture, permanent tabs, added Reanimated runtime without need, unlicensed reference photos and fake AI.
- Six fictional branches/33sample dishes have explicit sample notices, stable isolated IDs, null coordinates, no entrances/routes/verified facts. Literal queries exercise menus/budgets/recipe tags/saves/itinerary; canonical evidence gates remain. Navigation UI preview is nongeographic and clearly cannot guide real walking. Parent independently reviewed specialist handoffs and corrected landscape/modal-handle/route-return/lifecycle issues.
- Device/AVD inventory has zero targets; mounting/TextureView memory tradeoff, screenshots, TalkBack and native gesture arbitration are NOT_RUN. New code is on `codex/ux-v2`; no main merge/push/publication.

### DEC-048 — Source height precedence and bounded patterned native city rendering
- Date/author/reviewer: 2026-10-10 / rendering engineer / parent GIS and mobile reviewer. Parent **ACCEPT bounded source/asset/native code**, aesthetic/native performance gate remains PARTIAL.
- Preserve exact retained footprints, IDs and candidate status. Forty in-scope buildings/parts use17historical explicit height tags,4floor-count estimates (3m/level),19deterministic family defaults. Source, estimated and visual fields remain separate. Six landmark registry entries expose source checksums and unknowns; PSE feature height is not extrapolated to a tower complex. No new geometry or facade measurements are invented.
- Implement ten original procedural facade families, roof caps on the same footprint,29density-consistent offline sprites and zoom tiers; crosswalk decoration uses6existing source-tagged ways. Native texture view composes the screen slide; full © OpenStreetMap contributors control opens offline license details. No GLJS custom-render bridge or engine migration without supported APIs/measured benefit.
- Parent independently validated every decoded tile, height parser, resource/asset hashes, installed style/bridge contracts and atlas appearance. Frozen packSHA6356b38277d10333dfb866a8cc0bd1520f65e8d1dce0f8abdd2eb3c09488a25e;499642bytes/27tiles/548sourceIDs. Scope is High Street, not all BGC. Original artwork and ODbL geometry remain separately licensed; geographic/public distribution approval remains withheld.

### DEC-049 — Default shake navigation and minimal explorer controls
- Date/author/reviewer: 2026-10-10 / parent Staff Mobile Engineer and three bounded specialists. The user's final steering removes numbered marker clusters, Transit information, Settings and the shake toggle; shake is enabled by default. This supersedes the refinement brief's disable-preference requirement. Explicit white Chat and Assistant Back remain accessible independently of the sensor.
- WHY/HOW: keep geographic map gestures free of screen navigation; reuse the continuously mounted 280ms native-driven pager and reduced-motion handling. Expo-sensors57.0.3 matches installed Expo57. Gravity filtering plus four opposing peaks, a1.1s pattern window and2.5s cooldown rejects single shocks. Subscribe only in foreground, block keyboard/transition/confirmation/critical operations, remove only owned listeners. No new permission, motion retention, location upload or AI runtime.
- Synthetic motion and listener/guard tests pass; physical Android proves sensor registration/background cleanup separately. Deliberate shake and ordinary walking require actual physical interaction and must not be inferred from synthetic traces. Calibration remains provisional until that interaction is observed.

### DEC-050 — Direct information sheets and deferred navigation UI
- Date/author/reviewer: 2026-10-10 / parent Mobile/UX/Data reviewer. Selected places open a compact140dp summary; header drag reveals available sections directly. Overview and supported hours/menu/services/Sources start expanded and retain independent collapse while Map/Assistant stay mounted. Empty sections are omitted. Item-level source disclosures are compact.
- Source-derived candidates keep identities, coordinates and lineage. Fictional menus/hours remain isolated, explicitly sample, coordinate-null and navigation-ineligible. Candidate menu prices/tags/allergens cannot be promoted by an approved parent item. Remove Save, Directions, origin/entrance, navigation previews, Plan and Add-to-Itinerary entry points; retain routing contracts, graph rejection, original saved reads and readonly itinerary/share. No schema migration or saved-row clearing.
- Native QA exposed keyboard overflow. Snap/drag bounds now use measured pager height; physical screen dimensions determine orientation. Reject relying solely on Android adjustResize: this Android16 edge-to-edge device left compact results beneath the keyboard. Retain keyboard avoidance with measured sheet bounds. New regression preserves broad results and input identity through resize/drag; actual screenshots determine final acceptance.

### DEC-051 — Bounded source-aligned city detail and calibrated map glyphs
- Date/author/reviewer: 2026-10-10 / rendering specialist and parent GIS reviewer. Preserve548 source IDs,40 buildings/parts and the17height/4levels/19family hierarchy. Separate vehicle asphalt from source pedestrian surfaces; retain64 sidewalks,199surface tags,1recorded width and6tag-backed zebra ways. Unknown widths/lanes remain illustrative styling without fabricated geometry or connections.
- Twenty-seven deterministic static original pedestrians sit on eligible source public paths after13road/building-clearance rejections, capped80, zoom18+, native collision-managed symbols. Ten original facade families gain stable alternates. No new3D engine, live people, unsourced furniture, third-party photos or raster tiles. Generated geometry and placement evidence remain local/internal and are excluded from branch publication.
- Native label QA found an existing PBF baseline contract error: MapLibre font-maker uses24px raster bearingY minus25; our builder omitted25. Fix glyph top metric for all labels rather than per-layer offsets. Independent512glyph metric checks and resource/height/topology regressions pass. PackSHAab623c6776a08d80ee7b4e9befe472a4d9261aa5c5a70ebf11f30b27c2ae6235;566507resource bytes/27tiles/44sprites. Attribution retains readable full © OpenStreetMap contributors with license access. High Street internal coverage, historical source uncertainty and iOS validation remain explicit limitations.

- 2026-10-11 continuation: actual close-up QA found upright people appearing over roofs despite source-correct ground placement. Parent ACCEPTS the minimal layer-order correction and portable regression contract: decorative pedestrians precede every extrusion tier, with no changed geometry, heights, glyphs or sprite bytes. Repeated pack hash freezes identically; final native occlusion acceptance requires reconnection. Reject moving source-correct points or pixel offsets to conceal the defect.

### DEC-052 — Authorize offline AI program with measured native selection
- Date/author/reviewer:2026-10-11 / parent Staff AI/Mobile/Data Engineer / latest explicit user implementation instruction. The attached AI plan supersedes the earlier pre-AI prohibition; historical invariants, source-rights gates, UX V2.1 and navigation deferral remain. Preserved exact requested plan in `docs/OFFLINE_AI_IMPLEMENTATION_PLAN.md`; reconciled `AGENTS.md` and historical plan heading explicitly.
- Parent **ACCEPTS bounded architecture and retrieval foundation** in `docs/architecture/AI_LOCAL_ASSISTANT.md` after diff/source review and independent host regressions. One primary runtime/model remains PENDING physical measurements; no native inference package/model files installed and no production catalogue approval. Haki is read-only reference, with Kotlin/reflection/cancellation-quiescence/model-activation/vector-metric differences recorded once.
- WHY/HOW: actual installed Expo57/RN0.86 differs from Haki55/0.83. Menu retrieval now verifies claim/relationship/price/tag evidence and bounds literal vocabulary aliases; current SQL owns expiry. Approved source coverage0,161 candidate UI records, no real menu/passage corpus approval. Embeddings have no present measured justification. Rejected native stack transplant, three-runtime production APK, cloud fallback and choosing without phone evidence.
- Independent verification: TypeScript PASS;11 mobile retrieval cases,20 Python retrieval/export tests,13 startup cases,22 pure mobile contracts,20 existing Assistant tests,19 UI/navigation tests and3 synthetic device-probe tests PASS. These are host results, not physical inference or real BGC factual accuracy. Device preflight reports0 connected Android devices; native benchmark/selection/provider/UI integration/final AI APK remain blocked or unstarted under the requested order. No main merge, push, permission change, dataset publication, schema migration, location upload or device-data clear.
- Parent follow-up ACCEPTS bounded evaluation infrastructure after13 independent scorer tests and120-question replay. Baseline found an ordinary stale-menu leak; parent corrected fallback status eligibility and added regression, Assistant21/21 PASS. Replay structural result28/120,1 remaining raw collection-policy violation; no AI quality or UI-safety success inferred. Baseline records exact directory sourceSHA; proposed language/prose expectations remain unreviewed. See `docs/evaluations/offline-ai/QA.md` and final parent handoff.


### DEC-053 — Accept bounded R1 host hardening, preserve native gates
- Date/author/reviewer: 2026-10-14 Asia/Manila / parent Principal Mobile/Data/Quality review / user's R1 implementation request. Dedicated local `codex/r1-engineering-hardening` from clean `7b468f3`, fetched origin/main identical. Parent ACCEPTS bounded host refactoring after source review, independent regression reruns and exact-output/artifact comparison. Overall R1 PARTIAL pending physical Android acceptance; no main integration or publication.
- Extract initialization/navigation/pack UI ownership and Explore panels; retain providers and mounted pager. Separate directory conversation state without adding inference adapters. Share exact PHP BigInt parsing with original caller errors. Preserve distinct NFC/NFKC/category/evidence policies. Move CURRENT_FACTS verbatim and split pure offline style contracts from active loading to remove the manager/style cycle. Extract pure map presentation while retaining native effects, constants, layers and sensor thresholds.
- Adopt exact dev-only ESLint/Prettier/Ruff and additive CI/host quality gates. No runtime dependency version, schema, source identity, coordinates, approval, saved semantics, resource or permission change. Rejected shared permissive evidence/category policy, speculative integrity caching, broad pipeline/route restructuring and new global state/DI/navigation frameworks.
- Evidence: 31/31 final command groups, 13 new JS/4 SQLite cases, 120 byte-identical observations; 610 protected tracked files unchanged; all 4 map modes/161 POI outputs equal baseline; import cycle count 1→0. UI gate verifies 7 font/license hashes/161 source-only candidates/11 contrast pairs. Zero lint errors; two inherited camera dependency warnings require separate behavioral review. Source byte reductions are not runtime performance claims. TEST pack operation counts are fixture measurements only.
- ADB device_count=0; fresh Android rendering/Back/keyboard/offline/storage/resume, TalkBack/shake and iOS remain unaccepted. Existing screenshots are historical. Explicit-refresh/download after-unmount completion behavior retained as separate behavioral debt. No commit, push, remote Actions, APK rebuild/install, model selection or next product milestone. See `docs/refactoring/R1_IMPLEMENTATION_REPORT.md`, validation, architecture, inventory and work journal.

### DEC-054 — Separate offline restaurant research directory
- Date/author/reviewer: 2026-10-14 Asia/Manila / parent Staff Mobile/Data/Retrieval/QA engineer / explicit user restaurant integration request. Parent **ACCEPTS bounded host implementation for internal development** after source/diff review, direct checksum/bundle-ID inspection and independent canonical/governance/storage/route regressions. Overall native/product acceptance remains **PARTIAL**; rights/publication permission stays pending.
- WHY/HOW: use 278 actual supplied establishments and 1279 priced items now without weakening canonical authority. Deterministic Python CSV importer emits locally bundled JSON, original metadata and separate research evidence contracts. Permanent UUIDv5 namespace `b9446af3-dab7-5c92-afec-cb48b8195425`; external IDs derive restaurant identity, normalized item/section identity with fingerprint suffix handles collisions. Overview owns restaurant fields; details own item fields; three conflicts retain both values. Ten historical candidate-name overlaps remain separate without coordinate/entrance inheritance.
- Search/details and deterministic Assistant use distinct research operations/payloads. Exact decimal amounts compare through existing BigInt centavos; 923 estimates and 356 published entries, including starting prices, preserve classifications. Separate delivery/ordering/restaurant/venue contexts; no live opening assertion, inferred dietary safety, invented menus or geography. Bounded tool summaries/pagination exclude raw diagnostics and full directory prompts. Canonical approval/citations, schemas, saved state and native AI benchmark gates remain unchanged. Reject remote inference, new native research storage without measurements and treating URL availability as redistribution permission.
- Evidence: every baseline count matches, zero rejected/duplicate items; repeat import directory/manifest/validation bytes identical; 7 Python/8 JS food tests and all31 quality command groups PASS, 21 unit tests, 120 frozen legacy payloads unchanged. Offline Android Hermes export PASS, all278 restaurant IDs/1279 item UUIDs present. Final Node host service init17.31ms/query median3.35ms/p954.92ms are microbenchmarks excluding JSON parsing/native startup/memory. Asset4046150bytes including raw lineage.
- ADB0devices: native cold/airplane-mode/restart/keyboard/pager/TalkBack/screenshots/memory and iOS NOT_RUN. Generated/raw/bundle artifacts remain ignored/internal; no commit, push, merge, source publication, app install, schema/permissions change, runtime selection or walking navigation. See `docs/food-research/IMPLEMENTATION_REPORT.md`, contracts/workflow and daily journal.


### DEC-055 — Reviewed office facts and separate text companion
- Date/author: 2026-10-15 / Offices implementing parent, Staff Data/Mobile review role. The user's later completion instruction supersedes the attachment's first-PR stop. Root ACCEPTS bounded engineering design and host-tested integration; actual facts, rights, geographic pilot and public distribution remain unaccepted. Scoped OF-003/004 expand this decision in docs/offices/DECISIONS.md.
- WHY/HOW: reuse M1 business/place/building/floor UUIDs and retained M4 source/evidence/permission gates. Add essential office organization/address/district/presence/state facts, optional industry/precision, explicit audited office taxonomy; edit no accepted migration or provider/ID rules. Approved business identities require no invented point. Approved text offices use an optional office-directory.sqlite companion in the existing places pack; GEX geographic main.sqlite/export/containment rules stay intact.
- UI/Assistant read the same fresh approved records. Source-supported organization aliases retain citations; unsupported floors/geometry remain null. Operating-only default, explicit research/internal and registered/historical views, one building marker per mapped tenant group, no inferred entrance/routes, atomic UUID favorites, native share and current fact/evidence/snapshot expiry. Existing live-status, money and walking/planning deferrals remain. Candidate rows cannot become canonical Places or Assistant answers.
- Review/export preserve actual exact-source rights and immutable payloads. Supersession quarantines only the explicitly reviewed prior claim; history and stable site IDs survive. Revocation blocks new export; offline devices require controlled updates and expiry. Pack preparation grants no trust; finalize needs exact draft/rights/parent/user receipt and still requires independent app digest-registry acceptance. No source/canonical/public office approvals occurred.
- Independent GEX host review: 87 cases plus TypeScript PASS, docs/geography/validation-2026-10-15/shared-composition/parent-host-integration-review.json; geographic compatibility only. The 120-case deterministic Assistant baseline is unchanged. Full Offices test/build receipts and current limitations are in docs/offices/QA_MATRIX.md and IMPLEMENTATION_REPORT.md. Physical acceptance is separate.
- Rejected: spreadsheet High as approval; unreviewed names/coordinates/UUID promotion; weakening map scope to admit text records; Postgres/cloud prerequisites; source scraping/bulk geocoding/OSMF raster caching; overwriting historical facts; treating another chat's device authorization or frozen APK as current Offices evidence.
- User explicitly granted this chat USB/ADB at the late test stage, after coordination. Separate com.omnibgc.officespreview packaging and device ownership are required; original application/user data remain protected. No main integration or public distribution is authorized by this decision.


### DEC-056 — Host-first offline AI implementation and explicit action ownership
- Date/authority: 2026-10-15 Asia/Manila / owner's direct instruction to implement the complete M0–M9 software layer first. Supersedes DEC-052's mandatory early physical benchmark, without rewriting historical failures. All physical phone/USB/ADB work is reserved for owner-authorized M10.
- WHY/HOW: provisionally target one typed Expo/Kotlin LiteRT-LM 0.18.0 provider and Gemma 4 E2B; require exact artifact/API and host-native compilation. No reflection, compiler compatibility suppression, cloud fallback or performance claims from host compilation. Native quiescence independently owns the model lease; UI timeout cannot authorize reuse/deletion.
- Add separate `omni-ai-conversations.sqlite` with integrity checks, bounded finalized history, explicit clear controls and failure isolation. Existing favorites/content/map databases and canonical schemas retain ownership. History is local plaintext protected by app sandbox/disabled Android backup; encryption is not claimed.
- Authorize confirmation-gated favorites/itinerary software: exact approved entity IDs, expiring host-minted previews, real UI click, latest-state CAS and transactional narrow patches, with session replay receipts. Model output never confirms its own action. Walking navigation remains disabled; the map reuses existing canonical callbacks.
- Acceptance is pending evidence, not granted by this decision. Each milestone requires independent review and parent verdict; `ACCEPT_HOST` cannot imply `ACCEPT_DEVICE`. Models/private research remain ignored, production app identifiers preserved, no main merge or dataset publication. See docs/evaluations/offline-ai/HOST_FIRST_EXECUTION.md and milestone reports for actual outcomes.

- 2026-10-16 DEC-056 implementation addendum: exact typed compatibility is Kotlin2.3.20/Androidmin26/target36 and upstream-supported R8 9.1.31 (no metadata suppression). AI historyv2 is an explicit separate local schema with additivev1 migration, historical summaries/non-executable references and clear; no canonical/source/user-state schema changes. Approved source proof gates new visits; append retains old tuples, reorder preserves the exactmultiset, removal deletes only selectedexistingtuples. Current local unavailable visits retain explicit unknown labels. Final host acceptance/artifact is recorded in docs/evaluations/offline-ai/HOST_IMPLEMENTATION_HANDOFF.md; all physical acceptance stays M10.

- 2026-10-16 DEC-056 manual-tool protocol clarification: preserve host-validated dispatched assistant ToolCall names/arguments and named structured Content.ToolResponse observations through the pinned SDK. Host-rendered reference context is a user observation, never an unnamed tool reply. Context pressure removes whole older transcript bundles; the latest response bundle must fit or fail safely. Reject plain tool text as equivalent to the native manual-tool protocol. Four independent host continuation regressions pass; real Gemma continuation remains M10.

- 2026-10-16 final parent verdict: **ACCEPT_HOST / HOST_IMPLEMENTED for M0–M9**, after independent code/artifact reviews,33 quality groups, 135 AI tests, 7 integrated Kotlin tests and the actual offline ARM64 R8 release. Required receipt erratum transparently corrects only Metro normalized size 662→655; original APK/source ZIP/receipts/workflow remain immutable and all content hashes match. Future builder size checks and 8 receipt regressions pass. Exact APK/hash, original+supplemental evidence and independent verdict are in HOST_IMPLEMENTATION_HANDOFF.md. Overall NOT_RELEASE_READY; actual inference, UX/performance/offline physical acceptance remain owner-authorized M10. No merge or publication is approved.
### DEC-057 — Git-complete native recovery and clean-checkout gate
- Date/authority: 2026-10-16 Asia/Manila / owner's completion-plan execution request.
- Actual main `3fad67c` omitted all eight authored Android files because app-level
  `android/` ignored nested module directories. Local files exactly match reviewed
  R4 archive/staging and both receipt inventories; preserve rather than rewrite.
- Anchor generated app platform ignores; exclude module build caches explicitly.
  Require reviewed Git-index native blobs, worktree equality and actual Expo
  autolinking before source freeze. Separate authorized private assets/tool caches
  from authored source; prove a clean committed checkout independently builds.
- Two app scripts acquired CRLF during checkout, causing the strict historical
  audit to fail. Restored exact committed LF and narrowly preserved byte behavior;
  no original receipt, erratum, APK or archive was modified or reissued.
- Source recovery ACCEPT_HOST does not establish C2/device acceptance. Existing
  LiteRT/Gemma/CPU choice remains provisional. Follow ordered C0–C2 then D0–D6;
  explicit owner permission is required before preview install/device settings.
  No main merge, push, public assets/model distribution or walking authorization.
