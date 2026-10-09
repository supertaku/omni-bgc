# Parent journal and decision proposals

Date: 2026-10-09. Author: M2 design lane. Parent disposition: PENDING. These are draft references `M2-UX-01..03`, not allocated DEC IDs; parent must allocate final IDs in the append-only shared journal. No shared journal edited.

## M2-UX-01: accessible route accent

Propose route/button blue `#1756C0` on white, retaining ink/canvas/park direction. WHY: white primary-action text needs at least 4.5:1 and the provisional bright blue was illustrative. HOW: semantic token source, actual computed text-color checks and luminance pair audit. Reject using blue alone to indicate path: retain dark casing, endpoint shape and written/spoken directions. Source palette is a proposal; native map/bright-sunlight proof deferred.

## M2-UX-02: large-text discovery row

Propose All + Filters at 200% rather than removing category access or shrinking OS text. WHY: parent's early review caught lost direct-filter access. HOW: visible 48px+ targets at 200%, scrollable filter sheet; measure reduced map area honestly. Reject preserving full dense category taxonomy at enlarged text or silently cap text scale. Standard map objective holds in tested reference layouts; enlarged text is a documented exception requiring user/native validation.

## M2-UX-03: fixed place actions at large text

Propose separate Directions/Save footer with full place-name/details scroll above. WHY: first 200% screenshot hid all actions behind a long heading; parent CHANGES_REQUESTED. HOW: flex sheet reserves a fixed footer and independently scrollable labeled/focusable text region, no line clamp; initial/end-scroll screenshots and overlap check. Reject truncating accessible full name or relying on drag alone. Native focus/scroll/gesture proof deferred.

## Daily work draft

- Inputs: repository AGENTS, M2/UX plan, UX_MAP_SPEC, M0 parent DESIGN_CONSTRAINTS, DEC-007/008/009/017/019/021/025/026/027.
- Changed paths: packages/ui; assets/branding/m2; docs/architecture/M2_UX_FOUNDATION.md; docs/evaluations/m2/design. No mobile/domain/schema/shared journal/commit.
- Created four original SVG proposals, semantic accessibility tokens, one-overlay/confirmed-origin pure rules, static phone layouts and reproducible browser audit. No copied assets, business/source/geography invention, raster image generation or AI installation.
- Tooling: bundled Node/Playwright plus installed Chrome; exact versions in audit-results.json. W3C primary accessibility references in architecture document. design-taste skill read but explicitly excluded native mobile; its website rules were not applied.
- Failures: bundled Playwright browser missing; localhost screenshot attempt denied by sandbox; file and intercepted attempts did not execute the fixture due to global `top` collision, renamed to `headerChrome`. Final renderer uses in-memory request interception of local bytes. No automatic-review rejection or dependency install.
- Parent early review: full large-text filter access preserved; fixed action footer resolves hidden Directions/Save issue. Parent must independently re-review screenshots and tests.
- Final visual inspection found grid compression of Expand details in the scroller; switched to nonshrinking flex text children and added explicit control-content-overflow audit. Rerun 37/37 PASS, 43 screenshots; Assistant Open Map button returns to idle. The full name remains available by scrolling, no line clamp.
- Actual checks and outputs: HANDOFF and audit-results.json. Four meaningful presentation-rule tests; computed contrast/touch/overflow/sheet/footer/no-external-request checks. No claim of device screenshots, TalkBack, Figma, participants, geographic alignments or full M2 acceptance.
- Gate: Figma and real-user study BLOCKED on external access/participants/prototype wiring; native/device proofs NOT_RUN. Never mark these PASS from tokens, mockups or automated preference.

## v2 daily work continuation

- Parent accepted only bounded v1 visual corrections and authorized fixture operability preparation. Preserved initial 67-file manifest/report/log/handoff in history/v1 before edits.
- Added fixture session flow model and browser wiring, controlled search/category/results/details/origin cancellation/confirmation/entrance rejection/route-unavailable/saved/manual-itinerary/Assistant return. No real geography, generated itinerary, precise position, permission request, canonical schema or source fact.
- Initial browser journey exposed false substring match for Fixture B; whole-word fixture matching and a deterministic regression fixed it. Same-screen Back history duplicates and duplicate Back controls also removed.
- Final actual evidence: eight model tests PASS, five browser journeys PASS, 46 layout cases PASS; zero external requests/browser errors. Browser Escape/focus tested; native keyboard/TalkBack/OS behavior not tested. Human participants still zero; Figma files zero. Current reports and regenerated hashes replace current draft evidence; historical v1 and initial v2 failure preserved.
- Full M2 remains BLOCKED, parent review pending. Next native lane must retain original game-inspired 2.5D visuals over real licensed source-approved geometry; no mobile edits authorized in this assignment.
