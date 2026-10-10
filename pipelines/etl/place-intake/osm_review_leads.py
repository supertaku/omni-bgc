"""Create internal historical review leads, never approved mobile business facts.

Only accepted M3 inputs are used. External OSM keys are review references, not
canonical entity IDs. No menus, media, contact details or access inference.
"""
import argparse
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ALLOWED = {'name', 'name:en', 'amenity', 'shop', 'office', 'tourism', 'leisure',
           'building', 'addr:housename', 'addr:street', 'addr:floor', 'level', 'cuisine'}
REVIEWED_INPUTS = {
    'context-points.geojson': 'b9863cac9b99e89d4eb3f886a11883b5d249472dbb1459855b3aabf2d14abcdc',
    'render-ways.geojson': '4e78b1ec5b94d0480c12c42bf42b9e8ef7de02c6372dac1aa97522ebe410c456',
}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True,
                               separators=(',', ':'), allow_nan=False) + '\n', encoding='utf-8')

def build(source, output):
    approval = load(ROOT / 'docs/evaluations/m3/parent/CANDIDATE_APPROVAL.json')
    if approval['parent_decision'] != 'ACCEPT':
        raise ValueError('Accepted internal GIS input required')
    manifest = load(source / 'artifact-manifest.json')
    provenance = manifest['provenance']
    if provenance['distribution_authorized'] is not False:
        raise ValueError('This tool is restricted to internal review')
    intake = load(ROOT / 'docs/evaluations/m3/parent/INTAKE_APPROVAL.json')
    if (provenance['raw_sha256'] != intake['raw_sha256'] or
        sha(ROOT / 'data/manifests/service-area-v1.json') != intake['service_area_sha256']):
        raise ValueError('Raw snapshot or reviewed pilot scope changed')
    scope = load(ROOT / 'data/manifests/service-area-v1.json')['geometry']['coordinates'][0]
    xs, ys = zip(*scope)
    bounds = min(xs), min(ys), max(xs), max(ys)
    counts, leads, by_name = Counter(), [], defaultdict(list)
    seen = set()
    for name in ('context-points.geojson', 'render-ways.geojson'):
        entry = next(e for e in manifest['files'] if e['name'] == name)
        path = source / name
        if sha(path) != entry['sha256'] or entry['sha256'] != REVIEWED_INPUTS[name]:
            raise ValueError('Input changed after M3 review: ' + name)
        for feature in load(path)['features']:
            props = feature['properties']
            tags = props['tags']
            category_key = next((k for k in ('amenity', 'shop', 'office', 'tourism', 'leisure', 'building') if k in tags), None)
            if category_key is None:
                continue
            geometry = feature['geometry']
            if geometry['type'] == 'Point':
                x, y = geometry['coordinates']
                if not (bounds[0] <= x <= bounds[2] and bounds[1] <= y <= bounds[3]):
                    counts['outside_pilot_points_rejected'] += 1
                    continue
            kind = 'node' if name == 'context-points.geojson' else 'way'
            reference = f"osm:{kind}:{props['osm_id']}"
            if reference in seen:
                counts['exact_external_duplicates_rejected'] += 1
                continue
            seen.add(reference)
            lead = {'external_reference': reference, 'status': 'CANDIDATE_HISTORICAL',
                    'geometry': geometry, 'candidate_tags': {k: v for k, v in tags.items() if k in ALLOWED},
                    'classification': f'{category_key}:{tags[category_key]}',
                    'source_snapshot_id': provenance['snapshot_uuid'],
                    'source_input_sha256': entry['sha256'], 'raw_sha256': provenance['raw_sha256'],
                    'retrieved_at': provenance['retrieved_at_utc'], 'verified_at': None,
                    'navigation_eligible': False, 'distribution_authorized': False,
                    'review_required': ['current existence/name', 'canonical identity/branch/floor',
                                        'source grant and publication obligations', 'field entrance/access'],
                    'menu_evidence': 'NOT_COLLECTED'}
            leads.append(lead)
            counts[lead['classification']] += 1
            label = tags.get('name', tags.get('name:en', '')).casefold().strip()
            if label:
                by_name[label].append(reference)
    leads.sort(key=lambda l: l['external_reference'])
    duplicates = [{'name_match_only': name, 'external_references': refs,
                   'action': 'MANUAL_REVIEW_NO_MERGE'} for name, refs in sorted(by_name.items()) if len(refs) > 1]
    inventory = output / 'historical-review-leads.json'
    dump(inventory, {'format_version': 1, 'provenance': provenance, 'leads': leads,
                     'same_name_review_queue': duplicates, 'approved_records': 0})
    report = {'status': 'INTERNAL_REVIEW_ONLY', 'coverage': 'High Street project pilot; no full BGC census',
              'source_raw_sha256': provenance['raw_sha256'], 'source_snapshot_id': provenance['snapshot_uuid'],
              'license': provenance['license'], 'attribution': provenance['attribution'],
              'candidate_leads': len(leads), 'classification_counts': dict(sorted(counts.items())),
              'name_match_groups': len(duplicates), 'approved_places': 0, 'verified_menus': 0,
              'verified_entrances': 0, 'coverage_denominator': None, 'distribution_authorized': False,
              'inventory_sha256': sha(inventory), 'tool': 'omni-osm-review-leads-v1'}
    dump(output / 'coverage-report.json', report)
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'data/generated/m3/run-a')
    parser.add_argument('--output', type=Path, default=ROOT / 'data/generated/place-review')
    args = parser.parse_args()
    print(json.dumps(build(args.source, args.output), sort_keys=True))
