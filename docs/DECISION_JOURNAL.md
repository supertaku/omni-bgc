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
