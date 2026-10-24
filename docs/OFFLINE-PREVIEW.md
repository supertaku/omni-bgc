# Offline preview content

The bundled preview contains 609 canonical place identities, including all retained directory and office research records, and menus for 335 restaurants and cafés. Every restaurant has at least eight items. The 3,518 menu items retain all 1,279 original items and add 2,239 internally generated items. Nine explicit same-branch crosswalks join related sources without deleting their identifiers.

Location coverage is 161 unchanged recorded points plus 335 building/site anchors. The remaining 113 places open their details without moving the camera. An anchor represents a retained address relationship and a source polygon; it does not establish a pedestrian entrance or current office occupancy.

- [Generated coverage](../assets/generated/preview/COVERAGE.md)
- [Individual unresolved exceptions](../assets/generated/preview/exceptions.json)
- [Identity and building mappings](../config/preview/crosswalk.json)
- [Research receipts and refreshed fields](../config/preview/research.json)
- [Image prompts, roles, dimensions and checksums](../assets/generated/preview-media/manifest.json)

## Rebuilding and replacing content

Run `node scripts/build-preview.cjs` from the repository root. The builder reads retained data, explicit mappings, pinned OSM source geometry and enrichment inputs. It performs no network requests and never rewrites the original datasets or installed SQLite packs. Identical inputs produce identical output; the report records the input fingerprint.

Keep researched additions in `config/preview/research.json` and identity corrections in `config/preview/crosswalk.json`. The overlay records each field's classification, sources, source dates, basis and replacement key; individual menu items have their own evidence. Generated menu names and IDs are deterministic. Preserve existing IDs and evidence when replacing provisional entries with reviewed source data.

`config/preview/settings.json` explicitly enables `internalPreviewContent`. Missing or non-true values disable preview behavior. Preview estimates can appear in display, sorting and budget filtering; strict source queries still exclude research, and approved retrieval, entrance, itinerary and persistence gates are unchanged.

The 24 generated images total 1,923,012 bytes. They are shared illustrative category covers, dish-family photographs and original generic marks, not official logos or factual venue photographs. Literal static asset references bundle them for offline use. Full-resolution outputs are outside the application bundle; generation receipts retain their original paths.

## Acceptance limits

The following checks passed on the completed implementation:

- `node scripts/check-preview.cjs`: two deterministic rebuilds, source/identity/menu integrity, source dates, coordinate provenance and image-family matching.
- `node scripts/check-preview-presentation.cjs` and `node scripts/check-preview-ai.cjs`: preview versus strict prices, canonical menu opening, office retrieval, unlocated details, source fingerprints and bounded model tool flow.
- `node scripts/check-food-presentation.cjs`, `node scripts/check-discovery.cjs`, `node scripts/check-map-results.cjs`, and `node scripts/check-regressions.cjs`: existing source gates and fallback behavior, current-source resolution, delayed-opening navigation races and controlled native lifecycle fixtures.
- `npm run typecheck` and `npm run lint`.
- Android Expo export with Hermes bytecode: 998 modules, a 5.4 MB bundle and all 24 WebP assets. Image checksums, prompts and export inclusion were verified independently.

The export is in ignored `artifacts/offline-preview-export/`. Its command is `node ./node_modules/expo/bin/cli export --platform android --output-dir artifacts/offline-preview-export --max-workers 2`. This Windows sandbox required process-local `TEMP` and `TMP` pointing at `artifacts/preview-export-tmp/`; the default sandbox temporary directory rejected the Hermes output write. `EXPO_OFFLINE=1` kept the export offline.

These host checks do not establish device acceptance, native model quality or installed-pack compatibility. This implementation did not build an APK or perform any physical phone, USB or ADB operation.

Imported source-rights and current-presence issues remain in metadata. Ambiguous identities remain separate, inaccessible sources are listed, and no publication approval has been fabricated. Final Android interaction and native inference checks remain manual.
