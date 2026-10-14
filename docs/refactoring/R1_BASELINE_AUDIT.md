# R1 baseline audit — 2026-10-14

Base: `7b468f37ff43bde171a683aeac3a736bc6dae399`. Clean working tree on `main`; fetched `origin/main` is identical (0 ahead/0 behind). Work proceeds locally on `codex/r1-engineering-hardening`. No active local AI edits, commits, pushes or main integration. Reference and current implementation coincide.

## Plan and success criteria

Establish baseline → standards → shell → shared domain rules → conversation → storage/packs → map → pipeline/shared review → final regression/review. Preserve exact deterministic outputs, geographic/source artifacts, saved read semantics, native lifecycle, thresholds and integrity checks. Avoid inferred performance improvements and unjustified abstractions. Each bounded milestone receives parent source/evidence review before proceeding. Native acceptance remains separate.

## Actual implementation

Expo 57.0.27, RN 0.86.3, React 19.2.3, TypeScript 6.0.3, MapLibre RN 11.5.0. Node 22.20.0/npm 11.18.0, Python 3.13.7, Windows PowerShell. Existing lockfile dependencies installed. Current architecture decisions DEC-049–052 supersede early blueprint scope: mounted Map/Assistant pager, guarded shake, compact sheets, deterministic directory; walking/planning and inference unavailable. Production retrieval is approved-only; Explore adds candidate/fictional presentation records. Current AI work comprises retrieval/evaluation foundations, not native generation.

Reviewed instructions, README, implementation plan, decision journal, AI architecture, UX V2.1/AI handoffs, CI and Git attributes. README incorrectly calls this a plan without code and claims the source register is blank. Early plan's Router/Zustand choices are proposals, not installed architecture. Historical AI/UX handoff branch/staging descriptions are historical: current clean main already contains their accepted code.

## Dependencies and responsibilities

AST audit: 50 TS/TSX modules, 107 local import/re-export edges; one cycle `updates/index.ts ↔ updates/style.ts`. Domain/geo/routing are pure; mobile adapters own native storage, pack installation, location and map resources. UI depends on domain contracts and explicit callbacks; App presently combines initialization, navigation, panels and pack UI actions. `data/store.ts` owns serialized local connection lifetime plus content reads and temporal SQL. `updates/index.ts` owns serialized installation, recovery and rollback; validation must remain fail-closed.

Pipeline review: map builder stages resource generation/validation; intake owns source/entity review; Python retrieval and exporter enforce temporal/evidence gates. Shared routing already has pure typed A* and adversarial tests. No topology/schema changes justified. Generated geographic/font resources and reviewed evidence are byte-sensitive and excluded from formatting.

## Behavioral baseline and risks

Existing executable host tests cover Map/Assistant handoff, selected sheet retention, keyboard-before-Back, confirmations, saved readonly itinerary, startup stage failure/deduplication, source gates, exact budgets and pack contracts/resume. Synthetic AI observations provide 120 deterministic comparison inputs, including English/Filipino/Taglish. Native UX handoff covers a historical APK, not this refactor. Current read-only preflight: BLOCKED, no authorized phone. Cold start, camera/gesture rendering, physical shake, background/resume, native SQLite and TalkBack require fresh device verification. Host mocks never establish those results.

Risks: lifecycle extraction can change cleanup/subscription timing; monetary sharing can change errors; SQL relocation can lose temporal predicates; validation split can weaken trust; formatting can disturb source-string tests/artifact bytes. Mitigation: retain callbacks/dependency arrays verbatim unless documented, differential outputs, exact SQL comparison, executable imports and frozen protected-file hashes. No production runtime selection, data publication, migrations or permissions changes.
