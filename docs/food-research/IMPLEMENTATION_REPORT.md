# Food research implementation report

2026-10-14 Asia/Manila. Branch `codex/food-research`, clean basis `0b889c39220ff04679e1150f2cddadf64d59fe26`. Changes are uncommitted for review. No main merge or publication.

The supplied data is implemented in Explore search/details and the deterministic Assistant through an isolated offline research service. Existing canonical approval, SQLite, geography, saved-state and AI benchmark boundaries are preserved.

## Actual import

| Measure | Count |
| --- | ---: |
| Restaurants / named priced items | 278 / 1,279 |
| Published menu / starting / original-research prices | 106 / 112 / 138 |
| Estimated prices | 923 |
| Establishments without menus | 216 |
| Descriptions / recorded hours / specified location subsections | 137 / 26 / 203 |
| Rejected rows / duplicate items | 0 / 0 |
| Source conflicts / ambiguous candidate-name overlaps | 3 / 10 |

All supplied baseline counts match. Hours classify as 6 official restaurant, 19 delivery (including a partial delivery-days listing), 1 ordering, and 252 unknown records. Venue hours remain separate. No coordinate associations were approved. An early terminal Unicode concern was checked and corrected: no actual replacement-character warnings exist.

## Changed file inventory

- `pipelines/etl/place-intake/import_food_research.py`: reproducible importer, normalization, UUIDs, lineage, manifest, conflict/reconciliation/QA report.
- `apps/mobile/src/features/food/`: `contracts.ts`, `service.ts`, `directory.ts`, `assistant.ts`, `ResearchDetails.tsx`.
- `apps/mobile/src/features/explore/`: `directory.ts`, `PlaceDetails.tsx` for discovery and research details.
- `apps/mobile/src/features/assistant/`: `directory.ts`, `contracts.ts`, `cards.tsx`, `useDirectoryConversation.ts` for explicit injection, separate payloads/cards and hours context.
- `apps/mobile/scripts/format-authored.cjs`, `pyproject.toml`: enroll new authored files in existing format/Ruff checks.
- `tests/refactoring/test_food_import.py`, `tests/refactoring/food-research.test.cjs`: 7 importer and 8 retrieval/Assistant/UI tests.
- Existing explicit-mock adapters: `tests/helpers/load-ts.cjs`, `tests/refactoring/{directory-regression,lifecycle}.test.cjs`, `tests/ui/{app-refinement,mobile-interactions}.test.cjs`, `tests/data-quality/mobile/demo-directory.test.cjs`, `features/{assistant/ui-v2,explore/directory}.test.cjs`. Original assertions remain.
- `docs/food-research/{IMPLEMENTATION_MAP,README,IMPLEMENTATION_REPORT,WORK_JOURNAL}.md` and `docs/DECISION_JOURNAL.md`.

The existing formatter also normalized local line endings in `.prettierrc.json`, `eslint.config.mjs` and `dependency-audit.cjs`; Git shows no content diff. Selected touched TSX modules were formatted, accounting for the larger textual diff; there is no broad UI redesign. Dependency versions/lockfile, canonical/schema/routing/map/saved modules and historical evidence are unchanged.

Local ignored deliverables: exact raw snapshots, generated JSON/manifest, validation/reconciliation, repeat-import checksums, quality logs, host performance and Android HBC export. See [workflow/contracts](README.md) for reproduction.

## Verified capabilities

All 278 establishments remain discoverable, including 216 without menus. All 1279 items have precise PHP amounts and source classifications. Search supports names, dishes, tags/categories, buildings, floors, zones, types and inclusive exact-centavo budgets/ranges. Structured retrieval is bounded, read-only and suitable for a later model tool adapter.

Host tests exercise the ten target queries: Uptown Mall restaurants, Din Tai Fung details, Manam menu, food within ₱300, seafood within ₱500, restaurants with coffee, listed hours for a contextual restaurant, Central Square restaurants, desserts, and meat between ₱200–₱400. Estimates and starting prices retain qualifiers; alternate-branch coverage and partial menus stay explicit. Live opening status, dietary/allergen safety and walking navigation are not inferred.

## Actual tests and measurements

- Exact-lock `npm ci --prefix apps/mobile --cache .g/npm-cache`: PASS. Initial offline-cache attempt failed ENOTCACHED; network retry restored dependencies. Existing lockfile audit reports 24 vulnerabilities; no upgrades were introduced in this scope.
- `python apps/mobile/scripts/quality.py --output .g/food-research/final-quality`: **31/31 groups PASS**, covering typecheck, lint, format, dependency audit, Ruff, governance, GIS/topology, canonical/retrieval/projection, startup/storage, UI, directory, routing, packs and AI evaluations. Zero lint errors; two inherited MapCanvas hook warnings remain.
- Unit group **21/21 PASS**; focused food tests **7 Python + 8 JavaScript PASS**. All 120 frozen historical deterministic observations remain byte-identical.
- Complete repeated importer CLI: PASS; directory, manifest and validation hashes all identical. Evidence `.g/food-research/repeat-import.json`.
- Offline Expo Android export/Hermes compilation: PASS. Initial sandbox temp write failed; authorized local retry passed. Final HBC contains all 278 restaurant IDs and 1279 menu IDs; no runtime Python. Evidence `android-bundle-final.log` and `bundle-verification.json`; earlier export is superseded.
- Physical inventory: **0 ADB devices**. Native launch, airplane-mode interaction, restart, screenshots, TalkBack, keyboard/pager and saved-data preservation: **NOT_RUN**. iOS: **NOT_RUN**. Host UI contract checks do not establish native appearance or accessibility acceptance.

Tool versions: Python 3.13.7, Node 22.20.0, npm 11.18.0, TypeScript 6.0.3, existing Expo 57.0.27/RN 0.86.3. Missing test prerequisites were resolved locally using Ruff 0.17.0, Shapely 2.2.0 and pyproj 3.7.2 in ignored tooling. No mobile runtime dependency was added.

Final host microbenchmark: **4,046,150-byte** JSON with raw lineage; service validation/copy/index initialization **17.31 ms**; 100 seafood/₱500 queries, median **3.35 ms**, p95 **4.92 ms**. Node/VM measurements exclude JSON parsing and React Native startup/memory. Native performance remains unmeasured. The successful final local HBC is 2,728,165 bytes, SHA256 `f6b967280f5b2a0a42d3335c9e2f20d13b79fd195268ed0d5016b7c5e0084430`; bundle compilation is not Android execution.

## Parent review and remaining gates

Parent **ACCEPTS bounded host implementation for internal development** after inspecting changes, directly verifying hashes/bundle IDs and rerunning canonical/governance/storage/route regressions. Overall native/product gate is **PARTIAL**. Data rights remain pending; external URLs were retained, not granted publication authority or live verification. Ambiguous identities stay separate. No commit, push, merge, publication, APK install, permission expansion, precise-position upload or inference-runtime selection.

Next milestone: connect an authorized Android phone and validate cold/offline launch, menus/hours, restart, long lists, Back/keyboard/pager, TalkBack and saved-state preservation; measure startup/memory/query latency. Complete rights/geographic identity review before public distribution. Continue the separate physical AI runtime benchmark without adding inference here.
