# R1 implementation report

2026-10-14, base `7b468f37ff43bde171a683aeac3a736bc6dae399`, local `codex/r1-engineering-hardening`. **Overall PARTIAL: host implementation and review accepted; fresh native acceptance unavailable.**

## Executive summary

Application initialization, navigation, pack actions and panel presentation now have explicit owners. Conversation logic can be tested independently of cards/layout. Exact money parsing is shared without merging distinct search/evidence policies. Temporal SQL is reviewable separately from connection lifetime. Pure style contracts remove the existing import cycle; map transforms are testable without moving native camera effects. Pinned development checks and CI gates now protect these boundaries. README describes the actual application.

## Before versus after

| Area | Before | After |
|---|---|---|
| Entry point | 17,940 bytes; providers plus all shell operations/panels | 396 bytes; providers/composition mount; focused hooks and panel presentation |
| Operational coupling | Startup/navigation/alerts/downloads and UI switch in one closure | Initialization/navigation/pack operations separate; Application owns composition/layout/notifications |
| Money | Same regex/BigInt conversion duplicated | One pure parser; retrieval throw and Assistant null policies retained |
| Conversation | State/timer/cancellation mixed among rendering | Dedicated hook; screen owns suggestions/timeline view |
| Storage/style | Temporal SQL embedded; manager↔style cycle | Exact query module; pure style validation/URI module; public loading/export surface retained |
| Map | Mode/feature construction embedded in renderer | Pure presentation functions; native effects/layers unchanged |
| Import inventory | 50 modules, 107 local edges, 1 cycle | 59 modules, 132 edges, 0 cycles; additional files have concrete extracted responsibilities |
| Quality | Strict TS/tests, no lint/format gates | Pinned dev-only ESLint/Prettier/Ruff, scope-aware format, import gate, additive CI and regression contracts |
| Evidence | Some writers defaulted to historical paths | Task-local output options; all 610 protected artifacts preserved |

These are measured source/dependency counts, not maintainability scores or runtime performance improvements. No application dependency version change, schema migration, canonical ID/geometry/source-policy edit, cache, global state library or inference provider.

## Milestone handoffs

Parent reviewed contracts, source changes and evidence before accepting the bounded host artifacts. Native requirements remain separate; no main integration occurred.

| Milestone / objective | Reviewed source, confirmed problem and changes | Tests / actual result | Status, remaining risk and next-step safety |
|---|---|---|---|
| R1-0 baseline/inventory | App/features/data/updates/map/packages/pipelines/CI; stale README, responsibility coupling, money duplication, import cycle | 25 pinned baseline groups PASS; instructions/docs reconciled; protected hashes frozen | PASS host audit; native unavailable; safe to start standards |
| R1-1 standards | Strict TS retained, authored-source configs/scripts and additive CI; duplicate component import removed | ESLint/format/Ruff PASS; runtime version comparison unchanged | PASS scoped adoption; 2 inherited camera warnings; safe to extract shell |
| R1-2 shell | Added app/Application and initialization/navigation/pack-action hooks; ExplorePanels rendering; root providers retained | Existing App/startup tests and pack UI/lifecycle tests PASS | PARTIAL: host ACCEPT, actual Back/keyboard/storage pending; safe host domain work |
| R1-3 domain DRY | Added domain/money; retrieval and directory use exact parser; distinct NFC/NFKC/category/evidence rules retained | Exact budget/source tests, policy characterization and 120-output hash PASS | PASS host; no production eligibility change; safe conversation work |
| R1-4 conversation | Added useDirectoryConversation; screen rendering separated; existing timer/state/messages preserved | Existing UI/directory plus cancel/retry/current-record/error/unmount tests PASS | PARTIAL: host ACCEPT, mounted native verification pending; safe storage work |
| R1-5 database/packs | Added queries/style-contract; manager/bundled loader import pure contract; all integrity checks retained | 4 SQLite tests, 22 original pack contracts/resume, actual manager fixture tests PASS | PARTIAL: host ACCEPT, native filesystem/SQLite/performance pending; no cache; safe pure map work |
| R1-6 map/native | Added pure POI/style functions; kept camera/resource/sensor/pager lifecycle | Installed layer/resource contracts; 4 actual display modes/161 POI baseline comparisons PASS | PARTIAL: host ACCEPT, device screenshots/camera/resume/shake pending; safe tooling review |
| R1-7 pipeline/shared | Reviewed build/intake/Python reader/exporter/shared domain/geo/A* stages; no evidence justifying broad splits | Ruff and original GIS/projection/retrieval/topology/package gates PASS | PASS bounded review; mechanical restructuring DEFERRED by KISS; safe final host gate |
| R1-8 regression/final review | Added helpers/refactoring suites, updated actual-module VM harnesses, additive CI; accurate README/docs | 31/31 final groups PASS; UI/resource gate PASS; protected bytes/diff PASS | PARTIAL: host ACCEPT; remote CI and native NOT_RUN; no automatic next product milestone |

## Changed paths

- App/root and `src/app/{Application,useAppInitialization,useExplorerNavigation,useContentPackActions}`; new ExplorePanels.
- AssistantScreen/new conversation hook/directory/shared money helper; duplicate import cleanup in cards.
- Data store/query/retrieval; style loader/new pure contract and manager/bundled-loader imports; map presentation/MapCanvas.
- `apps/mobile/{package.json,package-lock.json,eslint.config.mjs,.prettierrc.json,.prettierignore}`; quality/import/format scripts; output option in check-ui-program.
- `pyproject.toml`, `requirements-quality.txt`, `.github/workflows/quality.yml`; existing harness imports and new `tests/helpers`, `tests/refactoring`; deterministic replay output option and map checker import.
- README, DEC-053/work journal, focused refactoring documents. No source modules removed; no historic files deleted. `git diff` includes formatting only for enrolled affected modules; small unrelated import/harness edits preserve existing style.

## Test results and known limitations

See [validation](R1_VALIDATION.md) for exact results, [baseline](R1_TEST_BASELINE.md), [inventory](R1_REFACTORING_INVENTORY.md), [architecture/state ownership](R1_ARCHITECTURE.md) and [journal](R1_WORK_JOURNAL.md). Reproduction: `python apps/mobile/scripts/quality.py --output .g/r1/quality` with pinned prerequisites. Final local logs are `.g/r1/final-reviewed`; independent source comparisons are `.g/r1/review.json`; UI/source/contrast evidence `.g/r1/ui`.

No deterministic response, ordering, monetary boundary, source trust, style/resource or protected artifact difference found. Actual Android rendering/keyboard/Back/persistence/TalkBack remains unverified. No new APK or remote workflow run. Two inherited camera warnings and original explicit-refresh/download completion setters after unmount remain documented technical debt. No native performance/battery gain claimed. Historical data approval/distribution/iOS limitations remain.

## AI readiness

Approved retrieval remains separate from UI-only records. Conversation ownership and pure monetary/style/query boundaries are clearer; startup and native infrastructure stay explicit. Future inference can add a provider/model lifecycle, validated dispatcher and grounded-generation contract under DEC-052 after physical benchmarking. None is implemented here. The unchanged synthetic shell score is 28/120 with one existing raw collection-policy violation and manual prose review pending; exact behavior preservation does not mean complete AI quality.

## Overall acceptance

**PARTIAL.** Parent ACCEPTS the bounded host changes and regression evidence. All host-verifiable required gates pass; native acceptance is blocked by zero authorized Android devices, remote CI remains unrun, and no final commit was created. No main merge, push, dataset publication, permission change or destruction of user data.

TL;DR: Focused responsibilities, exact deterministic behavior, zero import cycles, additive quality gates; complete host work retained locally with explicit device gates.
