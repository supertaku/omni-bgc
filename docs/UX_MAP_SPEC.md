# Omni-BGC — Low-Friction Map and Assistant UI Specification

Status: **Design direction**, not final UI signoff. Distinctive playful geography, restrained application chrome. Objective: user finds a place and gets a route with minimum steps and no information overload.

## 1. Information architecture

Primary two-tab nav: `Map | Assistant`. Map contains Search, Category/Filters, Place details, Location selection, Navigation overlay, Routes/Transit, Saved/Manual itinerary entry, Settings/About/Data. Assistant tab contains readable UI preview and future type-safe card components; **no AI responses** in production.

## 2. At-rest map layout (portrait)

```text
+--------------------------------------+
| system status / safe area            |
| [ 🔎 Search places or dishes      ]  |
| [ All ] [ Eat ] [ Coffee ] [ Work ] >|
|                                      |
|           STYLIZED MAP               |
|    real buildings, streets, parks    |
|   low marker density / clustering    |
|                                      |
|                           [ locate ] |
|                                      |
|--------------------------------------|
| [ Map ]              [ Assistant ]   |
+--------------------------------------+
```

At rest no permanent legend, massive card carousel, floating assistant bubble, mini-map, weather panel, or always-on data dashboard. Design goal at least ~65–75% visually readable map. Bottom-nav dimensions depend on OS safe areas and tap targets. The search field opens a focused results view; it is not a text input constantly grabbing focus from map drags.

## 3. Progressive disclosure

- **Idle**: search, 1-row chips, map, 1 location control, 2 tabs.
- **Filter selected**: show applied count and visible map results; More opens a filter sheet; single “clear filters” in sheet.
- **Search focused**: keyboard, local suggestions/history optional, category hints; list/map toggle with predictable return; no unrelated map gestures.
- **Place selected**: peek sheet (name, category, actual distance when origin known, first verified menu/status cue, Directions, Save); expand for comprehensive facts/verification. Tapping empty map collapses selection.
- **Navigation active**: quiet basemap, route polyline and origin/destination, compact next action and distance. Hide browse chips and competing markers. Restore map discover state on exit.
- **Manual origin**: center target crosshair + confirm, undo/cancel; route never starts from unconfirmed pin.
- **Empty/error**: no search results, unknown menu, stale business, missing map pack, denied GPS, route unavailable all get distinct honest messages and next actions.

## 4. Place sheet states

`CLOSED -> PEEK -> EXPANDED` and `PEEK -> NAVIGATING`; sheet gestures never unintentionally pan the map. Selected place remains highlighted on map, and camera insets reserve enough room for the sheet so pin/route is not obscured. Show opening hours as verified schedule data, not “open now” unless evaluated against a current zone-aware timestamp and stored exceptions. Show source freshness in expanded details.

## 5. Visual hierarchy and design tokens

Proposed look: matte warm neutral background, modern rounded search and sheet surfaces, one blue route accent, category colors used sparingly, parks evergreen, buildings light neutral with edges. Typography uses OS accessibility scaling. Map labels: large district/road landmarks first, then selected places, then clustered categories. Avoid text on every building at minimum zoom.

Logo concept assets are in `assets/` and are illustrative. The final vector logo must be redrawn/reviewed by the designer for scaling, adaptive icon masks, unique identity and platform requirements. Image-generated UI board includes **fictional businesses** and must not be treated as geographic ground truth.

## 6. Touch, accessibility and device adaptability

Interactive hit regions at least 48dp; route line visually distinct without reliance on hue alone; large-screen side pane; Text scaling 200% test; TalkBack reading order; accessible chip state labels, distinct selected pin/route description. Bottom search focus and sheet gestures tested with keyboard, OS back button, screen edge gestures. No map drag loss due to RN responder conflicts.

## 7. Research sessions / usability measures

Five formative participants with different familiarity with BGC. Tasks: find a restaurant with food evidence; select a mall tenant on a floor; show nearest restroom; manually choose current position; route from a random side-street to a building entrance; check bus stop/service age; save a short visit sequence; switch Map->Assistant preview. Record wrong-tap count, completion without moderator, time-to-route, label comprehension, and occlusion. Iterate until top confusion causes are removed; do not tune just from internal agent preferences.

## 8. Acceptance visual checklist

- No default screen with more than one overlay sheet.
- No intrusive alert on first launch unless essential for map pack failure.
- At least one intuitive route initiation path directly from place details.
- Standard zoom/drag gestures and device orientation behavior.
- Pins, building footprints, and route geometry align at multiple zooms.
- Marker clustering adapts with zoom and chosen category.
- Origin accuracy or manual-selection confidence clear to user.
- Place data quality/freshness disclosed without overwhelming primary action.
- Usable offline, in bright sunlight/high contrast, with larger text and TalkBack.
- No assistant chat presented as functional until AI is added.
