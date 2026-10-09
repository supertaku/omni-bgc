# Omni-BGC — Repository-wide instructions for development agents

Project: offline-first BGC map and navigation mobile app, Android-first and iOS-compatible.
Current phase: **pre-AI**. DO NOT implement or install on-device LLM inference, RAG, embeddings, vector search, AI planning or agent orchestration inside the app. The Assistant UI shell is in scope.

## Engineering invariants

- Real geographic coordinates, route graph topology, source lineage and offline behavior outrank visual novelty.
- Do not invent business/menu/transit data. Distinguish approved records from placeholders, candidates and stale facts.
- Follow OSM data/attribution rules. Do not download/offline-cache OpenStreetMap Foundation public raster tiles. Do not scrape third-party menus/photos where permissions prohibit it.
- Keep location permissions optional; support manual origin. Do not upload precise user position.
- User map experience must stay uncluttered, accessible and usable with AI disabled.
- Production map style/tiles/glyphs/sprites must all operate offline.
- No silent schema/ID edits. Do not merge to main, publish datasets or change permissions without parent review/user authorization.

## Working method

1. Read only docs relevant to the assignment: `docs/IMPLEMENTATION_PLAN.md` for milestone scope, `docs/DECISION_JOURNAL.md` when changing product/architecture, source register for data, UI specs for UI, route contracts for graph work. Avoid dumping the full repository into context for small edits.
2. Work in assigned paths/branch. Coordinate before editing shared domain or schema files.
3. Make a short task plan with success criteria and risks; run the minimum needed deterministic tests, plus regression tests for touched interfaces.
4. For data, produce per-source checksums, license metadata, counts, rejected duplicates and sample QA. For UI, provide screenshots/video and accessibility checks. For routing, provide topology tests and adversarial scenarios.
5. Add daily work journal and new decision IDs when material decisions are taken; record tool versions, WHY, HOW, rejected alternatives and validation evidence.
6. Report actual outcomes, not inferred success. Record failures and deferrals plainly.
7. Hand off changed paths, patch summary, tests, evidence and blockers to the **parent reviewer**. Parent must explicitly ACCEPT before integration.

## Parent review protocol

Parent acts as Staff Mobile/GIS/Frontend/Data Engineer and QA lead. For every milestone: check contracts and licenses; inspect diff and evidence; run independent tests; challenge unsupported claims; verify UX/device screenshots; update journal; ACCEPT/CHANGES_REQUESTED/REJECT. Escalate sensitive geographic/route correctness or copyright questions to specialist/human review. Do not automatically approve a subagent report.

## Model routing (configuration guidance, not executable config)

Parent `gpt-6.1-sol` Medium for dispatch, High for gates. Independent architectural reviewer `gpt-6-astra` Low as needed. GIS/routing `gpt-6.1-sol` High. Map/mobile `gpt-6.1-sol` Medium. UI design `gpt-6.1-sol` High. ETL/frontend/transit `gpt-5.6-terra` Medium. Routine QA/journal `gpt-6-luna` Low. Confirm account/harness support before per-agent model overrides; use separate sessions if unavailable.
