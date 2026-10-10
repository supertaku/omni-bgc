"""Raw-only historical discovery. No network, graph, geometry inference or promotion."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import unicodedata

ROOT = Path(__file__).resolve().parents[2]
PRIOR = Path('C:/Users/joshu/Documents/BGC')
RAW = PRIOR / 'data/raw/osm/bgc-2026-09-14T162150Z.json'
META = RAW.with_suffix('.meta.json')
APPROVAL = ROOT / 'docs/evaluations/m4/comprehensive/geography/internal-scope-approval.json'
EXPECTED = {
    'raw_sha256': 'c7c77bdee83947293624a3a6036089e809c2fb2c1cec4d5283fb1c89535a8ac3',
    'sidecar_sha256': 'd749bce5e9e27874a46d995c8a24412761aa761040f424c12ed0c34200fac611',
    'query_sha256': '149903439170856adca4521e7f637002e6a84cf14cb99c49bfebf11e67f643de',
    'prior_boundary_sha256': '82d4e301fbbec3326d92ce11d548190c4dc0a23e7cafe2faf70b5068488364f0',
}
TAG_KEYS = set('name official_name alt_name old_name short_name brand operator building building:part building:levels level layer highway footway sidewalk crossing crossing:signals crossing:markings foot bicycle cycleway access barrier entrance wheelchair ramp incline bridge tunnel indoor amenity shop office tourism leisure landuse natural waterway public_transport bus railway route network service oneway junction opening_hours covered surface smoothness kerb tactile_paving bench drinking_water toilets supervised parking fee'.split())

def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'))

def authorize(raw=RAW, meta_path=META, approval_path=APPROVAL):
    approval, meta = load(approval_path), load(meta_path)
    if approval.get('parent_decision') != 'ACCEPT' or approval.get('internal_processing_allowed') is not True or approval.get('distribution_authorized') is not False:
        raise ValueError('Exact internal scope acceptance required')
    boundary = (PRIOR / meta['boundary_path']).resolve()
    if not boundary.is_relative_to((PRIOR / 'data/geographic').resolve()):
        raise ValueError('Historical boundary escapes reviewed directory')
    actual = {'raw_sha256': sha(raw), 'sidecar_sha256': sha(meta_path),
              'query_sha256': hashlib.sha256(meta['query'].encode()).hexdigest(),
              'prior_boundary_sha256': sha(boundary)}
    if actual != EXPECTED or any(approval.get(k) != v for k, v in EXPECTED.items()):
        raise ValueError('Exact approved raw/sidecar/query/boundary bytes changed')
    if meta.get('sha256') != actual['raw_sha256'] or meta.get('query_sha256') != actual['query_sha256'] or meta.get('boundary_sha256') != actual['prior_boundary_sha256']:
        raise ValueError('Lineage sidecar conflicts')
    if meta.get('source_url') != 'https://api.openstreetmap.org/api/0.6/map' or meta.get('license') != 'ODbL 1.0':
        raise ValueError('Approved source origin/license changed')
    return meta, actual

def categories(tags):
    result = []
    if tags.get('building') not in (None, 'no'): result.append('building_outline')
    if tags.get('building:part') not in (None, 'no'): result.append('building_part')
    if any(k in tags for k in ('amenity', 'shop', 'office', 'tourism', 'leisure')): result.append('place_or_facility')
    if 'highway' in tags: result.append('road_or_pedestrian_infrastructure')
    if any(k in tags for k in ('public_transport', 'bus', 'railway')) or tags.get('route') in ('bus', 'train', 'subway'): result.append('static_transit')
    if any(k in tags for k in ('entrance', 'barrier', 'wheelchair', 'ramp', 'tactile_paving', 'kerb')): result.append('access_or_barrier')
    if any(k in tags for k in ('landuse', 'natural', 'waterway')): result.append('landscape_or_water')
    return result

def position(lon, lat):
    return (isinstance(lon, (int, float)) and not isinstance(lon, bool)
            and isinstance(lat, (int, float)) and not isinstance(lat, bool)
            and math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90)

def discover(elements, raw_hash):
    identities = Counter((e.get('type'), e.get('id')) for e in elements)
    records, rejected = [], []
    for e in elements:
        kind, ident = e.get('type'), e.get('id')
        ref = f'osm:{kind}:{ident}'
        tags = e.get('tags', {})
        groups = categories(tags)
        if not groups: continue
        reasons = []
        if kind not in ('node', 'way', 'relation') or not isinstance(ident, int): reasons.append('invalid_original_identity')
        if identities[(kind, ident)] > 1: reasons.append('duplicate_original_identity_all_copies_quarantined')
        record = {'candidate_ref': ref, 'identity_kind': 'external_source_reference_not_canonical_entity',
                  'review_state': 'CANDIDATE_HISTORICAL', 'source_raw_sha256': raw_hash,
                  'source_version': e.get('version'), 'source_timestamp': e.get('timestamp'),
                  'categories': groups, 'tags': {k: v for k, v in tags.items() if k in TAG_KEYS or k.startswith(('name:', 'alt_name:', 'addr:', 'cycleway:', 'sidewalk:', 'access:'))},
                  'navigation_eligible': False, 'publication_eligible': False,
                  'district_membership': 'UNKNOWN', 'coordinate_evidence': 'original_raw_only',
                  'verified_at': None, 'required_review': ['current_world', 'rights_for_intended_use', 'entity_identity', 'district_membership', 'public_access']}
        if kind == 'node':
            if position(e.get('lon'), e.get('lat')): record['original_position_lon_lat'] = [e['lon'], e['lat']]
            else: reasons.append('missing_or_invalid_original_node_coordinate')
        elif kind == 'way':
            record['original_node_refs'] = e.get('nodes', [])
            coords = e.get('geometry', [])
            if coords:
                if all(position(p.get('lon'), p.get('lat')) for p in coords): record['original_positions_lon_lat'] = [[p['lon'], p['lat']] for p in coords]
                else: reasons.append('invalid_original_way_coordinate')
            record['geometry_interpretation'] = 'unreconstructed_original_vertex_sequence_no_centroid_or_footprint_approval'
        elif kind == 'relation':
            record['original_members'] = [{k: m[k] for k in ('type', 'ref', 'role') if k in m} for m in e.get('members', [])]
            record['geometry_interpretation'] = 'unreconstructed_relation_members_only'
        if reasons: rejected.append({'candidate_ref': ref, 'reasons': reasons})
        else: records.append(record)
    records.sort(key=lambda r: r['candidate_ref'])
    names = defaultdict(list)
    for r in records:
        if r['tags'].get('name'):
            key = unicodedata.normalize('NFC', r['tags']['name']).casefold().strip()
            names[key].append(r['candidate_ref'])
    repeated = [{'normalized_name': k, 'refs': v, 'action': 'RETAIN_SEPARATE_REVIEW_NOT_MERGE'} for k, v in sorted(names.items()) if len(v) > 1]
    return records, rejected, repeated

def run(output):
    output = Path(output).resolve()
    permitted = (ROOT / 'data/generated/m4/comprehensive/geography').resolve()
    if not output.is_relative_to(permitted) or output == permitted:
        raise ValueError('Output must be child of ignored comprehensive geography subtree')
    if output.exists(): raise ValueError('Immutable run output already exists')
    meta, evidence = authorize()
    raw = load(RAW)
    elements = raw['elements']
    if len(elements) != meta['element_count']: raise ValueError('Raw count conflicts with sidecar')
    records, rejected, repeated = discover(elements, evidence['raw_sha256'])
    output.mkdir(parents=True)
    inventory = output / 'candidates.jsonl'
    inventory.write_text(''.join(canonical(r) + '\n' for r in records), encoding='utf-8', newline='\n')
    (output / 'rejections.json').write_text(canonical(rejected) + '\n', encoding='utf-8')
    (output / 'name-review.json').write_text(canonical(repeated) + '\n', encoding='utf-8')
    counts = Counter(c for r in records for c in r['categories'])
    summary = {'schema_version': 1, 'tool_version': 'omni-raw-research-inventory-v1',
               'status': 'INTERNAL_HISTORICAL_DISCOVERY_ONLY', 'source_envelope_south_west_north_east': meta['bbox_south_west_north_east'],
               'source_envelope_is_official_boundary': False, 'coverage_denominator': None, 'district_coverage_percent': None,
               'retrieved_at': meta['retrieved_at'], 'checksums': evidence, 'approval_sha256': sha(APPROVAL),
               'raw_element_count': len(elements), 'raw_type_counts': dict(sorted(Counter(e['type'] for e in elements).items())),
               'candidate_source_records': len(records), 'category_counts_overlap': dict(sorted(counts.items())),
               'named_candidate_source_records': sum(bool(r['tags'].get('name')) for r in records),
               'named_building_outline_source_records': sum('building_outline' in r['categories'] and bool(r['tags'].get('name')) for r in records),
               'rejected_records': len(rejected), 'repeated_name_groups': len(repeated),
               'duplicate_identity_groups_all_raw': sum(v > 1 for v in Counter((e['type'], e['id']) for e in elements).values()),
               'approved_records': 0, 'exported_records': 0, 'navigation_eligible': 0,
               'inventory_sha256': sha(inventory), 'inventory_bytes': inventory.stat().st_size,
               'license': 'ODbL 1.0', 'attribution': '© OpenStreetMap contributors',
               'distribution_authorized': False, 'prior_processed_data_reused': False,
               'limitations': ['Snapshot envelope contains surrounding context; district membership unverified',
                               'Counts represent OSM objects, not unique businesses, branches or surveyed buildings',
                               'Names, tags, levels and access restrictions are historical source claims',
                               'No fabricated centroids, entrances, routes, legal boundary or current-world verification',
                               'Original geometry may cross the historical acquisition envelope']}
    (output / 'summary.json').write_text(canonical(summary) + '\n', encoding='utf-8')
    print(canonical(summary))
    return summary

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    run(parser.parse_args().output)
