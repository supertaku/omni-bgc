# M2 UI design foundation

Independent draft; no native application integration. `tokens.json` is the proposed portable value source. `view-state.mjs` demonstrates exclusive overlay and confirmed-origin rules without inventing domain schemas. Run `node --test test/*.test.mjs` from this directory.

Open `preview/index.html` in a browser. Query parameters: `?state=idle&scale=1`; scale 2 exercises 200% CSS text. See the renderer state list for all layouts. Version 2 operates fixture search, category filtering, same-name choice, details, origin drafting/confirmation, entrance inspection, unavailable-route handling, session saving, manual itinerary ordering/user durations and Assistant return. Back restores the prior view/control; Escape first blurs a focused input, then goes Back. It does not exercise a real native keyboard. Query matching uses whole fixture words, not production FTS.

`fixture-flow.js` is a presentation session model, never a canonical schema. Saved fixtures and durations remain in page memory and reset on reload; no browser storage or location data is retained. Device-location controls open a simulated outcome screen and never request permission. Manual targets/landmarks have no coordinates. Route start is always disabled; checking any candidate returns Route unavailable. No approved geographic data, time estimates, route or source facts exist.

The background is a grid placeholder, not a BGC basemap. Every result is synthetic and labeled. No network assets, packages, geographic coordinates, actual businesses/menu prices or AI responses. Full native font scaling, keyboard/map gestures and screen-reader behavior are NOT_RUN.

Screenshot audit: run `node docs/evaluations/m2/design/render-and-audit.cjs` and `node docs/evaluations/m2/design/test-interactive.cjs` from repository root with bundled Playwright. Override `PLAYWRIGHT_MODULE` and `M2_BROWSER_PATH` for another machine. Both intercept a virtual `.local` host and fulfill bytes from disk; no web server is required. Pass flags cover explicit mechanical/fixture checks only and do not mark M2 accepted.
