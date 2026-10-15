# GEX-4 expanded offline pack handoff

Date: 2026-10-15 (Asia/Manila). Parent review required before integration.

The isolated builder in `pipelines/map-pack/expansion.py` accepts an exact geography
artifact manifest hash, exact versioned scope hash, and a new direct `gex-*` output
directory under `data/generated/map-pack`. It writes no pilot, installed app,
shared builder, source schema or device files. `build.py` is deliberately never
imported or executed because its glyph cleanup and asset copy mutate the pilot.

Candidate inputs must include `render-ways.geojson`, `context-points.geojson` and
`scope-and-buffer.geojson`; every inventoried file is verified against its SHA256
and byte count. Scope-and-buffer must contain `service_candidate`, `limited_context`
and `detail_exclusion`. The service geometry must equal the manifest polygon;
detail must be inside service minus exclusions; context is restricted to major
road classes inside the independently generated context boundary. Source-derived
features preserve canonical `source_ref`, clipped `feature_id`, OSM type/id,
historical source hash/status, render-only and no-navigation properties in MVT.
Derived numeric MVT IDs include the feature namespace and detect collisions.
Accepted engineering scope status is derived only after validating the exact
parent review SHA256, ACCEPT decision and canonical scope geometry hash. That
scope approval does not promote historical source records, entrances, rights or
physical-device results. The frozen pack status is
`CANDIDATE_PACK_ACCEPTED_ENGINEERING_SCOPE`, with source facts still
`CANDIDATE_HISTORICAL` and activation/distribution disabled.

The single archive `gex.pmtiles` uses the existing pinned MVT/PMTiles stack and
z14–18 pyramid for the first **host benchmark**. This LOD choice is provisional;
the wider-area visual and physical-device gate remains pending. Archive service
bounds derive from the polygon. The tile extent also includes validated major-road
context. Each source-intersecting expected tile is encoded, decoded and inventoried;
the full written archive is independently traversed, decoded and compared against
the expected inventory and random-access directory lookups. Low-zoom quantization
collapses are reported per tile; source gaps are not claimed to be complete coverage.
Source geometry is never buffered or repaired. Geographic clipping is verified
with a bounded numerical membership tolerance in UTM (at most 1e-6 m² outside
polygon masks or 1e-5 m outside line masks). Quantization uses the pinned encoder's
integer even-odd fill union only on invalid tile-grid polygons. That operation is
audited by source ID, zoom, area and fragment fraction, capped at one tile-grid
cell of area change, and cannot expand the quantized support.

Style and original project sprites are copied read-only from the verified existing
starter inventory. The style resource URLs use the isolated `asset://gex` namespace.
All current styles/layer ordering and building height/part evidence remain intact.
Glyphs are freshly generated only in the candidate output, with the pinned Noto
font/license hashes, all 256 glyphs in each required range, and calibrated signed
native baseline metrics. Existing runtime directory names are included in font QA.
The manifest inventories every generated dependency, `scopeId`,
`scopeManifestSha256`, `styleSha256`, `glyphRanges`, `fontStacks`, pinned packages,
builder/helper hashes, starter identity and source lineage. It stays inactive,
research-only, and unauthorized for distribution.

Seven source-derived landmark labels are available from z14: Bonifacio High Street,
Market! Market!, Mitsukoshi BGC, Shangri-La at the Fort, SM Aura, St. Luke's Medical
Center Global City and Uptown Mall. Each named anchor group has one label record,
placed at a representative point inside its retained polygon; broad named sites
provide label placement without creating building footprints or entrance facts.
The unnamed SM Aura office part stays unlabeled. MapLibre collision and padding
are enabled, with road labels remaining at z17; actual visible collision outcomes
require visual QA. Existing building footprints remain visible and massing starts
at z15, covering the proposed district camera zoom 15.2.

## Host validation

- `pipelines/map-pack/.venv/Scripts/python.exe -m unittest discover -s tests/map/expansion -v`: **18 tests pass**. They cover source/clipped ID round-trips, duplicate IDs, detail outside scope, exclusion precedence, context class/boundary rules, rights/navigation rejection, inventory path/hash tampering, immutable output isolation, deterministic tile bytes, full PMTiles traversal/lookup, missing-tile rejection, accepted scope hash/geometry tampering, source-derived label placement without invented names/entrances, and narrow-neck tile quantization without source repair.
- `node --check pipelines/map-pack/check-expansion.mjs`: pass.
- `node pipelines/map-pack/check-expansion.mjs data/generated/map-pack/gex-candidate-r4`: **PASS**, installed MapLibre style spec, 14 inventoried dependency files, 44 sprites, two complete glyph ranges (`0-255`, `8192-8447`), calibrated signed glyph metrics, offline URLs, district label/building visibility contract, no remaining invalid tile geometry omissions.
- Exact rebuild in `gex-candidate-r4-rebuild`: **all 15 files, including manifest, are byte-identical** to r4.

## Frozen r4 candidate

Input geography: `data/generated/m4/comprehensive/geography/gex-geography-r2`;
source manifest SHA256 `02cf39d563b4de9abc5bde7661f065fa68e9ca7327445db5dd867eb321d4f298`.
Scope manifest SHA256 `f6cbcc7b33ad4a53821858dc4c3c56e13f30997aad082fcb9fb189eddc5f9db9`.

Output: `data/generated/map-pack/gex-candidate-r4`.
Manifest SHA256 `a132ab8faa0d64c510122d9c963f1e4fedb5c3d4a711a8ced29476a879b795ad`.
PMTiles SHA256 `9203eb4852fa02e88362e7d3063669581cf7dad2668b4e19dc2914a7aff6478c`.

The archive is **869,711 bytes**, with **149 tiles**: z14=2, z15=6, z16=12,
z17=32, z18=97. All 2,684 renderable source records and seven derived landmark
labels appear somewhere in the archive; each of the seven labels is represented
at every encoded zoom. All tile payloads were decoded and every retained geometry
was valid. Total candidate size is **1,741,768 bytes across 15 files**, including
the manifest. Host generation took **3.658 s**; the independent process rebuild
took **3.614 s**. These are host measurements, not mobile timing, FPS or RAM claims.

The bridge/pedestrian polygon `osm:way:846377986` is now retained after four
integer fill normalizations at z14/15/16/18, each with **zero area change**.
There are no invalid-geometry omissions and no z18 collapses. Nine zero-support
quantization collapse instances remain at z14–17. Seven are polygon residues:
`538341461` and `340231594` have only **0.003518 m²** and **0.003671 m²** of
retained service-clipped display geometry, respectively; a `340231777` tile
fragment has **0.000273 m²**. Values use Web Mercator display coordinates and are
not surveyed ground area. The Parkwest Tower source tags attached to `538341461`
do not mean that a whole tower was dropped: the source-complete footprint remains
research geometry, while the revised service scope retains only that tiny residue.
Two other collapses are a z14 private footway (`846184114`) and a z16 footway
crossing (`745722752`). Exact IDs, zooms, fragment fractions and dimensions are in
`tile-audit.json`. Physical/native appearance and seam behavior still require QA.

The independent geographic reviewer subsequently decoded r4 and confirmed all
**14 mandatory physical anchor identities at every z14–18**, all seven label
points inside service at every zoom, the bridge polygon at every zoom, all 149
payloads valid, and the exact manifest/archive hashes. That review accepted internal
preview packaging with visual/device/rights gates retained. Parent integration
acceptance remains required under the repository protocol.

An initial test using the sandbox's default temporary directory failed with a
filesystem permission error. The test now uses a temporary `gex-unit-*` directory
under the allowed generated map-pack workspace. No runtime dependency was upgraded.
The pinned Shapely/MVT stack reports its existing transform deprecation warning;
it does not affect the passing deterministic host tests.

The first actual r1 build was rejected before any output write because the parent
adopted the reviewed r2 scope after the geography r1 manifest froze. The explicit
scope hash gate caught that mismatch. Generation must use the rebuilt r2 geography
candidate bound to the revised scope, rather than overriding source lineage.
The first r2 attempt produced an immutable failed archive because raw integer
quantization made the pedestrian bridge ring self-intersect. R3 recorded display
omissions. R4 supersedes it with the bounded, audited integer fill normalization
and accurate accepted scope metadata. An initial r4 attempt failed before output
write on a zero-area Parkwest residue; it was handled as an explicitly recorded
tile-grid collapse, preserving the original geographic source bytes.

## Gates still requiring parent acceptance

The perimeter has parent acceptance for bounded internal engineering; current-world
record/entrance identity and public rights acceptance remain independent of this
candidate. Visual landmark/tile-boundary evidence, native style
appearance, pan/zoom behavior, actual device startup/FPS/memory and physical offline
operation are not established by host tests. No USB debugging, app test, emulator,
device probe or source download has been performed by this task. The user's
explicit USB permission is required before later device work.
