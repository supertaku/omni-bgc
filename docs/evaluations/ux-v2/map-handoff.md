# UX V2 map and original artwork handoff

2026-10-10, Asia/Manila. Parent review required. **UX-V2-3/4: PARTIAL**;
implemented native code and resources pass host checks; device visual/performance
acceptance remains pending.

## Changes and geographic evidence

- `MapCanvas.tsx`: compositing Android TextureView for the parent’s sliding shell;
  visible, legible © OpenStreetMap contributors button with a 44dp hit target;
  optional `onAttributionPress`, default installed native attribution dialog;
  optional `onStatusChange('preparing'|'ready'|'failed', detail)`. Ready requires the
  native fully-rendered event. Callback references avoid loops with inline props.
- `building_metadata.py`, `build.py`, generated style: source height first, valid
  integer levels estimated at 3m per level next, explicit family fallback last.
  Historical source height and floor counts remain separate from estimated display
  dimensions; none are written to factual database columns. Bounds, IDs and source
  geometry are preserved. No ID-based random heights remain.
- Ten original families: glass office, residential, commercial, midrise office,
  mall, lowrise retail, hotel, civic, mixed use, unknown. Source-tagged use controls
  classification; color and window motifs remain illustrative. Native patterned
  extrusions and thin same-footprint roof caps replace plain blocks. Outline/part
  overlap handling retains exact flat footprints. There is one mapped part inside
  this pilot, so this is not a claim of detailed city-wide podium reconstruction.
- Overview z14–16 uses footprints/shaded massing; z16+ adds patterned facades, roof
  caps/source trees; z18+ adds source-tagged zebra treatments. Active navigation
  suppresses extrusions and decoration. Existing routes and approval gates remain.
- `building-evidence.json`: 40 in-scope building/part records, 17 historical height
  tags, 4 level estimates, 19 illustrative defaults. Example source values:
  Arthaland Century Pacific Tower 114.7m, West Gallery Place 150.8m, W Global
  Center 30.5m, Central Square 25.9m. These are **unverified retained OSM values**.
  The PSE feature records 15.6m and 3 levels; it is not evidence for an entire PSE
  tower complex. No taller model is invented to fit the reference picture.
- Six bounded landmark entries now include source/raw hashes, height basis,
  interior anchors, native asset mapping, explicit unknowns and no navigation
  authority. Zero duplicate IDs; zero target rejections outside scope.
- 29 offline atlas entries, including ten new facade motifs. Sixteen standalone
  asset samples and checksums live in `apps/mobile/assets/map-v2`; editable source
  is `build.py:sprites`. Original internal project artwork;
  `LicenseRef-Omni-BGC-Internal`. Geometry is separately ODbL; distribution remains
  unauthorized. No photographs, franchise art, public raster tiles or new app
  rendering dependencies.

## Feasibility decision and verified APIs

**A, native extrusion:** implemented prototype using actual packaged features,
data-driven height/base/pattern, roof caps and LOD. The [official layer
spec](https://maplibre.org/maplibre-style-spec/layers/) reports native support for
data-driven extrusion patterns from Android6.5/iOS4.4; installed RN11.5 targets
Android13.6.1. Patterns use supported 64px dimensions. The raw map style avoids the
RN dynamic property serializer; existing dynamic Layer bridge tests still pass.

**B, selective hybrid:** bounded georeferenced landmarks resolve native sprite
families and source footprints. This is a working native sprite/extrusion asset
prototype, not imported GLTF architecture. Installed RN11.5 exposes Images,
ImageSource, Layer and annotations but no public GL-JS custom-layer renderer.
Screen annotations and flat georeferenced images cannot produce faithful pitched
3D roofs/façades. A custom GLJS camera/render loop is therefore not integrated.
TextureView supports screen composition; memory/FPS tradeoff is pending device
measurement. The [RN docs](https://maplibre.org/maplibre-react-native/) and exact
installed `Map.tsx` confirm texture selection and `showAttribution()`.

**C, dedicated engine/bridge:** deferred; no supported project dependency or
measured native benefit justifies a second renderer. No engine migration.
All three approaches' device FPS, draw-call/memory and recognizability benchmarks
are **NOT_RUN**, not inferred from a host style validator.

[OSM height](https://wiki.openstreetmap.org/wiki/Height) defines meters by default
and feet/inches syntax; [building levels](https://wiki.openstreetmap.org/wiki/Key:building:levels)
documents integer floors and a3m render assumption. Parser rejects ambiguous,
negative, non-finite and implausibly large values. [OSMF attribution guidance](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
allows legible corner attribution and access to origin/licence. Parent connects
the visible button to Data/Licenses; fallback preserves native source dialog.

## Actual validation and frozen resources

- PASS `python pipelines/map-pack/check-building-metadata.py`: units, invalid
  source values, source/display separation, floor estimates and base bounds.
- PASS `python pipelines/map-pack/check-building-pack.py`: every tile decoded;
  27 tiles, 548 source IDs, 40 buildings/parts, 6 sourced zebra crossing ways.
  All IDs and height fields match retained inputs; candidate gate remains.
- PASS `node pipelines/map-pack/check.mjs`: installed style validator, 29 density
  matched sprites, ten families/sample checksums, bounded registry, installed
  TextureView/attribution contract, all runtime text glyphs, resource hashes and
  atomic private-file install/reuse/corruption/interruption recovery.
- PASS `node --test tests/map/mobile/layer-compatibility.test.cjs` (2 tests).
- PASS `npm run typecheck` in `apps/mobile` after parent integration correction.
- Repeated build: identical pack hash
  `6356b38277d10333dfb866a8cc0bd1520f65e8d1dce0f8abdd2eb3c09488a25e`;
  style `c0de5bd381bd5e5a4e6f398f79a01549aba6570c40abe33a9d9d8123606edd45`;
  499642 resource bytes. Exact file hashes in generated report/inventory.
- Retained geometry SHA256
  `4e78b1ec5b94d0480c12c42bf42b9e8ef7de02c6372dac1aa97522ebe410c456`;
  raw snapshot `c7c77bdee83947293624a3a6036089e809c2fb2c1cec4d5283fb1c89535a8ac3`.
  Runtime directory input must remain frozen or builder must rerun for glyphs.
- Atlas inspected at2x. Source parser/build use Python3.13.7 and exact pinned
  requirements restored into `.g/map-v2-python`; Node22.20.0. Existing Shapely
  transform deprecation warning remains; it does not fail generation.

No phone screenshots, cold airplane-mode loading, TextureView transition,
TalkBack/large-text, FPS, memory or iOS execution was performed by this worker.
Parent owns APK/native verification. Unknown facade likeness, narrow coverage,
source freshness and absent native benchmarks prevent full milestone acceptance.
