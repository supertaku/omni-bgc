# Approved experience implementation — 2026-10-10

Reference: user-supplied `omni-bgc-approved-ui-reference.png`; geometry and sample business claims in the reference are visual direction only.

Plan: UX-0 inventory and native compatibility; UX-1 shared tokens, offline fonts/icons; UX-2/3 private PMTiles and original geographic styling; UX-4 map shell, search/details/saved/settings; UX-5 typed Assistant conversation and local directory handoff; UX-6 source-derived isolated presentation records; UX-7 standalone APK; UX-8 focused regression, visual review, accessibility and evidence.

Success: working native implementation, preserved GIS/routing/database contracts, local font/sprite/tile assets, ordinary product presentation without demo labels (explicit user override), functional Map/Assistant transitions and installable APK. Risks: native asset byte-range bug, no connected Android device, no eligible walking entrances, visual density/text scaling. Never infer native rendering/performance passes from host tests or a successful build.

Ownership: parent App/features/explore/fonts/config/docs/integration; map engineer map and map-pack pipeline; design engineer shared UI/tokens/brand; Assistant engineer features/assistant. Parent independently reviews and tests reports before integration. No main merge, dataset publishing or AI runtime.

Historical OSM records keep candidate metadata and exact lineage behind source disclosure. The user's display request does not turn them into reviewed facts. Empty menus/hours/entrances remain absent. Stable presentation UUIDs use a documented separate namespace; no existing ID/schema edits. Production pack publication gates remain intact.
