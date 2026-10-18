# Omni-BGC

Offline-first BGC map and directory app built with Expo/React Native,
Android first and iOS-compatible. Geographic accuracy, source lineage and
offline operation take priority over coverage claims.

The app includes the offline map, place and recorded-menu search, details,
deterministic Assistant fallback, and local AI/model-management software.
Research candidates and approved content remain separate. Walking navigation
is unavailable. Current model setup, real inference quality and performance
acceptance remain incomplete; host compilation does not establish device
acceptance. Historical saved records remain stored without restoring removed
save/route UI. The recorded menu-relevance defect now has a host-tested correction;
the updated build still requires M10 physical verification.

Current architecture, persistent Ponytail skills and the shared local/CI quality
registry: [engineering quality guide](docs/quality/README.md).

## Where things live

| Directory | Contents |
| --- | --- |
| [`apps/mobile/`](apps/mobile/README.md) | App source, authored native AI module, plugins, runtime assets and pinned dependencies |
| `packages/` | Shared domain, geo, routing, UI and database contracts |
| [`data/`](data/README.md) | Authoritative BGC research inputs, working datasets, reviews, generated packs and local file catalog |
| [`models/`](models/README.md) | One verified host Gemma model; weights stay ignored and separate from research |
| `pipelines/` | Retained research import, validation and pack-generation tools |
| `tests/`, `.github/` | Deterministic app, data and build regression checks |
| `docs/` | Required contracts/approvals, current AI records and authored journals |
| `.g/` | Local build cache/toolchain, one current host release and private cleanup evidence |

There is no populated single database holding all research. Operational SQLite
intake/mobile databases and separate food/office CSV/JSON collections coexist.
PostgreSQL/PostGIS remains a proposed canonical target with pending live
validation. See the [research hub](data/README.md). Packaged app assets are build
copies, not a second authoritative research collection.

## Development and checks

Pinned stack: Expo 57.0.27, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3,
MapLibre RN 11.5.0. Use Node 22 and Python 3.13.

```powershell
# Install only when restoring dependencies; cleanup retains the working set.
npm ci --prefix apps/mobile
npm run typecheck --prefix apps/mobile
npm run lint --prefix apps/mobile
npm run format:check --prefix apps/mobile
npm run check:dependencies --prefix apps/mobile
npm run start --prefix apps/mobile
```

The full host runner uses pinned QA libraries. On this retained Windows setup:

```powershell
$env:PYTHONPATH = "$PWD/.g/r1/python-tools;$PWD/.g/ci-python"
python apps/mobile/scripts/quality.py --output .g/cleanup/quality-new-run
```

For another machine, install `requirements-quality.txt`, Shapely 2.2.0,
pyproj 3.7.2 and the canonical database syntax requirements. A Git local-clone
test and Gradle's local daemon require ordinary host process access; sandbox
failures are recorded separately from actual test failures.

Android builds require the existing SDK/JDK and exact reviewed ignored assets.
Use `scripts/build-offline-ai-host.py` with a fresh `ai-host-*` stage for host-only
release compilation and verification. See [map-pack setup](pipelines/map-pack/README.md)
and the [current AI handoff](docs/evaluations/offline-ai/COMPLETION_HANDOFF_2026-10-16.md).
A fresh public clone does not contain private research packs or model weights.

## Cleanup and records

`python scripts/cleanup.py` generates a dry-run deletion manifest from the
existing `.g/cleanup/before.jsonl.gz` inventory. `scripts/cleanup.ps1` defaults
to dry-run; `-Apply` validates the allowlist and retained-file checksums before
deleting its listed targets. This is a reviewed inventory workflow, not a
blanket command for deleting `.g`. Use a new inventory directory for a future
cleanup rather than reusing an old baseline.

`python scripts/cleanup.py --catalog` refreshes the local research file index.
The [cleanup journal](docs/journals/CLEANUP_2026-10-19.md) records actual outcomes
and inventory locations. The [decision journal](docs/DECISION_JOURNAL.md) and
existing work journals remain retained; deleted historical attachments are
identified by the cleanup inventory rather than claimed to remain available.

## Offline and acceptance boundaries

Keep production styles, tiles, glyphs and sprites local, retain OSM attribution,
and never cache OSM Foundation public raster tiles for offline use. Location
permission is optional; precise position must not be uploaded. Source rights,
IDs, coordinates, checksums, review status and deterministic fallback remain
unchanged. Research retention does not authorize publication. No remote
inference, automatic model activation or new phone/USB/ADB activity is part of
cleanup. iOS offline installation and real-model acceptance remain unvalidated.
