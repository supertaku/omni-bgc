# Omni-BGC

An offline-first BGC explorer built with Expo and React Native, Android first. The current internal pilot covers High Street. Geographic/source correctness and local persistence take priority over coverage claims.

The app provides an offline Map, search/category filters, expandable place details and source disclosures, a continuously mounted Map/Assistant pager, guarded shake switching, and accessible manual Chat/Back controls. The Assistant performs deterministic local directory/menu search and retains draft/conversation in memory. Existing saved places and itinerary can be read and shared. SQLite diagnostics and reviewed content-pack validation/recovery/rollback remain available.

Walking navigation, itinerary planning and native AI generation are unavailable in this version. Routing infrastructure remains behind reviewed-graph gates. Candidate businesses and fictional sample menus are disclosed separately; they are not approved production facts. No approved remote download catalogue is enabled. Conversations do not persist across process restarts.

## Stack and structure

Pinned application stack: Expo 57.0.27, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3, MapLibre RN 11.5.0 and Expo SQLite/FileSystem/Location/Sensors. Python/SQLite validates and projects source-linked data; pure TypeScript implements routing.

- `apps/mobile/src/app`: composition, initialization, navigation and pack UI actions.
- `apps/mobile/src/features`: Explore/details/panels and deterministic Assistant/conversation.
- `apps/mobile/src/domain`: pure shared monetary rules.
- `apps/mobile/src/data`, `updates`, `map`, `routing`, `ui`: native infrastructure and presentation.
- `packages`: shared domain/geo/routing/UI and database contracts.
- `pipelines`: governance, intake, GIS and map packaging.
- `tests`: deterministic data, routing, UI callback, synthetic AI and refactoring regressions.
- `docs`: decisions, architecture, historical evidence and current handoffs.

## Development

Use Node 22 (local validation: 22.20.0), npm and Python 3.13. Install with the lockfile:

```powershell
npm ci --prefix apps/mobile
npm run typecheck --prefix apps/mobile
npm run start --prefix apps/mobile
```

Android builds require the existing SDK/JDK and exact reviewed assets. Generated geographic/directory packs and some source inputs are ignored because distribution needs separate review; a fresh clone is not a distributable dataset. Follow [map-pack instructions](pipelines/map-pack/README.md), source/rights records and `apps/mobile/scripts/build-preview.ps1` prerequisites. Do not substitute online map URLs or unreviewed content. The script verifies resource/font hashes using the existing native toolchain. No new APK or runtime upgrade is part of R1.

## Quality checks

Install pinned host prerequisites in a development environment:

```powershell
python -m pip install Shapely==2.2.0 pyproj==3.7.2
python -m pip install -r packages/database/canonical/requirements-syntax.txt
python -m pip install -r requirements-quality.txt
npm run lint --prefix apps/mobile
npm run format:check --prefix apps/mobile
npm run check:dependencies --prefix apps/mobile
npm run test:unit --prefix apps/mobile
python apps/mobile/scripts/quality.py --output .g/r1/quality
```

The runner reproduces committed CI plus additive R1 gates and saves command logs/results. Formatting explicitly enrolls reviewed source to protect hashed/generated artifacts. Two inherited Map camera dependency warnings require separate native review. See [coding standards](docs/refactoring/R1_CODING_STANDARDS.md).

Resource/source/contrast validation and deterministic replay can use task-local paths without overwriting historical evidence:

```powershell
node apps/mobile/scripts/check-ui-program.cjs --v2.1 --output .g/r1/ui
node tests/ai/deterministic-baseline.cjs .g/r1/ai
```

## Offline and acceptance boundaries

Production styles/tiles/glyphs/sprites use local resources and retain OSM attribution. Never offline-cache OSM Foundation public raster tiles. Location permission is optional; precise position must not be uploaded. Saved user records are separate from replaceable content packs. Source/licensing/expiry/lineage/checksum/trust gates remain fail-closed.

Historical screenshots/device evidence describe specific builds. Current R1 host checks cannot prove Android rendering, physical shake, native storage, TalkBack or iOS installation. Internal resources do not grant publication rights or full BGC coverage. iOS offline installation remains unvalidated.

The [offline AI program](docs/OFFLINE_AI_IMPLEMENTATION_PLAN.md) is separate. Retrieval/synthetic evaluation foundations exist; runtime selection requires a physical Android benchmark. R1 introduces no model runtime, remote inference, simulated streaming or tool loop. See [AI architecture](docs/architecture/AI_LOCAL_ASSISTANT.md), [AI handoff](docs/evaluations/offline-ai/HANDOFF.md), [UX V2.1 handoff](docs/evaluations/ux-v2.1/HANDOFF.md), [R1 report](docs/refactoring/R1_IMPLEMENTATION_REPORT.md) and [decision journal](docs/DECISION_JOURNAL.md). The early [implementation plan](docs/IMPLEMENTATION_PLAN.md) remains historical context.
