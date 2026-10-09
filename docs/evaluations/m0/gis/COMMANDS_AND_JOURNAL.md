# 2026-10-09 / M0 / GIS reuse auditor / Sol High

Parent review: PENDING. Baseline decisions referenced: DEC-011 (licensed data), DEC-012 (reuse after audit), DEC-015 (GIS tools provisional), DEC-016 (entrance graph), DEC-024 (parent signoff), DEC-026 (pilot), DEC-027 (privacy). No new product/architecture choice or source approval was taken; parent owns any new shared decision ID and daily-journal integration.

Objective: audit accessible previous geospatial project and installed GIS/Python tools, writing only this directory. Success/risk contract: `TASK_PLAN.md`. WHY: feasibility should be established from actual metadata and deterministic counts before reuse. HOW: read bounded geodata/config/license/code; compute checksums and structural QA without executing legacy pipelines. Rejected alternatives: copying old raw data, regenerating the 3D pipeline, installing full GIS stacks, or trusting a viewer route/visual geometry. Those would exceed M0 or hide permission/topology defects.

## Commands and actual results

Executed in PowerShell; filesystem commands were read only except creation/editing of this audit directory. Standard Python: `C:\Users\joshu\AppData\Local\Programs\Python\Python313\python.exe`, version 3.13.7. Previous venv Python: `C:\Users\joshu\Documents\BGC\.venv\Scripts\python.exe`, version 3.13.7 (Windows AMD64).

Shell/tool probes: PowerShell 7.6.5; ripgrep 15.2.0 with PCRE2 10.48. `Get-FileHash`-equivalent SHA256 is computed with Python hashlib. No new packages were installed.

| Command / probe | Actual result |
| --- | --- |
| `Get-ChildItem -LiteralPath 'C:\Users\joshu\Documents\BGC' -Force` | Prior folder accessible; data/docs/scripts/3D/web/venv present |
| Initial `rg --files` metadata discovery with dependency exclusions | Output exceeded budget (1,704 metadata paths); no file content bulk-read. Narrowed subsequent discovery to relevant subdirectories/extensions |
| `Get-Content` current AGENTS/README/parent prompt; relevant implementation-plan sections; decision journal | M0 scope, licensing, CRS and graph invariants read |
| `Get-Content` prior AGENTS/README, DATA_SOURCES, COORDINATE_SYSTEM, relevant DATA_ARCHITECTURE sections, raw sidecars and working boundaries | Prior purpose is 3D diagnostic massing; local CRS and estimated scope established |
| `Get-Command python,python3,py,ogrinfo,gdalinfo,osmium,qgis,tippecanoe -ErrorAction SilentlyContinue` | python/py resolved; remaining named commands absent on PATH |
| `py -0p` | Printed `No installed Pythons found!` despite working explicit Python 3.13.7; launcher inventory unreliable here |
| Program Files / Local Programs directory-name probe for QGIS/GDAL/Python | Local Python directory observed; no matching QGIS/GDAL folder found in those locations. Not an exhaustive disk search |
| `python --version` and `python -I -B -c` import availability probe | Python 3.13.7; Shapely, pyproj, GeoPandas, OSMnx, NetworkX, osgeo absent in standard interpreter |
| Prior `.venv\Scripts\python.exe -I -B -c` package/version probe | Shapely 2.1.2, GEOS 3.13.1, pyproj 3.7.2, PROJ 9.5.1; GeoPandas, OSMnx, NetworkX, Fiona, Rasterio absent there. No global package inventory inferred |
| `rg -n` relevant normalizer/fetch/CRS/entity/hash code | Found explicit origin/CRS transform, source-hash guard, geometry status policies, access-tag allowlist omission, and canonical content-hash algorithm |
| `rg --files data -g '*.pbf' -g '*.gpkg' -g '*.shp' -g '*.mbtiles' -g '*.pmtiles' -g '*graph*' -g '*transit*' -g '*gtfs*' -g '*entrance*'` | Entrance reconstruction JSON and navigation report filenames found; no matching graph/geodata/tile/GTFS archive filenames found |
| In prior folder, `rg --files -g '!**/.venv/**' -g '!**/node_modules/**' -g '!**/.git/**' -g '*LICENSE*' -g '*COPYING*' -g '*license*'` | No matching paths; rg exit 1 (normal no-match result) |
| `audit_previous_project.py` via prior venv with `-I -B` | Final run exit 0; 67 file hashes; 21 GeoJSON layers; 3 raw snapshots; no parse errors; 8/8 synthetic negative cases; parent pending |
| Same script with `--output 'C:\Users\joshu\Documents\BGC'` | Refused output before creating files: `--output must stay under this Omni-BGC docs/evaluations/m0/gis or parent audit directory`; tool-reported exit 1 |
| Official web documentation opened through web tool | OSM copyright/license, OSMF tile policy, pyproj Transformer docs on 2026-10-09; links in report. No geodata/tile/media source acquisition |

Reproduction command:

```powershell
& 'C:\Users\joshu\Documents\BGC\.venv\Scripts\python.exe' -I -B 'C:\Users\joshu\Documents\Omni-BGC\docs\evaluations\m0\gis\audit_previous_project.py'
```

Final stdout:

```json
{
  "files_hashed": 67,
  "geojson_layers_checked": 21,
  "raw_snapshots_checked": 3,
  "errors": [],
  "negative_cases_passed": 8,
  "negative_cases_total": 8,
  "parent_review": "PENDING"
}
```

Earlier script revisions produced 65/67-file inventories and 7 negative cases before parent-requested output-path/unknown-CRS checks and additional manifest checks. Final artifacts supersede those exploratory outputs. No source parse failure was hidden. The material canonical entity content-hash mismatch is an observed data-integrity finding, not a command failure, and remains open.

## Evidence, failures and deferrals

Actual raw checksums/counts match sidecars. All selected layer header source hashes resolve; transformation bounds and geometry/count/identity signals are recorded. Internal pilot entity content hash mismatch remains unresolved. Repeated names and coincident geometry are review signals; no imports, deletions, merges or duplicate rejections were performed. "Unchecked" states include source freshness, field safety, permission clearance, authoritatively defined service area, route connectivity, upstream factual truth, device/UI/offline proof, and full prior-project inventory. These are not recorded as zero failures or PASS.

Changed paths: audit script, task plan, inventory CSV, QA JSON, reuse report, this journal, and evidence checksum manifest under `docs/evaluations/m0/gis/`. Tooling chosen: Python stdlib for bounded hashes/records; Shapely for geometry structure; pyproj for explicit metre/WGS84 transform checks. Full GeoPandas/OSMnx/GDAL/QGIS installs rejected because existing libraries suffice for M0 structural QA and installation would not prove field correctness.

Next owner: parent performs independent review, accepts/requests changes/rejects, and integrates a concise shared journal entry only on explicit acceptance. M1/M3 and field/license reviewer work remains deferred until authorized.
