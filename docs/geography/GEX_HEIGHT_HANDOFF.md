# Building-height zoom correction — 2026-10-15

The user explicitly selected **full 3D heights at every zoom**, removing flattening, rather than fixed screen-pixel height. The reviewed style faded overview massing from zero at z15 to full `visual_height` at z16 and hid it below z15. This made buildings collapse while zooming out.

`apps/mobile/src/map/presentation.ts` now renders the existing `buildings-2.5D` body at full source-derived `visual_height`/`visual_base` from z14. Its existing upper boundary remains16, where the unchanged facade and roof layers take over at full height. Explicit Flat and quiet modes retain their 2D behavior. No source geometry, height fact, tile, UUID, pack manifest, sprite, glyph or reviewed JSON bytes changed. Normal map perspective/geographic scaling still applies.

Stable authored file SHA256: `0627afb575ca045a411109a26809f043af036eeb4b99e559d01f1fe358208ace`.

Validation: two actual-reviewed-style tests exercise eight zooms across overview/facade transition and Flat/quiet behavior; three existing domain-map regressions PASS. Pinned MapLibre style-spec validates 3D/Flat/quiet styles with zero errors. TypeScript and Prettier PASS. An initial implementation made the old Flat-only hiding branch run in 3D; existing and new tests caught this immediately, and it was corrected before any new APK build.

Independent reviewer ACCEPT: two focused tests and all eight pilot/expanded presentation combinations pass; all14 resource and frozen geometry/pack hashes remain unchanged. See `GEX_HEIGHT_INDEPENDENT_REVIEW.md`. Parent ACCEPT applies to host presentation behavior only, pending exact native artifact/evidence.

The original GEX APK SHA256 `c1229809c1897c5c2b5b8958e5c2bf53695b55baaba173c5d23d6fd771534c3d` is immutable and **does not contain this correction**. Offices owns the next device slot and its controlled current build will include these exact presentation bytes alongside the scope callback and rights-expiry fixes. The parent requested actual native zoom14/15/16/18 and Flat-mode evidence plus the bundled source-map hash. Current build/native acceptance remains pending; do not infer success from host validation.

The stable combined current APK has now passed independent parent byte/source inspection: `.g/of-r1/Omni-BGC-Offices-preview-arm64.apk`, 44,428,239bytes, SHA256 `67582a18b95b5929c83146b0886633bb412e62609935d2d859630f7945f632e5`, package `com.omnibgc.officespreview`. Actual ZIP CRC/Hermes and all24 native resources pass. Fifteen composed-map source entries match staging, with only the explicit internal research-view gate differing from main; the presentation source matches the exact accepted SHA. See `current-height-apk-review.json`. Native installation/zoom evidence is still pending from the coordinated device owner. Intermediate APK5023 is not the final artifact.
