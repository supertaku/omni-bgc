# Native UI implementation plan

2026-10-09. Assigned ownership: apps/mobile/App.tsx, apps/mobile/src/ui, docs/evaluations/mobile-ui only. Parent owns contracts/map and device build; other lanes own data/routing.

Build polished accessible Map/Assistant chrome with one sheet, explicit approved-only search/details/menus/sources/transit, optional foreground location at use, confirmed manual/landmark origin, route availability, local saved/manual itinerary and history deletion. No fixture records in production. Compose the original accurate 2.5D MapCanvas from parent, never a fake basemap. Finish focused typecheck/interface checks; report actual blockers and pending parent device/accessibility validation.

Success: no runtime model/chat, external location upload, schema/permissions/map edits or canonical fixtures; minimum 48dp controls with text scaling and scrollable full names/persistent actions; honest empty/stale data and unavailable graph. Risks: dependent interfaces arriving concurrently, native font/keyboard/back behavior requires parent device validation; static fixtures/M2 browser proofs do not certify this native UI.
