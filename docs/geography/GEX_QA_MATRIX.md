# Geographic expansion actual QA — 2026-10-15

| Current gate | Outcome |
|---|---|
| Revised scope and exterior exclusions | ACCEPT bounded internal engineering, `parent-review-r2.json`; entire pilot and 14 physical source anchors covered. |
| Screenshot ambiguity | RESOLVED by user's instruction to use written requirements; no screenshot test claimed. |
| Scope adversarial tests | 13 PASS. |
| Historical GIS tests and independent verifier | 20 PASS; 10,019 complete and 4,900 render features; exact reconstruction and deterministic rederivation PASS. |
| Geographic exporter | 21 PASS; actual reviewed expanded input absent, zero approved records in generated projection. |
| Offline pack | 18 PASS; 149 payloads decoded, all 14 physical anchors each zoom, zero invalid geometry or z18 collapses. |
| Mobile GEX tests | 21 PASS: six scope, three loader, five installer, three entity parser and four SQLite/store scenarios. |
| Integrity/routing/startup regressions | 43 PASS; expanded walking-core activation remains denied. |
| Pure mobile contracts | 22 PASS. |
| Recorded host suite | 158 cases PASS plus serialized GIS/resource checks and TypeScript no-emit; `validation-2026-10-15/results.json`. |
| Independent membership parity | 10,048 points checked against Shapely; zero mismatches. |
| Bundled resources/native-copy contracts | PASS: exact frozen GEX copies and retained pilot hashes; mocked native copy, no device operation. |
| Parent integration decision | ACCEPT scoped host engineering/internal preview; independent `review-r3.json` and exact `internal-pack-approval.json`. |
| Concurrent Offices composition | Parent rerun PASS: 21 GEX, 44 pack/routing/startup, 22 pure contracts and TypeScript; eight interface fingerprints unchanged during checks. Receipt: `validation-2026-10-15/shared-composition/results.json`. Synthetic office fixture includes required claim lineage/expiry; this is not actual directory approval or a new APK acceptance. |
| Android build | PASS: separate ARM64 release APK; embedded Hermes/source snapshot, signature/package/permissions/ZIP CRC, 24 pilot/GEX resource hashes exact. See `GEX_ANDROID_BUILD_HANDOFF.md`; no device success inferred. |
| Physical app/USB/device performance | PARTIAL after direct user approval: 11 PASS, 6 PARTIAL, 2 BLOCKED, 16 NOT_RUN. Offline render/pan/focus/restarts captured; 3 warm-resource process-cold map-ready samples 1096.6–1278.9ms. No pilot comparison/full FPS budget. `device-qa.json`. |
| User full-height correction | Host PASS: two actual-style zoom-transition cases, three domain-map regressions, TypeScript and pinned style-spec. Current controlled Android build/native check pending; older frozen APK retains fade. |
| Current-world facts/public distribution | NOT_APPROVED; internal historical research only. |

The original r1 results below are preserved for audit and superseded where the current table records an accepted revision. No device screenshot, physical FPS, current-world completeness or public-source permission is inferred from host tests.

## Historical GEX-0 revision 1 QA

| Gate | Outcome |
|---|---|
| Local/remote baseline | PASS: fetched origin/main equals specified `0b889c39220ff04679e1150f2cddadf64d59fe26`. Shared checkout already dirty; unrelated changes preserved. |
| Exact historical raw, sidecar, query, prior-boundary lineage | PASS builder and independent reviewer rehash, before raw parse. |
| 8 anchors / 21 original source geometries | PASS geometric coverage and independent exact reconstruction, versions/timestamps/names/hash checks. Identity acceptance PARTIAL. |
| Topology and coordinates | PASS: Polygon/MultiPolygon explicit ring validation, no repair, EPSG:4326 regional/axis/range checks, EPSG:32651 metric buffers. |
| Pilot continuity | PASS: entire v1 polygon covered; service is connected Polygon. |
| Zones | PASS: six project zones; per-source intersections retained; overlay residue `2.1685234589792165e-18 degree²`, tolerance `1e-15 degree²`. |
| CRS round trip | PASS observed Hausdorff deviation `1.5888218580782548e-14 degrees`; no transformed source-coordinate edits. |
| Duplicate source IDs / coordinate conflicts/errors | 0 / 0 / 0 in exact historical source indexing. No silently merged duplicates. |
| Serialized verifier | PASS: scope/design/search/bbox, pilot hash, partition/overlap, inclusive boundary, context exclusions, 8/21 completeness, exact footprint hash, inactive/zero-route policy. |
| New adversarial host tests | 13/13 PASS, independently rerun. |
| Existing raw-discovery regression | 12/12 PASS. |
| Pilot resource preservation | PASS: all 20 resource copies (10 in generated pack, 10 bundled) independently match frozen sizes/SHA256. |
| Deterministic evidence | PASS: canonical UTF-8/LF r3 bytes; identical builder rerun preserves source evidence, differing evidence refuses overwrite. |
| Visual comparison | PASS diagram inspected; second diagram revision corrects zone paint order and missing north-arrow glyph. Not native/map performance evidence. |
| Perimeter/residential intent review | PENDING specialist/human geographic review; complement policy cannot prove external-neighborhood classification. |
| SM Aura office identity | UNRESOLVED unnamed building-part spatial association; distinct from mall. |
| Referenced screenshot comparison | NOT_RUN: screenshot absent from supplied attachment. |
| Current-world/source redistribution | NOT_APPROVED; historical internal research only. |
| Android/USB testing | NOT_RUN, deferred. Ask user before any USB debugging operation. |
| GEX-0 parent gate | PARTIAL; **not ACCEPTED**, no GEX-1 integration. |

Host commands actually executed from repository root, using `C:/Users/joshu/Documents/BGC/.venv/Scripts/python.exe -I -B`:

```text
pipelines/gis/expansion/build_scope.py
pipelines/gis/expansion/verify_scope.py
tests/data-quality/gex/test_scope.py
tests/data-quality/research-gis/test_inventory.py
```

Rendering uses the documented bundled Python (`C:/Users/joshu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe -I -B pipelines/gis/expansion/render_boundary.py`), reading the already projected internal payload. No Python packages installed. Tool versions: GIS Python 3.13.7, Shapely 2.1.2, pyproj 3.7.2, PROJ 9.5.1; rendering versions recorded in `validation-summary.json`.

Failures/corrections: original authored west edge missed One Bonifacio High Street footprint and was expanded explicitly before artifact generation; existing pilot area helper does not classify building-only parts, so the separate GEX adapter validates closed original part rings; floating-point zone union had a negligible angular residue and now records an explicit angular overlay tolerance; independent review exposed Windows CRLF canonical-evidence mismatch, corrected with byte-defined LF writing and preserved earlier r1/r2 outputs; GIS runtime has no Pillow, bundled rendering runtime no Shapely, and attempted shared binary import failed, so geometry projection and rendering use separate existing runtimes. No failed attempt was reported as success.
