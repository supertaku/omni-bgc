# Query-focused assistant details

Implement the owner's requested Pokémon-style detail replies using the existing React Native game-menu frames, local illustrations and fonts. No new dependency or generated factual content is needed.

1. Add a bounded optional detail focus to the existing place payload: overview, location, floor, description or category. Select it from the actual user question in the shared grounded composer. Exact named detail questions should use existing deterministic reads; contextual references keep the verified local-model/tool path.
2. Replace the generic single-place row with a framed detail answer. Show the requested field first, explicit missing-value text when absent, and current guarded detail-opening interaction. Preserve a bounded description in historical display snapshots so old replies do not acquire newly changed descriptions.
3. Reuse the same framed sections for menu descriptions/prices and recorded hours. Hide the retired branch-price notice and source/freshness controls in new and restored chat, while retaining evidence and attribution in storage/details.
4. Add focused regression coverage for query selection, exact field display, missing values, historical codec validation, and hidden boilerplate. Run typecheck/lint and existing agent/history/preview checks. Build with Gradle, inspect the portrait phone layout, and deliver the next numbered verified APK and receipt.

The existing model ownership, source revalidation, strict source gates, map coordinates, offline data, and history records stay authoritative. No raw model narrative supplies local facts.
