"""Read-only M0 inventory. Writes audit summaries only beside this script.

No previous-project modules are imported or executed. No raw tags, contributor
metadata, media, precise user locations, or source datasets are copied.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
import math
from pathlib import Path
import platform
import sys
import unicodedata

import pyproj
import shapely
from shapely.geometry import LineString, shape


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def duplicates(values):
    c = Counter(values)
    return {"groups": sum(n > 1 for n in c.values()),
            "extra_records": sum(n - 1 for n in c.values() if n > 1)}


def walk_positions(value):
    if isinstance(value, list) and len(value) >= 2 and all(isinstance(n, (int, float)) for n in value):
        yield value
    elif isinstance(value, list):
        for child in value:
            yield from walk_positions(child)


def geo_summary(doc):
    features = doc.get("features", [])
    ids, geometry_hashes, names, geometric_ids = [], [], defaultdict(list), defaultdict(list)
    statuses = defaultdict(Counter)
    invalid, empty, missing, errors, nonfinite = [], [], [], [], []
    types, coordinate_count = Counter(), 0
    mins, maxs = [math.inf, math.inf], [-math.inf, -math.inf]
    inverse_mins, inverse_maxs = [math.inf, math.inf], [-math.inf, -math.inf]
    local = doc.get("local_frame")
    declared_projected_crs = doc.get("projected_crs")
    inverse = pyproj.Transformer.from_crs(declared_projected_crs, "EPSG:4326", always_xy=True) if local and declared_projected_crs else None
    outside_global_range = 0
    inverse_outside_global_range = 0
    crs_fields = {k: doc.get(k) for k in ["source_crs", "projected_crs", "crs"] if k in doc}
    retained_fields, centerlines, source_linked = Counter(), 0, 0
    for index, f in enumerate(features):
        p = f.get("properties") or {}
        fid = str(f.get("id", p.get("id", f"index:{index}")))
        ids.append(fid)
        if p.get("source_ids") or p.get("sources"):
            source_linked += 1
        if p.get("name"):
            normalized = unicodedata.normalize("NFKC", p["name"]).casefold().strip()
            names[normalized].append(fid)
        for key, val in p.items():
            if key.endswith("status") and isinstance(val, str):
                statuses[key][val] += 1
        retained_fields.update((p.get("tags") or {}).keys())
        centerlines += int("centerline_local" in p)
        g = f.get("geometry")
        if not g:
            missing.append(fid)
            continue
        types[g.get("type", "missing")] += 1
        for xy in walk_positions(g.get("coordinates", [])):
            coordinate_count += 1
            x, y = xy[:2]
            if not all(math.isfinite(v) for v in (x, y)):
                nonfinite.append(fid)
                continue
            mins = [min(mins[0], x), min(mins[1], y)]
            maxs = [max(maxs[0], x), max(maxs[1], y)]
            outside_global_range += int(not (-180 <= x <= 180 and -90 <= y <= 90))
            if inverse:
                origin = local["origin_projected"]
                lon, lat = inverse.transform(x + origin["easting"], y + origin["northing"])
                inverse_mins = [min(inverse_mins[0], lon), min(inverse_mins[1], lat)]
                inverse_maxs = [max(inverse_maxs[0], lon), max(inverse_maxs[1], lat)]
                inverse_outside_global_range += int(not (-180 <= lon <= 180 and -90 <= lat <= 90))
        try:
            geom = shape(g)
            if geom.is_empty:
                empty.append(fid)
            if not geom.is_valid:
                invalid.append(fid)
            normalized_wkb = shapely.normalize(geom).wkb_hex
            geometry_hashes.append(normalized_wkb)
            geometric_ids[normalized_wkb].append(fid)
        except Exception as exc:
            errors.append({"id": fid, "error": str(exc)})
    repeated = [v for v in names.values() if len(v) > 1]
    return {
        "feature_count": len(features), "geometry_types": dict(types),
        "crs_metadata": crs_fields, "coordinate_frame": "local metres" if local else "geographic candidate",
        "local_frame": local, "coordinate_count": coordinate_count,
        "inverse_transform_status": "CHECKED" if inverse else ("UNKNOWN: local frame missing projected_crs" if local else "not applicable"),
        "coordinate_bounds": [*mins, *maxs] if coordinate_count else None,
        "inverse_wgs84_bounds": [*inverse_mins, *inverse_maxs] if inverse and coordinate_count else None,
        "positions_invalid_as_direct_wgs84": outside_global_range,
        "positions_invalid_after_declared_inverse": inverse_outside_global_range if inverse else None,
        "invalid_geometry_count": len(invalid), "empty_geometry_count": len(empty),
        "missing_geometry_count": len(missing), "nonfinite_position_count": len(nonfinite),
        "geometry_errors": errors, "invalid_geometry_sample_ids": invalid[:10],
        "duplicate_id_signals": duplicates(ids), "duplicate_normalized_geometry_signals": duplicates(geometry_hashes),
        "duplicate_normalized_geometry_sample_ids": [v for v in geometric_ids.values() if len(v) > 1][:10],
        "repeated_normalized_name_groups": len(repeated),
        "repeated_name_sample_distinct_ids": repeated[:5],
        "duplicate_resolution": "not performed; all signals are review candidates, no records rejected or merged",
        "status_counts": {k: dict(v) for k, v in statuses.items()},
        "features_with_source_links": source_linked, "features_with_centerline_local": centerlines,
        "retained_access_tag_counts": {k: retained_fields[k] for k in ["access", "foot", "wheelchair", "surface", "steps", "incline", "opening_hours", "layer", "bridge", "tunnel", "crossing", "barrier"]},
        "approved_for_distribution": False,
    }


def negative_cases():
    tests = []
    add = lambda name, observed, expected: tests.append({"case": name, "observed": observed, "expected": expected, "pass": observed == expected})
    fixture = {"geometry": {"type": "Point", "coordinates": [121.05, 14.55]}, "license": None}
    add("valid_geometry_missing_license", shape(fixture["geometry"]).is_valid and not fixture["license"], True)
    lon, lat = 121.050972, 14.550806  # Public engineering datum; not a device/user position.
    in_global_range = lambda x, y: -180 <= x <= 180 and -90 <= y <= 90
    add("swapped_longitude_latitude_rejected", in_global_range(lat, lon), False)
    forward = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:32651", always_xy=True)
    inverse = pyproj.Transformer.from_crs("EPSG:32651", "EPSG:4326", always_xy=True)
    x, y = forward.transform(lon, lat)
    add("utm_metres_not_wgs84", in_global_range(x, y), False)
    unknown_crs = geo_summary({"features": [], "source_crs": "EPSG:4326", "local_frame": {"units": "metres"}})
    add("missing_projected_crs_remains_unknown", unknown_crs["inverse_transform_status"], "UNKNOWN: local frame missing projected_crs")
    back = inverse.transform(x, y)
    add("always_xy_roundtrip", max(abs(back[0] - lon), abs(back[1] - lat)) < 1e-8, True)
    a, b = LineString([(0, 1), (2, 1)]), LineString([(1, 0), (1, 2)])
    shared_nodes = set(a.coords) & set(b.coords)
    add("visual_intersection_without_shared_nodes", a.intersects(b) and not shared_nodes, True)
    same_name = [{"id": "fixture:branch:A", "name": "Example"}, {"id": "fixture:branch:B", "name": "Example"}]
    add("duplicate_name_does_not_merge_identity", len({r["name"] for r in same_name}) == 1 and len({r["id"] for r in same_name}) == 2, True)
    _, _, meters = pyproj.Geod(ellps="WGS84").inv(lon, lat, lon + 0.001, lat)
    degree_length = LineString([(lon, lat), (lon + 0.001, lat)]).length
    add("degree_distance_not_metres", meters > 100 and degree_length < 0.01, True)
    return tests


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--previous", type=Path, default=Path(r"C:\Users\joshu\Documents\BGC"))
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    root = args.previous.resolve(strict=True)
    output = args.output.resolve()
    scope = Path(__file__).resolve().parent.parent
    allowed_outputs = [scope / "gis", scope / "parent"]
    if not any(output == allowed or output.is_relative_to(allowed) for allowed in allowed_outputs):
        parser.error("--output must stay under this Omni-BGC docs/evaluations/m0/gis or parent audit directory")
    if output == root or output.is_relative_to(root):
        parser.error("--output cannot write inside the previous project")
    output.mkdir(parents=True, exist_ok=True)
    selected = set(root.joinpath("data/processed").glob("*.geojson"))
    selected.update(root.joinpath("data/geographic").glob("*.geojson"))
    selected.update(root.joinpath("data/raw/osm").glob("*.json"))
    selected.update(root.joinpath("data/reconstruction_packages").glob("*/entrances.json"))
    fixed = ["data/raw/pilot-osm.json", "data/raw/pilot-osm.meta.json", "data/geographic/pilot-candidates.json",
             "data/processed/bgc-data-audit.json", "data/processed/pilot-data-audit.json", "data/processed/pilot-candidate-assessment.json",
             "data/entities/source-registry.json", "data/entities/synthetic-buildings.json", "data/entities/pilot-entities.json",
             "data/sources/sources.json", "data/review/rights-review.json", "data/config/surface-heights.json",
             "requirements-geospatial.txt", "docs/DATA_SOURCES.md", "docs/DATA_ARCHITECTURE.md", "docs/COORDINATE_SYSTEM.md",
             "scripts/geography/geo_utils.py", "scripts/geography/normalize_osm.py", "scripts/geography/normalize_osm_pilot.py",
             "scripts/geography/fetch_osm_map_api.py", "scripts/geography/fetch_osm.py", "scripts/validation/test_coordinates.py"]
    fixed.extend(["scripts/entities/resolve_entities.py", "scripts/evidence/model.py"])
    selected.update(root / p for p in fixed)
    inventory, qa, snapshots, source_registries, entrances, manifest_checks = [], {}, {}, {}, {}, {}
    errors = []
    snapshot_hashes = {}
    for path in sorted(selected):
        relative = path.relative_to(root).as_posix()
        try:
            digest = sha(path)
            row = {"relative_path": relative, "bytes": path.stat().st_size, "sha256": digest,
                   "class": "audit context/code candidate", "license_status": "not established for code/context", "lineage_status": "context only", "distribution_status": "NOT APPROVED"}
            if path.suffix == ".geojson":
                doc = load(path)
                qa[relative] = geo_summary(doc)
                if relative.startswith("data/processed/"):
                    row.update({"class": "OSM-derived geometry candidate; local metres", "license_status": "ODbL recorded upstream; distribution review pending", "lineage_status": doc.get("source_sha256", "missing")})
                    if "boundary-local" in relative:
                        row.update({"class": "estimated project scope derivative; local metres", "license_status": "mixed contextual sources; explicit project boundary rights unresolved"})
                else:
                    row.update({"class": "estimated project scope candidate", "license_status": "mixed contextual sources; explicit project boundary rights unresolved", "lineage_status": "source IDs present; upstream boundary documents not verified"})
            elif path.suffix == ".json":
                doc = load(path)
                if "elements" in doc:
                    elements = doc["elements"]
                    meta_path = path.with_name(path.name.replace(".json", ".meta.json"))
                    meta = load(meta_path)
                    snapshot_hashes[digest] = relative
                    identities = [(e.get("type"), e.get("id")) for e in elements]
                    coordinate_positions = []
                    for e in elements:
                        if "lon" in e and "lat" in e:
                            coordinate_positions.append((e["lon"], e["lat"]))
                        coordinate_positions.extend((p["lon"], p["lat"]) for p in e.get("geometry", []) if "lon" in p and "lat" in p)
                    snapshots[relative] = {"element_count": len(elements), "types": dict(Counter(e.get("type") for e in elements)),
                        "metadata_count_matches": meta.get("element_count") == len(elements), "sha256_matches_metadata": meta.get("sha256") == digest,
                        "duplicate_type_id_signals": duplicates(identities), "coordinate_occurrences_checked": len(coordinate_positions),
                        "coordinate_order_invalid_count": sum(not (-180 <= x <= 180 and -90 <= y <= 90) for x, y in coordinate_positions),
                        "recorded_license": meta.get("license"), "attribution": meta.get("attribution"), "retrieved_at": meta.get("retrieved_at"),
                        "source_url": meta.get("source_url"), "boundary_sha256_matches": sha(root / meta["boundary_path"]) == meta.get("boundary_sha256") if meta.get("boundary_path") else None,
                        "top_level_tag_presence_counts": {tag: sum(tag in (e.get("tags") or {}) for e in elements) for tag in ["access", "foot", "wheelchair", "bridge", "tunnel", "incline", "opening_hours", "entrance"]},
                        "coordinate_check_scope": "top-level node positions and way geometry occurrences; relation member geometry is not checked",
                        "query_sha256_matches": hashlib.sha256(meta["query"].encode("utf-8")).hexdigest() == meta.get("query_sha256") if meta.get("query_sha256") else None,
                        "contributor_personal_metadata": "not exported", "rejected_duplicates": "not applicable; inventory only; no import or deduplication"}
                    row.update({"class": "raw OSM geographic candidate", "license_status": meta.get("license", "MISSING"), "lineage_status": "verified raw SHA256" if meta.get("sha256") == digest else "HASH MISMATCH"})
                elif relative in ["data/sources/sources.json", "data/entities/source-registry.json"]:
                    source_registries[relative] = [{k: s.get(k) for k in ["source_id", "id", "license", "license_information", "license_status", "rights_status", "access_status", "authority", "authority_level", "attribution", "retrieved_at"] if k in s} for s in doc["sources"]]
                    row["class"] = "source/license metadata only"
                elif "entrances" in doc:
                    entries = doc["entrances"]
                    entrances[relative] = {"entrance_count": len(entries), "status_counts": dict(Counter(e.get("status", "MISSING") for e in entries)),
                        "entries_with_coordinate_geometry_fields": sum(any(k in e for k in ["geometry", "coordinates", "longitude", "latitude", "lon", "lat"]) for e in entries),
                        "classification": "synthetic fixture" if "synthetic" in relative else "reconstruction concept; not approved navigation endpoints"}
                    row.update({"class": entrances[relative]["classification"], "license_status": "rights not independently validated", "lineage_status": "entrance evidence not field validated"})
                elif "synthetic" in relative:
                    row.update({"class": "synthetic fixture; excluded from real geographic data", "license_status": "project code/content rights not established", "lineage_status": doc.get("classification", "synthetic")})
                if relative == "data/entities/pilot-entities.json":
                    canonical_content = json.dumps({"entities": doc["entities"], "complexes": doc["complexes"]}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
                    computed = hashlib.sha256(canonical_content.encode("utf-8")).hexdigest()
                    manifest_checks[relative] = {"content_sha256_claimed": doc.get("content_sha256"), "content_sha256_computed": computed,
                        "content_sha256_matches": computed == doc.get("content_sha256"), "source_sha256_claimed": doc.get("source_sha256"),
                        "entity_count": len(doc["entities"]), "complex_count": len(doc["complexes"]),
                        "duplicate_entity_id_signals": duplicates(e.get("entity_id", e.get("id")) for e in doc["entities"]),
                        "classification": "prior 3D building/complex identity candidates; not approved mobile places/entrances"}
                    row["class"] = manifest_checks[relative]["classification"]
                elif relative.endswith("-data-audit.json"):
                    manifest_checks[relative] = {"source_sha256_claimed": doc.get("source_sha256"),
                        "snapshot_file_sha256_matches": sha(root / doc["source_snapshot"]) == doc.get("source_sha256") if doc.get("source_snapshot") else None,
                        "recorded_counts": doc.get("counts"), "recorded_issues_count": len(doc.get("issues", []))}
            inventory.append(row)
        except Exception as exc:
            errors.append({"path": relative, "error": type(exc).__name__ + ": " + str(exc)})
    for relative, summary in qa.items():
        doc = load(root / relative)
        h = doc.get("source_sha256")
        summary["source_snapshot_hash_resolves"] = h in snapshot_hashes if h else None
        summary["source_snapshot_path"] = snapshot_hashes.get(h)
    for checks in manifest_checks.values():
        h = checks.get("source_sha256_claimed")
        checks["source_snapshot_hash_resolves"] = h in snapshot_hashes if h else None
    report = {"audit_date": "2026-10-09", "scope": "M0 read-only bounded inventory; not dataset approval, ETL, field QA or routing proof",
        "previous_project": str(root), "tool_versions": {"python": platform.python_version(), "executable": sys.executable,
            "shapely": shapely.__version__, "GEOS": shapely.geos_version_string, "pyproj": pyproj.__version__, "PROJ": pyproj.proj_version_str,
            "PROJ_network_enabled": pyproj.network.is_network_enabled()},
        "files_hashed": len(inventory), "file_errors": errors, "raw_snapshot_qa": snapshots, "geojson_qa": qa,
        "source_registry_recorded_fields": source_registries, "manifest_checks": manifest_checks,
        "entrance_inventory": entrances, "synthetic_negative_cases": negative_cases(),
        "unchecked": ["field safety/access", "source freshness against current world", "authoritative boundary", "legal review", "upstream snapshot contributor content legitimacy", "complete prior-project inventory", "mobile map/offline compatibility", "route graph connectivity", "entity resolution", "complete reference/media rights"],
        "parent_review": "PENDING", "approved_distributable_datasets": 0}
    (output / "audit-results.json").write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    with (output / "file-inventory.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(inventory[0]))
        writer.writeheader()
        writer.writerows(inventory)
    print(json.dumps({"files_hashed": len(inventory), "geojson_layers_checked": len(qa), "raw_snapshots_checked": len(snapshots),
                      "errors": errors, "negative_cases_passed": sum(t["pass"] for t in report["synthetic_negative_cases"]),
                      "negative_cases_total": len(report["synthetic_negative_cases"]), "parent_review": "PENDING"}, indent=2))


if __name__ == "__main__":
    main()
