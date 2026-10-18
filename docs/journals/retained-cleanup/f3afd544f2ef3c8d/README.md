# Omni-BGC UX V2 — Visual reference pack

Use these images as visual targets and regression evidence, **not** as implementation-ready GIS, business data, building meshes, UI layouts, maps, or licensed photos.

## Target references
- `references/tabless-swipe-concept.png`: latest target. No bottom tab bar. Minimal map UI, assistant opens from a deliberate leftward gesture and returns via rightward gesture; map must still pan normally.
- `references/modern-bgc-map-concept.png`: architectural density, height variation, towers, differentiated landmarks, streets and environmental details.
- `references/compact-ui-concept.png`: compact map search/chips and streamlined cards. **Ignore its old bottom navigation** in favor of the approved tabless V2 direction.
- `references/navigation-flow-concept.png`: destination -> origin -> route preview -> walking; never imply a working or safe route when graph/entrances are unverified. **Ignore any bottom bars depicted**.
- `references/previous-approved-board.png`: earlier design language reference, superseded in navigation/chrome.

## Ground truth
- `before/` contains 8 actual screenshots of the Android preview supplied by the user. Use them as baseline for layout, clutter, map extrusion and error-banner regression.

## Required constraints
- Keep verified geography and building footprints, building height evidence and uncertainty; do not reproduce imaginary buildings from images.
- MapLibre Native baseline should render and pan safely while gesture navigation occurs only on an intentional edge/handle gesture; explicit assistant entry and back affordances required for accessibility and discoverability.
- Synthetic menu/merchant metadata can support isolated DEMO scenarios but must be disclosed as examples. Never fabricate real directions, entrances, allergens or real merchant facts.
- Asset deliverables must be reproducible vector/texture source and native atlas or resource files, tested on Android; these concept PNGs are not drop-in product assets.
