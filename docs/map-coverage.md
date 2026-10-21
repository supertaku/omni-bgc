# Offline map coverage

The original expanded and pilot PMTiles packs remain byte-identical. An additive, display-only context archive covers longitude **121.035–121.070**, latitude **14.530–14.575**. It does not enlarge approved directory or navigation scope.

## Source and geometry

The context uses sixteen retained OpenStreetMap extracts from 2026-10-20 plus six source-complete relation supplements retrieved on 2026-10-21 for the river, riverside park and one building. `assets/generated/context/source-inventory.json` independently pins every input's bytes and SHA-256; generation refuses changed inputs. The provenance receipt records source versions/tags, rejected geometries, source geometry, derived geometry and output hashes. Original source support is retained in the compressed audit artifact.

The current output contains **45,197 building features, 5,750 road/path features, 92 green polygons, 24 water polygons and one hospital anchor**. It is rendered from an **8,714,956-byte** tiled archive at zooms 14–18, overzoomed through 20. Geometry is clipped at the stated outer extent and reconciled against actual detailed polygon coverage. Matching historical building identities stay owned by the detailed pack; their uncovered extent outside its display envelope can remain context. Roads keep their original source vertices outside the detailed display envelope. Invalid/incomplete geometry and sub-square-metre display remnants are recorded rather than fabricated.

Tagged heights remain unverified OSM observations. Levels use a 3 m estimate; missing heights use a clearly illustrative 6 m volume. Source lineage and height basis are retained. No procedural buildings, business records, navigation edges, or raster-tile caches are generated.

The building reference for Thinking Machines uses retained OSM way `222123034`, Twenty-four Seven McKinley at 24th Street and 7th Avenue. Its interior representative point is `[121.04793834926411,14.5471164]`; it is not an office entrance. The owner correction and [CTCN member profile](https://www.ctc-n.org/networking-and-collaboration/collaboration/network-members/thinking-machines-data-science-inc) support the recorded building association, while current occupancy, floor and suite remain unverified. The broad office research dataset remains gated.

St. Luke's label retains OSM node `7597467285` at `[121.0482529,14.554675]`. Geographic anchors must not be moved merely because perspective changes their projected appearance.

## Rebuild and limits

Install build-only `scripts/map-requirements.txt`, then run `python scripts/build-map-context.py`. Build dependencies are not mobile dependencies. `node scripts/check-map.cjs` and `python scripts/check-context.py` validate resource receipts and geometry. Keep OSM attribution and ODbL notices. Existing internal-preview/distribution restrictions still apply.

Coverage depends on source mapping; genuine source gaps remain possible. Host checks do not establish phone frame pacing, GPU cost, memory use, or visual acceptance. The owner should pan and zoom through the supplied screenshot views in airplane mode and check landmarks, neighborhood continuity, clusters and selected markers.
