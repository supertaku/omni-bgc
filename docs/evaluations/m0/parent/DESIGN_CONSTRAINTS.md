# M0 design constraints — 2026-10-09

Status: initial parent heuristic audit only. No production UI, Figma system, participant study, TalkBack run or physical-device screenshot is approved by this document. Those belong to later authorized milestones.

## Evidence reviewed

Parent read `docs/UX_MAP_SPEC.md`, implementation blueprint section 6 and inspected the original concept UI board and adaptive foreground PNG through the image viewer. Asset hashes are in `initial-files.json`; no artwork changed or adopted into the app.

The concept board shows four persistent navigation items (Map, Chat, Saved, More), a column of three floating map controls and apparently functioning conversational suggestions. Those conflict with the accepted two-tab Map/Assistant shell and one-location-control contract. It also shows fictional place details, menu prices, review counts, open status and an illustrative route. Treat these only as mood artwork, never verified data or actual interactions. The “All of BGC”/“Everything in BGC” language requires a defensible coverage denominator before any product use. The processed adaptive foreground has visible light fringes around the silhouette at this inspection scale; mask/export requires a later design review.

## Constraints retained for later design

- Use the actual geographic layers, entrance points and graph; playful decoration cannot define walkability or district boundaries.
- Keep Map and Assistant as the only main tabs; Assistant production state honestly says it is coming later.
- One row of category chips, one location action, one contextual sheet. Route mode suppresses competing discovery overlays.
- Measure the 65–75% unobstructed map objective on each reference display. Reserve safe areas and camera insets for selected pins and routes; this percentage is a design objective, not measured evidence here.
- Controls need at least 48 dp touch regions. Verify TalkBack state/reading order, 200% text, high contrast and route distinction beyond hue on actual native screens.
- Optional foreground location at use; manual origin remains available after denial. No account blocker or precise-location upload.
- Unknown, stale, absent, inaccessible and unavailable must have distinct honest states; no fake menus, transit times, route availability or AI answers.
- Keyboard, sheet/map gesture ownership, OS back, orientation and resume need native testing; screenshot appearance alone does not prove them.
- Concept logo/icon remains provisional; trademark, vector re-export, edge mask, adaptive safe region and small-size legibility are unresolved.

## M0 spike UI review limits

The feasibility screen can show diagnostic native map and SQLite results. It must label synthetic fixtures and avoid implying real BGC navigation. Its screenshot, if obtained, proves only the observed spike state. It cannot approve production UX, offline tile/glyph/sprite completeness or accessibility that was not exercised.
