# Offline AI retrieval audit — 2026-10-11 (Asia/Manila)

Scope: read installed Omni-BGC code and Haki as a reference; consult official SQLite/Expo/sqlite-vec documentation once; implement a narrow lexical and evidence eligibility foundation without a schema migration, candidate promotion, acquisition or publication. Parent review is pending. AI runtime/device selection is owned by the parent and runtime specialist.

Success criteria: existing retrieval interfaces remain compatible; candidate/stale menu claims cannot satisfy approved retrieval; bounded English/Filipino lexical substitutions introduce no product facts; existing deterministic regressions and TypeScript pass. Risks: no approved real corpus exists, local/mobile clocks affect freshness, current Citation does not carry expiry, and three alias searches may scan the full current store. No mobile latency claim is made.

## Installed environment and API evidence

Inspected actual `apps/mobile/node_modules/*/package.json`, not only dependency ranges: Expo 57.0.27, React Native 0.86.3, React 19.2.3, expo-sqlite 57.0.4, TypeScript 6.0.3. `expo-sqlite/vendor/sqlite3/sqlite3.h` declares SQLite 3.50.3; this is source evidence, not a live phone `sqlite_version()` result. Node 22.20.0 and Python 3.13 were used for tests.

Local SQLite source confirms `openDatabaseAsync(name, options, directory)`, `prepareAsync`, `executeAsync(params)`, `getAllAsync`, `finalizeAsync`, `loadExtensionAsync(libPath, entryPoint?)`, and `bundledExtensions`. Existing ownership helper uses a new native connection, serialized access, explicit finalization, and close in `finally`; preserve it. Content is query-only and separated from writable user state.

App config explicitly sets `enableFTS: true`, RTree build flag, and `withSQLiteVecExtension: false`. The [official Expo SQLite documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/) confirms FTS configuration, optional vector extension bundling, and per-connection loading using bundled extension metadata. Build options need a new native binary. Prepared/bound queries protect user input; do not interpolate it into `execAsync`. The official extension API lists Android and iOS, but support alone does not prove this exact build works on either device.

Installed optional Android ARM64 `vec.so` is present with static string `v0.1.7-alpha.2`, SHA256 `0ff1080d5881edaae5a7cb6fded9e368a2a4647f218915a222f04762889394fd`. No extension was loaded or enabled in this task. Obtain live `vec_version()` before selecting it; do not install an unrelated Node sqlite-vec package into React Native. iOS podspec references `vec.xcframework`; that directory is absent in this installed Windows package, so iOS vector packaging remains unverified.

Existing mobile schema uses external-content `search_fts(name)` linked to fact-bound `search_document` with `unicode61` and insert/delete/update triggers. [SQLite FTS5 documentation](https://sqlite.org/fts5.html) requires keeping external content and index consistent, including rebuilding when triggers were created after existing rows. It documents prefix matching and BM25, where smaller scores rank better. Current Omni queries bind a bounded literal MATCH expression, then recheck current supported fields because expired index bytes can remain. Keep that second eligibility gate. BM25 ranking is future measured work, not implemented here.

[Official sqlite-vec KNN documentation](https://alexgarcia.xyz/sqlite-vec/features/knn.html) distinguishes vec0 candidate retrieval from manual scalar distance scans. Its vec0 default is L2; cosine requires an explicit metric. Use `k = ?` for a portable bounded KNN request; LIMIT support depends on SQLite version. Vectors must join to approved evidence-linked records and compatible embedding identities before answering. [JavaScript binding documentation](https://alexgarcia.xyz/sqlite-vec/js.html) concerns Node/Deno/Bun; Expo's own extension loader is the appropriate native seam.

## Corpus eligibility, independently counted

| Artifact | Actual state | Answer eligibility |
| --- | --- | --- |
| `docs/data-source-register/source-register.csv` | 0 data rows, 23-column header | No approved providers in this registry |
| `apps/mobile/assets/generated/directory/places.json` | 161 records; all candidate; 0 menus; 0 approved | Candidate browsing only |
| `data/manifests/ui-directory.json` | ODbL-1.0 attribution; publication_authorized=false; navigation_eligible=false; duplicate rejects=0 | No approval inferred from its checksum/license |
| `data/research/m4/business/inventory.json` | 30 research sources, 60 candidates, approved=0, exported=0, raw acquisition=0 | Discovery pointers only |
| `data/research/m4/geography/coverage.json` | approved/exported/verified entrances/static routes all 0; counts overlap | No verified geographic or route answer inferred |
| `apps/mobile/src/updates/reviewed-catalog.ts` | Both reviewed hash registry and catalogue empty | No remotely approved content pack |
| Ignored M4 SQLite export manifests inspected | Synthetic test-only; example 4 entities/9 facts; publication_authorized=false | Deterministic tests only |

The 161 UI candidates are separate from canonical SQLite and never enter this retrieval API. Do not treat every record rendered on the map as an assistant source. The empty approved corpus means verified menus, live opening times and walkable routes must remain explicit gaps. No synthetic test data were bundled into the product.

## Haki reuse assessment

Reference root: `C:/Users/joshu/Documents/Personal Projects/Haki`. Its package declares Expo 55.0.23, expo-sqlite 55.0.15, React Native 0.83.6, llama.rn 0.12.0-rc.9; those declarations do not prove compatibility with Omni's newer native stack.

Read `src/db/sqliteVec.ts`, retrieval normalizer, FTSRetriever, active vector retriever and hybrid export seam. Useful patterns: connection-specific WeakSet capability caching; explicit extension probe; logical ID/model/dimension mapping separate from rebuildable vector index; bounded lexical candidates; immutable citation retention; deterministic golden cases. Omni already has stronger current-fact and relationship checks, which remain authoritative.

Do not copy Haki's campus stop-word/office rules or silent office-scope relaxation into branch-specific BGC search. Its hybrid rank fusion is documented in code as custom score carryover rather than pure RRF. Its vec0 table declaration omits cosine metric, while final ranking computes normalized cosine; candidate ranking can diverge when stored vectors are not normalized. Model filters occur after global KNN candidate selection, another recall risk. These are audit observations, not reproduced Haki failures. No Haki native modules, seeds, credentials or product data were copied.

## Selected foundation and deferred work

Lexical-first structured reads are justified now. `lexical.ts` normalizes NFKC, lowercases, bounds query input to 2048 UTF-16 units / 8 tokens / 48 units per token, treats FTS-looking operators as literal words, and uses six explicit vocabulary pairs: coffee/kape, tea/tsaa, bread/tinapay, restaurant/restawran, food/pagkain, water/tubig. Place retrieval keeps literal spelling first and tries at most two dictionary projections; it preserves filters and immutable IDs. Menu retrieval evaluates equivalent tokens against names. These substitutions provide basic vocabulary matching, not general Taglish understanding; they do not strip question words, infer cuisines, tags, prices, proximity or routes.

Menu reads now require approved exact item evidence and both relationship citations. Budget and required-tag filters require their own evidence. Unsupported optional prices/tags are removed from a copied result without mutating the store. Allergens have no dedicated evidence contract and are omitted. Current temporal validity remains owned by the existing store SQL, because the public Citation contract lacks validUntil; this helper cannot independently detect an expired formerly approved citation. Complete lineage IDs/hash/locator/method and valid observed/verified chronology are rechecked. No new fact or schema IDs are allocated.

Document extraction and embeddings are not justified by the present approved corpus. Reuse canonical `documents.py` section/span/hash contract only after source-text permission review; preserve Unicode code-point offsets and exact immutable document/citation identity. A future non-mutating retrieval evaluation should use explicitly marked synthetic fixtures for stale/conflicting facts, unknown price, branch ambiguity, multilingual vocabulary, operator injection, empty corpus and prohibited candidate records. Its results cannot establish real-district coverage or mobile performance.

Add vectors only when permissioned document data and lexical miss evidence justify them, with measured recall gains exceeding memory/latency cost. Pin model hash, dimension, normalization and metric together; keep the vector index rebuildable and subordinate to approved current lineage. Native extension and embedding-runtime work remains behind parent architecture/device gates. No phone benchmark was run by this retrieval task.

## Work journal and validation

2026-10-11: inspected installed packages, mobile retrieval/store/parser/contracts, canonical span helper, source register/counts and Haki patterns; consulted official documentation above. WHY: avoid native module copying and data approval leaks. HOW: read-only package/source audit and JSON/CSV counts, plus focused helpers and synthetic regression tests. Rejected alternatives: campus-specific stop words, raw user FTS syntax, inherited parent approval for menu claims, immediate embedding ingestion into an empty approved corpus.

- `node tests/data-quality/mobile/retrieval.mjs`: **11 cases passed**, including exact PHP arithmetic, unknown/non-PHP prices, candidate/stale claim rejection, relationship completeness, unsupported optional-claim removal without mutation, NFKC aliases, query bounds/operators, parser lineage, and bounded place aliases/filter retention/deduplication.
- `python -m unittest discover -s tests/data-quality/retrieval -p test_retrieval.py`: **12 tests passed**, real SQLite over explicitly synthetic fixtures.
- `npm.cmd run typecheck` in `apps/mobile`: **passed**, TypeScript noEmit.
- Initial mobile test invocation used the wrong working directory and failed MODULE_NOT_FOUND; rerun from repo root passed. No assertion failure was hidden.

Changed paths: `apps/mobile/src/data/lexical.ts`, `apps/mobile/src/data/retrieval.ts`, `tests/data-quality/mobile/retrieval.mjs`, this report. Store/domain/schema and data remain unchanged. Parent must independently inspect and ACCEPT before integration. Device latency/memory, native SQLite feature probes, iOS build, approved corpus intake, source-text permissions and vector recall remain unvalidated/deferred; none is represented as success.
