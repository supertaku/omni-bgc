"""Retain explicitly permitted local exports immutably; no network or promotion."""
import argparse
import csv
from datetime import datetime
import hashlib
import io
import json
import math
import re
from pathlib import Path
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[3]
FORMATS = {'json', 'csv', 'geojson', 'gtfs_schedule'}


def sha(data): return hashlib.sha256(data).hexdigest()


def instant(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z', value):
        raise ValueError('Explicit UTC timestamp required')
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def canonical(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result: raise ValueError('Duplicate JSON property: ' + key)
        result[key] = value
    return result


def check_policy(policy, base, data, now):
    current = instant(now)
    required = ('source_id', 'owner', 'canonical_url', 'license_reference', 'reviewer', 'decision_reference', 'retention_terms')
    if any(not isinstance(policy.get(k), str) or policy[k].strip().casefold() in ('', 'unknown', 'unassigned') for k in required):
        raise ValueError('Missing reviewed acquisition metadata')
    if policy.get('decision') != 'ALLOW_INTERNAL_RETAIN' or policy.get('internal_storage_allowed') is not True:
        raise ValueError('Internal retention not positively authorized')
    if policy.get('transform_allowed') is not True:
        raise ValueError('Structured extraction not authorized')
    if policy.get('raw_sha256') != sha(data):
        raise ValueError('Raw checksum mismatch')
    if not instant(policy['reviewed_at']) <= current < instant(policy['valid_until']):
        raise ValueError('Expired/future permission review')
    if instant(policy['fetched_at']) > current or instant(policy['reviewed_at']) < instant(policy['fetched_at']):
        raise ValueError('Permission review must bind acquired version')
    evidence = policy['retained_permission']
    path = (base / evidence['file']).resolve()
    if not path.is_relative_to(base.resolve()) or not path.is_file():
        raise ValueError('Retained permission bytes missing/mismatched')
    permission_bytes=path.read_bytes()
    if sha(permission_bytes)!=evidence['sha256']:raise ValueError('Retained permission bytes missing/mismatched')
    url = policy['canonical_url'].casefold()
    if 'tile.openstreetmap.org' in url or policy.get('source_kind', '').strip().casefold() in ('public_osm_raster', 'osmf_public_raster'):
        raise ValueError('Public OSM raster offline acquisition denied')
    return permission_bytes


def coordinate(values):
    if (not isinstance(values, list) or len(values) < 2 or any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values)
            or not -180 <= values[0] <= 180 or not -90 <= values[1] <= 90):
        raise ValueError('Invalid WGS84 coordinate')


def geometry(value):
    if value is None: return
    kind = value.get('type')
    coords = value.get('coordinates')
    depth = {'Point': 0, 'MultiPoint': 1, 'LineString': 1, 'MultiLineString': 2, 'Polygon': 2, 'MultiPolygon': 3}.get(kind)
    if depth is None: raise ValueError('Unsupported geometry; explicit adapter needed')
    def walk(items, level):
        if level == 0: return coordinate(items)
        if not isinstance(items, list) or not items: raise ValueError('Empty geometry')
        for child in items: walk(child, level - 1)
    walk(coords, depth)


def parse(data, format_name, policy):
    if format_name not in FORMATS: raise ValueError('Unsupported export format')
    if format_name == 'gtfs_schedule':
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)): raise ValueError('Duplicate GTFS ZIP members')
            required = {'agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'}
            if not required <= set(names) or not {'calendar.txt', 'calendar_dates.txt'} & set(names):
                raise ValueError('Missing GTFS Schedule required tables')
            if any(i.file_size > 20_000_000 for i in archive.infolist()) or sum(i.file_size for i in archive.infolist()) > 100_000_000:
                raise ValueError('GTFS local review size budget exceeded')
            tables = {}
            for name in sorted(required | ({'calendar.txt', 'calendar_dates.txt'} & set(names))):
                rows = parse(archive.read(name),'csv',policy)
                tables[name] = rows
            # This is format staging, not a GTFS semantic validator or an official feed claim.
            return {'tables': tables, 'semantic_validation': 'PENDING_GTFS_REFERENCE_AND_OPERATOR_REVIEW'}
    text = data.decode('utf-8-sig')
    if format_name == 'csv':
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames or len(set(reader.fieldnames)) != len(reader.fieldnames):
            raise ValueError('Missing/duplicate CSV headings')
        records = list(reader)
        if any(None in row or None in row.values() for row in records): raise ValueError('Ragged CSV rows')
        return records
    document = json.loads(text, object_pairs_hook=unique_object,
                          parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))
    if format_name == 'geojson':
        if policy.get('source_crs') != 'EPSG:4326' or document.get('type') != 'FeatureCollection' or 'crs' in document:
            raise ValueError('GeoJSON requires explicit WGS84 exchange contract')
        features = document.get('features')
        if not isinstance(features, list): raise ValueError('Missing GeoJSON feature list')
        for feature in features:
            if feature.get('type') != 'Feature': raise ValueError('Invalid GeoJSON feature')
            geometry(feature.get('geometry'))
        return features
    if not isinstance(document, (dict, list)): raise ValueError('JSON export must contain objects/records')
    return document


def capture(source, policy_path, output, format_name, now):
    source, policy_path, output = map(Path, (source, policy_path, output))
    root = (ROOT / 'data/generated/m4/acquisitions').resolve()
    output = output.resolve()
    if output != root and not output.is_relative_to(root): raise ValueError('Output must be ignored M4 acquisition storage')
    policy = json.loads(policy_path.read_text(encoding='utf-8'), object_pairs_hook=unique_object)
    data = source.read_bytes()
    permission_bytes = check_policy(policy, policy_path.parent.resolve(), data, now)
    staged = parse(data, format_name, policy)
    identity = sha(canonical({'source_id': policy['source_id'], 'raw_sha256': sha(data), 'policy_sha256': sha(canonical(policy)), 'adapter': 'local-export-v1', 'format': format_name}))
    snapshot = output / identity
    manifest = {'format_version': 1, 'acquisition_id': identity, 'source_id': policy['source_id'],
                'raw_sha256': sha(data), 'raw_bytes': len(data), 'policy_sha256': sha(canonical(policy)),
                'permission_sha256': sha(permission_bytes), 'staging_sha256': sha(canonical(staged)),
                'format': format_name, 'fetched_at': policy['fetched_at'], 'source_published_at': policy.get('source_published_at'),
                'adapter_version': 'local-export-v1', 'status': 'CANDIDATE_INTERNAL_ONLY', 'publication_eligible': False,
                'no_automatic_merge': True, 'license_reference': policy['license_reference'], 'reviewer': policy['reviewer']}
    expected = {'raw.bin': data, 'permission.bin': permission_bytes, 'policy.json': canonical(policy),
                'staging.json': canonical(staged), 'manifest.json': canonical(manifest)}
    if snapshot.exists():
        if any(not (snapshot / name).is_file() or (snapshot / name).read_bytes() != content for name, content in expected.items()):
            raise ValueError('Immutable acquisition changed; no overwrite')
        return manifest | {'replayed': True}
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.pending-', dir=output) as directory:
        temp = Path(directory)
        for name, content in expected.items(): (temp / name).write_bytes(content)
        # Snapshot appears only after all parsing/validation/writes succeed. No canonical DB writes.
        temp.rename(snapshot)
    return manifest | {'replayed': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--policy', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/generated/m4/acquisitions')
    parser.add_argument('--format', required=True, choices=sorted(FORMATS))
    parser.add_argument('--now', required=True)
    args = parser.parse_args()
    print(json.dumps(capture(args.source, args.policy, args.output, args.format, args.now), indent=2))


if __name__ == '__main__': main()
