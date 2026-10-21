"""Derive a bounded display-only context from pinned OSM API XML extracts.

The XML files are retained as gzip source receipts. No coordinates are invented or
smoothed, and no context geometry is used by the routing or place directories.
"""

import gzip
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/generated/context/source"
OUT = ROOT / "src/map/context.json"
PROVENANCE = ROOT / "assets/generated/context/provenance.json"
# Tile audit's display envelope, wider than the reviewed service bounds.
CORE = (121.0455, 14.543022250023732, 121.05909581890542, 14.5602372256744)
HIGHWAYS = {
    "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
    "residential", "living_street", "service", "pedestrian", "footway",
    "path", "steps", "cycleway", "track",
}
GREEN = {"park", "garden", "playground", "recreation_ground"}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def outside_core(coords):
    xs = [c[0] for c in coords]
    ys = [c[1] for c in coords]
    # shortcut: omit any whole feature whose envelope touches the detailed pack;
    # upgrade to exact clipping only with a reviewed geometry pipeline.
    return max(xs) < CORE[0] or min(xs) > CORE[2] or max(ys) < CORE[1] or min(ys) > CORE[3]


def outside_line(coords):
    """Keep source vertices and clip only the part under the detailed pack."""
    parts = []
    current = []

    def append(a, b):
        nonlocal current
        if a == b:
            return
        if current and current[-1] == a:
            current.append(b)
        else:
            if len(current) > 1:
                parts.append(current)
            current = [a, b]

    def gap():
        nonlocal current
        if len(current) > 1:
            parts.append(current)
        current = []

    for a, b in zip(coords, coords[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        enter, leave = 0.0, 1.0
        for p, q in ((-dx, a[0] - CORE[0]), (dx, CORE[2] - a[0]),
                     (-dy, a[1] - CORE[1]), (dy, CORE[3] - a[1])):
            if p == 0:
                if q < 0:
                    enter, leave = 1.0, 0.0
                    break
            else:
                t = q / p
                if p < 0:
                    enter = max(enter, t)
                else:
                    leave = min(leave, t)
        if enter > leave or leave <= 0 or enter >= 1:
            append(a, b)
            continue
        point = lambda t: [a[0] + t * dx, a[1] + t * dy]
        if enter > 0:
            append(a, point(enter))
        gap()
        if leave < 1:
            append(point(leave), b)
    gap()
    return parts


def main():
    files = sorted(SOURCE.glob("osm-*.xml.gz"))
    if len(files) != 16:
        raise SystemExit("Expected all sixteen bounded OSM source extracts")
    nodes = {}
    ways = {}
    hospital = None
    receipts = []
    for path in files:
        receipts.append({"path": path.name, "bytes": path.stat().st_size, "sha256": digest(path)})
        with gzip.open(path, "rb") as stream:
            for _, element in ET.iterparse(stream, events=("end",)):
                if element.tag == "node":
                    nodes[element.attrib["id"]] = [float(element.attrib["lon"]), float(element.attrib["lat"])]
                    if element.attrib["id"] == "7597467285":
                        tags = {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}
                        if tags.get("name") == "St. Luke's Medical Center Global City":
                            hospital = nodes[element.attrib["id"]]
                    element.clear()
                elif element.tag == "way":
                    tags = {tag.attrib["k"]: tag.attrib["v"] for tag in element.findall("tag")}
                    kind = (
                        "building" if tags.get("building") not in (None, "no") else
                        "road" if tags.get("highway") in HIGHWAYS else
                        "green" if tags.get("leisure") in GREEN or tags.get("landuse") in GREEN else
                        "water" if tags.get("natural") == "water" else None
                    )
                    if kind:
                        ways[element.attrib["id"]] = (
                            kind,
                            [ref.attrib["ref"] for ref in element.findall("nd")],
                            tags,
                        )
                    element.clear()
    features = []
    counts = {kind: 0 for kind in ("building", "road", "green", "water")}
    for way_id, (kind, refs, tags) in sorted(ways.items(), key=lambda item: int(item[0])):
        if len(refs) < 2 or any(ref not in nodes for ref in refs):
            continue
        coords = [nodes[ref] for ref in refs]
        if kind != "road" and not outside_core(coords):
            continue
        if kind == "building" and not all(
            CORE[0] - 0.004 <= x <= CORE[2] + 0.004
            and CORE[1] - 0.004 <= y <= CORE[3] + 0.004
            for x, y in coords
        ):
            continue
        closed = refs[0] == refs[-1] and len(set(refs)) >= 3
        if kind != "road" and not closed:
            continue
        if kind == "road":
            parts = outside_line(coords)
            if not parts:
                continue
            geometry = (
                {"type": "LineString", "coordinates": parts[0]} if len(parts) == 1
                else {"type": "MultiLineString", "coordinates": parts}
            )
        else:
            geometry = {"type": "Polygon", "coordinates": [coords]}
        properties = {"kind": kind, "osmWayId": int(way_id)}
        for key in ("name", "highway", "footway", "surface"):
            if key in tags:
                properties[key] = tags[key]
        features.append({"type": "Feature", "properties": properties, "geometry": geometry})
        counts[kind] += 1
    if not features or not counts["road"] or not counts["building"]:
        raise SystemExit("OSM extract yielded no usable context")
    if hospital is None:
        raise SystemExit("Reviewed St. Luke's OSM node missing or renamed")
    features.append({"type": "Feature", "properties": {
        "kind": "landmark", "name": "St. Luke's Medical Center Global City",
        "osmNodeId": 7597467285,
    }, "geometry": {"type": "Point", "coordinates": hospital}})
    counts["landmark"] = 1
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")), encoding="utf-8")
    PROVENANCE.write_text(json.dumps({
        "source": "OpenStreetMap API 0.6 map extracts",
        "sourceUrl": "https://api.openstreetmap.org/api/0.6/map",
        "retrievedAtUtc": "2026-10-20",
        "attribution": "© OpenStreetMap contributors",
        "license": "ODbL-1.0",
        "bbox": [121.035, 14.53, 121.07, 14.575],
        "coreExclusionBbox": list(CORE),
        "navigationEligible": False,
        "placeFactsEligible": False,
        "sourceFiles": receipts,
        "featureCounts": counts,
        "output": {"path": "src/map/context.json", "bytes": OUT.stat().st_size, "sha256": digest(OUT)},
    }, indent=2) + "\n", encoding="utf-8")
    print(f"{len(features)} features, {OUT.stat().st_size} bytes; {counts}")


if __name__ == "__main__":
    main()
