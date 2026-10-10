"""Aggregate research pointers and observed coverage. Never promote or publish."""
import argparse
from collections import Counter
import hashlib
import json
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def aggregate(paths, scope=None):
    scope = scope or load(ROOT / 'data/research/m4/program-scope.json')
    sources, candidates, searches, gaps, inputs = {}, {}, [], [], []
    for path in sorted(map(Path, paths), key=str):
        raw = path.read_bytes()
        doc = json.loads(raw)
        resolved=path.resolve()
        recorded_path=resolved.relative_to(ROOT).as_posix() if resolved.is_relative_to(ROOT) else resolved.as_posix()
        inputs.append({'path': recorded_path, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)})
        for source in doc.get('sources', []):
            key = source['source_id']
            if key in sources and sources[key] != source:
                raise ValueError('Conflicting research source ID: ' + key)
            sources[key] = source
        for candidate in doc.get('candidates', []):
            candidate = normalize_pointer(candidate)
            key = candidate['candidate_id']
            if candidate.get('approved') is True or candidate.get('publication_eligible') is True:
                raise ValueError('Research pointers cannot assert publication approval')
            if key in candidates and candidates[key] != candidate:
                raise ValueError('Conflicting research candidate ID: ' + key)
            candidates[key] = candidate
        searches.extend(doc.get('searches', []))
        gaps.extend(doc.get('gaps', []))
    matrix = Counter()
    unknown_zones, unknown_categories = Counter(), Counter()
    for candidate in candidates.values():
        source_ids = candidate.get('source_ids') or [candidate.get('source_id')]
        if not source_ids or any(s not in sources for s in source_ids):
            raise ValueError('Candidate lacks registered research source: ' + candidate['candidate_id'])
        zone = candidate.get('zone_id', 'unassigned')
        category = candidate.get('category', 'other')
        if zone not in scope['zones']: unknown_zones[zone] += 1
        if category not in scope['categories']: unknown_categories[category] += 1
        for source in sorted(set(source_ids)):
            matrix[(zone, category, source, candidate.get('status', 'RESEARCH_LEAD'))] += 1
    observed = Counter((c.get('zone_id', 'unassigned'), c.get('category', 'other')) for c in candidates.values())
    names = {}
    for candidate in candidates.values():
        name = candidate.get('name','')
        key = ' '.join(unicodedata.normalize('NFC',name).casefold().split()) if isinstance(name,str) else ''
        if key:names.setdefault(key,[]).append(candidate['candidate_id'])
    return {
        'format_version': 1, 'mode': 'INTERNAL_RESEARCH_POINTERS_ONLY',
        'inputs': inputs, 'source_count': len(sources), 'candidate_pointer_count': len(candidates),
        'approved_records': 0, 'exported_records': 0, 'coverage_denominator': None,
        'completeness_percentage': None, 'automatic_merges': 0,
        'count_note': 'Pointers are source observations, not resolved distinct establishments; sources may overlap. Historical OSM inventory is reported separately.',
        'sources': [sources[k] for k in sorted(sources)],
        'candidates': [candidates[k] for k in sorted(candidates)],
        'identity_review_groups': [{'normalized_name':name,'candidate_ids':sorted(ids),'decision':'UNRESOLVED_DO_NOT_MERGE'}
                                   for name,ids in sorted(names.items()) if len(ids)>1],
        'searches': searches, 'gaps': gaps,
        'coverage_matrix': [dict(zip(('zone_id', 'category', 'source_id', 'status'), key), observed_count=count)
                            for key, count in sorted(matrix.items())],
        'planned_zone_category_gaps': [{'zone_id': z, 'category': c, 'status': 'NO_CANDIDATE_POINTER_YET'}
                                      for z in scope['zones'] for c in scope['categories'] if not observed[(z, c)]],
        'unmapped_zones': dict(unknown_zones), 'unmapped_categories': dict(unknown_categories),
        'permissions_note': 'Research source permissions do not modify M1 source_use_policy or authorize mobile export.'
    }


def normalize_pointer(candidate):
    """Map geography pointer contract explicitly; never infer geographic membership."""
    if candidate.get('approved') is True or candidate.get('publication_eligible') is True:
        raise ValueError('Research pointers cannot assert publication approval')
    if 'candidate_id' in candidate: return candidate
    if 'lead_ref' not in candidate: raise ValueError('Unknown research pointer contract')
    category_map = {'park':'park_landmark','landmark_facility':'park_landmark',
        'medical_public_facility':'healthcare','parking':'parking','parking_identity_requires_review':'parking',
        'permanent_recreation_identity_ambiguous':'sport_fitness', 'static_transit_service_no_feed':'static_transit',
        'transit_facility_identity_requires_review':'static_transit',
        'external_rail_transfer_research':'static_transit','external_transfer_facility':'static_transit'}
    return candidate | {'candidate_id':candidate['lead_ref'],'name':candidate['display_name'],
        'category_detail':candidate['category'],'category':category_map.get(candidate['category'],'other'),
        'zone_id':'external-transfer-context' if candidate.get('district_membership')=='EXTERNAL_TRANSFER_CONTEXT' else 'unassigned',
        'approved':False,'publication_eligible':False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('inventories', nargs='+', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = aggregate(args.inventories)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + '\n', encoding='utf-8')
    print(json.dumps({k: report[k] for k in ('source_count', 'candidate_pointer_count', 'approved_records', 'coverage_denominator')}))


if __name__ == '__main__': main()
