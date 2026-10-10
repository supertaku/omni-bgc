"""Read-only current-byte audit; writes aggregates only to this owned folder."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import platform

ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
PRIOR = Path('C:/Users/joshu/Documents/BGC')

def sha(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream, 'sha256').hexdigest()

def load(path): return json.loads(path.read_text(encoding='utf-8'))

entity = PRIOR / 'data/entities/pilot-entities.json'
old = load(entity)
content = {'entities': old['entities'], 'complexes': old['complexes']}
computed = hashlib.sha256(json.dumps(content, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')).hexdigest()
variants = {}
for name, sort, compact, ascii_only in [('documented', True, True, False), ('ascii_compact', True, True, True), ('default_spaces', True, False, False), ('unsorted_compact', False, True, False)]:
    options = dict(sort_keys=sort, ensure_ascii=ascii_only)
    if compact: options['separators'] = (',', ':')
    variants[name] = hashlib.sha256(json.dumps(content, **options).encode()).hexdigest()
ids = [e['entity_id'] for e in old['entities']]
entity_report = {'path': str(entity), 'bytes': entity.stat().st_size, 'current_file_sha256': sha(entity),
                 'M0_reviewed_file_sha256': '18d2cc189cf765c664e4190bfeb9bd257ce32437195e8339a05eb5fb7e9c202a',
                 'current_bytes_match_M0': sha(entity) == '18d2cc189cf765c664e4190bfeb9bd257ce32437195e8339a05eb5fb7e9c202a',
                 'claimed_content_sha256': old['content_sha256'], 'computed_content_sha256': computed,
                 'content_hash_matches': computed == old['content_sha256'], 'serialization_variant_hashes': variants,
                 'claimed_hash_matches_any_checked_variant': old['content_sha256'] in variants.values(),
                 'entity_count': len(ids), 'complex_count': len(old['complexes']), 'duplicate_entity_id_groups': sum(v > 1 for v in Counter(ids).values()),
                 'disposition': 'QUARANTINED_UNEXPLAINED_NO_REUSE',
                 'conclusion': 'Mismatch is exactly unchanged from independently accepted M0 audit. Four serialization probes do not explain the claimed checksum. Owner explanation/regeneration history unavailable; prior Git read denied by filesystem. No checksum or IDs modified.'}
pack = load(ROOT / 'data/manifests/offline-pilot-inventory.json')
pack_root = ROOT / 'apps/mobile/assets/generated/omni'
pack_results = []
for entry in pack['files']:
    path = pack_root / entry['path']
    found = path.exists()
    pack_results.append({'path': entry['path'], 'exists': found,
                         'actual_bytes': path.stat().st_size if found else None,
                         'actual_sha256': sha(path) if found else None,
                         'matches': found and path.stat().st_size == entry['bytes'] and sha(path) == entry['sha256']})
run_a = ROOT / 'data/generated/m4/comprehensive/geography/run-a'
run_b = ROOT / 'data/generated/m4/comprehensive/geography/run-b'
repeat = [{'file': name, 'sha256_a': sha(run_a / name), 'sha256_b': sha(run_b / name), 'byte_identical': (run_a / name).read_bytes() == (run_b / name).read_bytes()} for name in ('candidates.jsonl', 'summary.json', 'name-review.json', 'rejections.json')]
raw = load(PRIOR / 'data/raw/osm/bgc-2026-09-14T162150Z.json')
originals = {f"osm:{e['type']}:{e['id']}": e for e in raw['elements']}
records = [json.loads(line) for line in (run_a / 'candidates.jsonl').read_text(encoding='utf-8').splitlines()]
for record in records:
    original = originals[record['candidate_ref']]
    assert all(original.get('tags', {}).get(k) == v for k, v in record['tags'].items())
    assert record['source_timestamp'] == original.get('timestamp')
    assert record['source_version'] == original.get('version')
    assert record['navigation_eligible'] is False and record['publication_eligible'] is False
    assert record['district_membership'] == 'UNKNOWN' and record['verified_at'] is None
    assert not {'user', 'uid', 'changeset', 'phone', 'website', 'contact:email'}.intersection(record['tags'])
    if original['type'] == 'node': assert record['original_position_lon_lat'] == [original['lon'], original['lat']]
    if original['type'] == 'way':
        assert record['original_node_refs'] == original.get('nodes', [])
        if 'original_positions_lon_lat' in record:
            assert record['original_positions_lon_lat'] == [[p['lon'], p['lat']] for p in original['geometry']]
        assert 'original_position_lon_lat' not in record
    if original['type'] == 'relation':
        assert record['original_members'] == [{k: m[k] for k in ('type', 'ref', 'role') if k in m} for m in original.get('members', [])]
result = {'python_version': platform.python_version(), 'entity_manifest': entity_report,
          'current_pack': {'manifest_sha256': sha(ROOT / 'data/manifests/offline-pilot-inventory.json'), 'scope': pack['scope'], 'geometry_records': pack['geometry_records'], 'tiles': pack['tiles'], 'navigation_eligible_edges': pack['navigation_eligible_edges'], 'distribution_authorized': pack['distribution_authorized'], 'resource_bytes': sum(e['bytes'] for e in pack['files']), 'resource_checks': pack_results, 'all_nine_resource_hashes_pass': len(pack_results) == 9 and all(r['matches'] for r in pack_results), 'device_and_iOS_proof': 'NOT_RUN_CURRENT_RESEARCH'},
          'two_run_reproduction': repeat,
          'raw_record_fidelity': {'records_checked': len(records), 'original_identity_tags_positions_refs_timestamps_match': True, 'publication_or_navigation_eligible': 0, 'centroids_generated': 0, 'district_membership_inferred': 0}}
(HERE / 'current-byte-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'entity_quarantined': not entity_report['content_hash_matches'], 'entity_unchanged_from_M0': entity_report['current_bytes_match_M0'], 'pack_resources_match': result['current_pack']['all_nine_resource_hashes_pass'], 'two_run_identical': all(r['byte_identical'] for r in repeat)}))
