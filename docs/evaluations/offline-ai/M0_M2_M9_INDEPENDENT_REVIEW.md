# Independent M0 / M2 / M9 host review — 2026-10-16

Scope: source rights and host-first gates, model/runtime composition, host build receipts and bounded orchestration replay. This review does not grant parent acceptance or physical acceptance. No ADB, USB inventory, installation, device setting or physical inference was performed.

## Evidence independently checked

- Current `AGENTS.md`, DEC-056 superseding language, offline AI implementation plan and host-first execution document agree on M0–M9 host work followed by owner-authorized M10. Historical device-first evidence remains identifiable as historical.
- `node apps/mobile/scripts/ai-host-assets.cjs` passed `PASS_INTERNAL_HOST_ONLY`. It executes the unchanged reviewed asset-copy plugin, validates pilot inventory/style/resource hashes and GEX approval/scope/resource bindings. Food directory: 4,046,150 bytes, SHA256 `9ea29509af7e5ec6713ff1626886c8ca972ce2db96ee6d59f1e25530a206b938`; office research: 147,515 bytes, SHA256 `32bf627e623eec763b95fabd054dd3c607fd3fd750e0d54fdea744834e650111`. Full receipt is `.g/ai-layer/assets-check/receipt.json`.
- Independently compared `docs/geography/internal-pack-approval.json` to HEAD: semantic content identical, both 699 bytes; current SHA256 `4a094b15e17cfbbe403b83916d9a83ace6051cc6e3740c74a36edebc50e5794b`. It remains internal preview only, public distribution/navigation unauthorized, source facts candidate/historical, device validation false. No source rights were upgraded by this work.
- Pinned app manifest identifiers remain unchanged; the local config plugin selects `com.omnibgc.aipreview` only under explicit host preview environment. Package delta adds an explicit already-pinned `expo-modules-core` dependency; reviewed Expo/RN versions remain unchanged.
- Source scan across AI TS and native Kotlin found network calls only in explicit `modelStorage.ts` setup. Its download path uses pinned HTTPS URL and pre-hop origin validation, user initiation/license acknowledgment and exact artifact verification. Runtime generation, tools and history have no authored network operation. This is source evidence, not proof of all third-party binary behavior. APK INTERNET permission is inherited and must match the accepted permission baseline; M10 airplane-mode testing is still required.

## Integrated model lifecycle

Added `tests/ai/assistant-runtime-integration.test.cjs`. It loads the actual Assistant runtime factory, model manager, native provider and shared resource coordinator, with controlled native/file/SQL boundaries. Six tests pass: explicit setup → staged state → real smoke adapter flow → 4096-token native-ready load → lease-protected uninstall → close; picker import without online setup/activation; canceled activation without ACTIVE commit; native release despite independent history-close failure; actual hook + runtime preserving import during expected system-picker background; and normal cancellation restored for post-picker file copy. This catches mismatched composition contracts that isolated fake manager/provider tests cannot. It does not execute LiteRT or read a real model file.

Added `tests/ai/history-v2-review.test.cjs`, using real SQLite: v1 rows survive v2 migration; canonical references are separately stored and cascade on Clear; partial messages/raw card snapshots/citation data are excluded; UUID references are bounded and deduplicated. Historical references remain lookup hints and do not grant current source approval or mutation authority.

`node --test tests/ai/assistant-runtime-integration.test.cjs tests/ai/history-v2-review.test.cjs tests/ai/orchestrator-contract-replay.test.cjs tests/ai/model*.test.cjs`: **42 passed, 0 failed** (33 model tests, six runtime integration tests, two history-v2 checks, one 120-input replay test). Separate independent run of persistence, Assistant-hook and runtime-integration suites: **19 passed, 0 failed** at that review point.

## Honest replay of the historic 120 question inputs

Added `orchestrator-contract-replay.cjs` and its test. The adapter projects away all `expected` fields. Its controlled provider emits a fixed read proposal independent of query/language/expected answer, followed by unsupported prose that the actual composer must discard. A separate fixed prohibited network proposal must be denied for every input. Valid UUID-based, explicitly synthetic CC0 fixtures contain approved/candidate/stale records; actual retrieval must return only approved evidence. Existing history and untrusted-context inputs pass through their bounded interfaces. No old `syn-*` identifiers are silently promoted into canonical IDs.

Actual host components exercised: `AgentOrchestrator`, unified retrieval, tool decoder/allowlist, executor and grounded composer. **120 controlled read turns completed and 120 prohibited proposals were denied.** Input denominators are English 48, Filipino 36, Taglish 36. These counts are **not** semantic/model accuracy, language-quality, factuality or efficacy scores. Semantic accuracy is explicitly null; model quality gate `NOT_EVALUATED`; native inference `NOT_RUN`. This report is separate from the historic 28/120 deterministic baseline and must never replace or be compared to it as an LLM result.

Commands: `node --test tests/ai/orchestrator-contract-replay.test.cjs`; `node tests/ai/orchestrator-contract-replay.cjs --output .g/ai-layer/orchestrator-contract-replay.json`. Replay output binds suite and adapter SHA256 and retains one result row per input.

## Build receipt review

Initial review requested binding the actual build workflow to frozen sources; installed dependency identity; generated native/Gradle-init and Expo registration evidence; native module presence in minified DEX; snapshot ZIP hash; and exact accepted permission comparison. Native owner added these checks. Further review requested rejecting missing workflow hashes and comparing pre/post dependency identities. Final source/APK receipt review must use the final fresh stage, not the explicitly intermediate R1 build.

Added `tests/ai/test_host_build_receipt.py`: **six tests passed** for known streamed SHA256, source drift, build-workflow drift, lock/manifest identity, dependency version/integrity drift and missing required packages. Command: `python -m unittest discover -s tests/ai -p test_host_build_receipt.py -v`. Tests never invoke Gradle, Android tools or ADB.

## Limits and parent gate

Existing authorized generated artifacts were verified; this is not by itself a raw CSV/XLSX-to-clean-checkout reproduction. Final handoff must include private restore/import/map build recipes and distinguish unavailable source inputs from verified existing outputs. Dependency metadata identity is not independent byte-for-byte revalidation of every installed npm/Maven artifact; preserve npm-ci/build provenance and exact lock/dependency graph receipts.

M2 focused contracts and new integration/replay checks pass. M9 remains pending the final fresh-stage Android release compilation, source/APK hash and ZIP/DEX/autolinking/manifest/signature/source-map checks, full regression results and parent signoff. No actual model install, cold process restart, storage pressure, memory/thermal behavior, GPU support, map coexistence or generated-language quality has been established on the POCO. All physical evidence remains M10.
