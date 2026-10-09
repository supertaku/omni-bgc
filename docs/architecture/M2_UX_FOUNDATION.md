# M2 UX and brand foundation

Status: independent design DRAFT. Parent ACCEPT required. M2 remains BLOCKED on Figma component system and real formative study. This document neither approves production native UI nor substitutes desktop screenshots for device evidence.

## Scope and identity

The app is an offline navigation utility with restrained playful geography. Accurate licensed geographic layers, approved entrances and graph results must define the map; decoration has no routing authority. M2 supplies original vector brand proposals and a design system using platform fonts, cream canvas, dark ink, white sheets and one blue navigation accent. Park green is a map layer fill, not a status signal. The darker proposed route blue `#1756C0` supersedes only the illustrative color suggestion in this draft; parent must accept the draft decision before application adoption.

No mobile, data contract, permission, source register, schema or canonical ID edits. The UI package contains presentation tokens, pure view rules and an interactive fixture-only HTML review prototype. It contains no GIS, inference, model runtime, chat generator or production database implementation. Version 2 adds a separate fixture session model and controlled flow wiring; manual/landmark choices carry no coordinates, saved fixtures reset on reload, and route starts remain disabled. Browser Back button and focus/Escape behavior are study preparation only, not native responder or OS keyboard evidence.

## Component system for Figma transfer

Authoritative draft values: `packages/ui/tokens.json`. Create Figma variables with the same semantic names, not separate arbitrary colors. System text: caption 14sp, body/control 16sp, title 22sp, display 28sp; 1.4 line height. Native text scales through 200%; no maximum-font-size cap. Fixed minimum touch target 48dp, search at least 56dp, two-tab bar at least 64dp plus OS bottom inset. Height grows to fit scaled text. Corners: control 16dp, sheet 24dp, metadata 8dp. Motion 180ms for sheet changes, zero for reduced motion; no animated ambient map chrome.

Required component variants: SearchLauncher (idle/focused/unavailable), CategoryChip (default/selected/disabled, accessible state), ActionButton (primary/secondary/disabled/focus), TwoTabBar, OriginAction, ContextSheet (closed/peek/expanded/side panel), FreshnessNotice (unknown/stale/approved/no records/error), PlaceHeader (long name, tenant/building/floor), ResultRow (ambiguous identity), EntranceRow (eligible/restricted/unverified), PackStatus, AssistantComingLater, fixture-only future Place/Route/Itinerary card visual specs. Future card implementation belongs to M12 and canonical contract coordination; no domain interfaces are invented here.

Color-pair audit uses the WCAG relative-luminance formula, 4.5:1 for all fixture text and 3:1 for control boundaries/route casing. This is a bounded design check, not a WCAG conformity claim. Sources: [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [200% text resizing](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).

## Flow and screen ownership

Only Map and Assistant persist as primary tabs. Idle has one search launcher, one horizontally scrollable category row, a short pilot-coverage disclosure, one optional-origin action and two tabs. Search opens a focused local list with map/list return and Filters. More opens filters. Saved, Settings, source attribution and Pack/Coverage live in the Map contextual entry, reached through Search/pack details; production should expose a clearly named About/data entry in Search, never a hidden-only gesture.

At 200% text, the idle row keeps All and a visible Filters button; filter category selection occurs in its scrollable sheet. This preserves access while accepting reduced map area. Enlarged text accessibility outranks the standard-text occlusion objective. This exception requires participant and native review; do not silently shrink text.

| Journey | State sequence and rules |
|---|---|
| Find a place | Idle → Search → results or distinct no-matching-records → peek → expanded. Ambiguous results show building/floor; tenant and building identities remain separate. Keyboard dismiss returns focus to search; Back returns to previous map camera/filter state. |
| Categories | Idle chip selection changes approved visible results, selected state spoken; More/Filters replaces any sheet; Clear filters exists in sheet. Exact result counts are shown only from installed records. |
| Details | Peek gives name, floor/category, distance only with confirmed origin, source-status cue, Directions and Save. Expanded gives evidence, verification date, sources, access and entrances. Long names wrap; details scroll; no fabricated open status. |
| Route initiation | Directions → optional device location or manual/landmark choice → confirmation → approved entrance selection → validated route preview → navigation. Never start from unconfirmed pin or building centroid. |
| Permission denial | No first-launch permission dialog. Ask foreground location at use. Denial leaves manual/landmark origin available, Settings secondary; no prompt loop. Timeout/stale fix requires confirmation and an observed age/accuracy when known. |
| Manual origin | Crosshair with Confirm, Undo and Cancel. Sheet owns its touch area; map owns remaining viewport. Confirm creates a deliberate origin; Cancel discards unconfirmed draft. Landmark choice also requires confirmation. |
| Navigation | Replace browse chips, place sheet and competing markers with one instruction banner, highlighted route with casing/shape and one route-actions sheet. Written steps and End route accessible. Map and Assistant are still the two tabs; leaving route first requires a clear route-state decision in native integration. |
| Unsupported route | Distinct outside-coverage, missing graph/entrance, invalid route and no-fix states. Offer change origin/eligible entrance or return. Optional bearing must be separately labeled direction-only; none drawn here. |
| Menus | Unknown evidence, no approved menu records, stale facts and a long scrollable menu differ. Unknown is never converted to no menu, inferred ingredients, availability or prices. |
| Transit | Approved static route/stop/source age only. Stale timetable says not live arrivals; absent feed says no installed records. Stop walking link is available only after graph/entrance validation. |
| Saved/planning | Local saved list and manually ordered stop list; explicit user durations/start time, deterministic leg estimates only when routes validate. No AI-generated itinerary. |
| Pack/data | Pilot/incomplete coverage always visible at idle and search empty state. Pack detail exposes approved coverage polygon, component versions, size, source/validity dates and attribution when available; no fabricated denominator. Missing geometry blocks map; missing menu/transit does not. Corrupt replacement retains last validated pack and retry/rollback. |
| Assistant | Honest “AI Assistant coming later” with Open Map. No input, generated responses or functioning suggestion chips. Typed fixture cards belong only in future development/test previews. |

One overlay owns the screen at a time. `view-state.mjs` demonstrates replacement, cancellation and route preconditions using booleans only; production must validate actual contracts, access and geography. Native route exit confirmation and preservation of active route across tabs remain product integration decisions, not claims of implemented behavior.

## Layout, semantics and accessibility contracts

At rest target 65–75% unobstructed full reference viewport. Measure union of status-safe area, header bounding rectangle, location control and tab bar including bottom safe area; subtract each once. The measurement counts chrome occlusion only, not GIS legibility. No geometry is shipped in the fixture. Expanded sheets reserve a camera inset so selected approved entrance/route fits in remaining map bounds; never pan the selected pin underneath a sheet. Landscape/tablet uses a 340dp side pane in the fixture; eventual native layout must adapt to width and font scaling rather than hard-code this prototype width.

Reading order: search, selected categories, coverage, map accessible summary/selected place, origin action, contextual sheet heading/status/actions, tabs. Selected chips use spoken selected state. Selected pin has distinct shape and a label; route has dark casing, endpoint symbols, written directions and a spoken summary. Decorative brand is not a repeated screen-reader heading. Native TalkBack must supply map alternative and nearest approved accessible target; map geometry itself is not an accessible name.

Sheet scroll never pans map; list/header selection is accessible without drag-only actions. Keyboard resize reduces available content height, page remains scrollable, never displays keyboard behind an expanded sheet. OS Back first dismisses keyboard, then expanded→peek, then selection→idle, then exits; return focus to the initiating control. Test screen-edge gestures, orientation without draft loss, resume with refreshed location age, reachability with one hand and reduced motion. None is proven by browser CSS alone.

## Evidence and unfulfilled gates

See `docs/evaluations/m2/design/HANDOFF.md`, `audit-results.json`, screenshots, research protocol and hashes. Production map alignment, clustering, bright-sunlight readability, multiple Android densities, native 200% scaling, TalkBack and responder/keyboard/lifecycle checks are NOT_RUN. iOS layout/masks are NOT_RUN. Figma export does not exist. Real participant count is zero. No full M2 acceptance is claimed.
