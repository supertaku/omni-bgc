# M2 independent design handoff

2026-10-09. Disposition requested: parent independent review. Design lane status: completed independent DRAFT, **not ACCEPTED**. Full M2 status: **BLOCKED** on actual Figma component system and initial real user study. Zero participants, zero Figma files/URLs. Do not advance M6/M12 prerequisites as passed from these artifacts.

## Patch and scope

- `packages/ui/**`: proposed semantic token JSON, strict two-tab/one-overlay/confirmed-origin presentation rules, four deterministic tests, local static phone-layout artifact. No framework/native package install or mobile integration.
- `assets/branding/m2/**`: original compass-pin/open-compass SVG icon variants; horizontal/stacked original vector wordmarks; review board and asset notes. No borrowed Pokémon material, externally sourced media or raster-generated art. Project-created draft assets; external distribution license/trademark signoff not assigned by this lane.
- `docs/architecture/M2_UX_FOUNDATION.md`: component transfer specification, state flows, native accessibility/gesture contracts, coverage and evidence rules.
- `docs/evaluations/m2/design/**`: plan, research protocol/external prerequisites, parent journal/decision drafts, renderer, reports, logs, screenshots and SHA-256 manifest.

Only assigned paths changed. No mobile/domain/schema/permissions/shared journal edit, commit, dataset publication or merge.

## Actual deterministic results

Node v24.19.0; Playwright 1.62.1; installed Chrome 154.0.8037.98. Local browser request interception fulfills files from disk; no external requests observed. Bundled browser was missing, initial localhost attempt failed `ERR_NETWORK_ACCESS_DENIED`; file/intercepted attempts exposed reserved browser global `top`, corrected to `headerChrome`. No dependency installation or approval-review rejection.

- View rules: 4/4 PASS. Overlay replacement; denied-location-compatible manual origin; draft-origin route rejection; unapproved-entrance rejection; valid route hides discovery; Back exits route; cancel discards draft; unknown tabs rejected; starting origin selection removes active route chrome. These booleans are presentation preconditions, not proof of actual graph validation.
- Layout audit: 37 cases PASS for minimum 48×48 CSS-pixel buttons/inputs, no control vertical-content overflow, no document horizontal overflow, at most one sheet, computed text contrast ≥4.5:1, no text-scroll/footer overlap, no script errors and no external requests. Six 200% cases on 360×800; 28 standard state layouts on 390×844; smaller phone idle and 800×600 idle/side-pane selected place. 43 screenshots total, including initial/scrolled large-text regions and brand board. Chrome CSS pixel scale is an approximation, not native dp/device density validation.
- Token contrast: all 10 intended pairs PASS at specified 4.5:1 text / 3:1 boundary thresholds. Actual ratios are retained unrounded in `audit-results.json`.
- Actual Map→Assistant→Open Map preview navigation PASS; coming-later heading present, no input/textarea. Other visual action affordances remain inert by design. They cannot be used for timed end-to-end usability claims.

| Idle reference | Text scale | Unobstructed full viewport | 65–75% objective |
|---|---|---|---|
| 390×844 | 100% | 68.38% | Met in static chrome measure |
| 360×800 | 100% | 66.58% | Met in static chrome measure |
| 800×600 | 100% | 67.93% | Met in static chrome measure |
| 360×800 | 200% | 58.95% | **Not met**; readable text and visible All/Filters retained |

Metric: pixel-center union of header bounding rectangle, status safe area, location button and tab bar including bottom safe area, divided by full viewport. Conservative header rectangle includes gaps; union avoids double counting. Background annotation is fixture markup, not actual geographic geometry. These numbers measure chrome space only. They do not prove native map readability/alignment. Enlarged-text exception is proposed for parent/research review, never silently asserted as 65% PASS.

Parent early CHANGES_REQUESTED found missing filter access at large text and hidden primary actions behind huge long names. Revised 200% idle keeps visible All/Filters; selected place keeps full name/details in a labeled focusable scroll region and reserves Directions/Save footer above nav. No line clamp. Parent must re-view initial + scrolled artifacts and independently run checks; no automatic acceptance.

## Evidence to inspect

- `screenshots/idle-390x844-100.png`, `idle-360x800-200.png`, `idle-800x600-100.png`
- `screenshots/long-name-360x800-200.png` and `long-name-360x800-200-scrolled.png`
- `screenshots/assistant-390x844-100.png`, `assistant-360x800-200.png`
- `screenshots/branding-original-variants.png`
- Remaining state screenshots: search/empty, filters, ambiguous tenant, entrance eligibility, place expanded, menu empty/stale/long, stale business, permission/denial, manual/stale origin, route preview/unavailable/outside/navigation diagram, transit/stale/empty, saved/manual itinerary, pack/missing/corrupt.
- `audit-results.json`, `layout-audit.log`, `view-rule-tests.log`, `evidence-manifest.json`.

Reproduce from repository root:

```powershell
& 'C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' --test packages/ui/test/*.test.mjs
& 'C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' docs/evaluations/m2/design/render-and-audit.cjs
& 'C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' docs/evaluations/m2/design/hash-evidence.cjs
```

## External gates and limits

**Figma BLOCKED:** zero callable Figma tools in this session; no editable authorized file. Need actual component/variable/auto-layout system, interactive prototype and versioned review URL. Transfer checklist in architecture/research docs. HTML/SVG/tokens are handoff inputs, not a substitute.

**Initial user study BLOCKED:** no consenting real participants or moderator/session access; fixture visual controls are mostly inert. Need five varied participants, operable prototype, observed critical-task metrics, recorded confusion, iterations and independent follow-up. Protocol prepared; no results fabricated.

**Native NOT_RUN:** Android device screenshots/densities, OS 200% scaling, TalkBack, keyboard/responder/Back/edge gestures, one-handed use, bright sunlight, rotation/resume and iOS. Native route-tab preservation/exit decision remains an integration item. Brand mask previews are CSS shapes only; no adaptive foreground/background/monochrome release exports or iOS export checks. Original identity remains provisional pending comprehension, small-size and trademark review.

**GIS/offline NOT_RUN:** no real map geometry, markers/cluster data, packs, route path or business facts. Pure diagram is labeled nongeographic; real layers/entrances/topology/offline style assets belong to later gates. OSM attribution must be visible with actual source-backed production geometry; this fixture has no OSM-derived data to attribute.

Parent should allocate final decision IDs from `DRAFT_DECISIONS_AND_JOURNAL.md`, update shared journal after independent review, and record ACCEPT/CHANGES_REQUESTED/REJECT explicitly. Independent artifact acceptance can be bounded to the draft; full M2 must remain BLOCKED until missing deliverables exist.
