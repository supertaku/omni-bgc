"""Validate research-pointer safety, never approve sources or facts."""
import hashlib
import json
import platform
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
INVENTORY = ROOT / 'data/research/m4/business/inventory.json'
data = json.loads(INVENTORY.read_text(encoding='utf-8'))
scope = json.loads((ROOT / 'data/research/m4/program-scope.json').read_text(encoding='utf-8'))
source_ids = [s['source_id'] for s in data['sources']]
candidate_ids = [c['candidate_id'] for c in data['candidates']]
assert len(source_ids) == len(set(source_ids))
assert len(candidate_ids) == len(set(candidate_ids))
assert data['source_count'] == len(source_ids)
assert data['candidate_count'] == len(candidate_ids)
assert data['approved_count'] == data['exported_count'] == data['raw_acquisition_count'] == 0
assert data['denominator'] is None and data['coverage_percentage'] is None
for source in data['sources']:
    assert source['status'] == 'RESEARCH_ONLY'
    assert set(source['categories']) <= set(scope['categories'])
    assert set(source['zones']) <= set(scope['zones'])
    assert source['raw_sha256'] is None and not source['raw_snapshot_retained']
    for use in ('store_facts', 'retain_raw', 'transform', 'redistribute_offline', 'menu_text', 'images', 'geographic_data'):
        assert source['permissions'][use] == 'UNKNOWN'
for candidate in data['candidates']:
    assert candidate['status'] == 'RESEARCH_LEAD'
    assert candidate['approved'] is False and candidate['publication_eligible'] is False
    assert candidate['source_id'] in source_ids
    assert set(candidate['source_ids']) <= set(source_ids)
    assert candidate['category'] in scope['categories']
    assert candidate['zone_id'] in scope['zones']
    assert candidate['coordinate'] is None and candidate['entrance'] is None
    assert not ({'description', 'menu_items', 'prices', 'images', 'phone', 'email'} & candidate.keys())
    assert candidate['field_evidence']
    for evidence in candidate['field_evidence']:
        assert evidence['url'].startswith('https://')
        assert evidence['observed_date'] == '2026-10-10'
        assert evidence['fact_status'] == 'UNAPPROVED_POINTER_ONLY'
        assert evidence['value_retained'] is None or evidence['field'] == 'name'
for group in ('searches', 'gaps'):
    for row in data[group]:
        assert row['category'] in scope['categories']
result = {
    'status': 'PASS_STRUCTURAL_QA_ONLY',
    'python_version': platform.python_version(),
    'inventory_sha256': hashlib.sha256(INVENTORY.read_bytes()).hexdigest(),
    'sources': len(source_ids), 'candidate_pointers': len(candidate_ids),
    'searches': len(data['searches']), 'subtype_gaps': len(data['gaps']),
    'approved': 0, 'exported': 0, 'denominator': None,
    'source_metadata_sha256': {s['source_id']: hashlib.sha256(json.dumps(s, sort_keys=True, ensure_ascii=False).encode()).hexdigest() for s in data['sources']},
    'checksums_scope': 'Locally authored source metadata only. No raw dataset acquired; no invented raw hash.',
    'rejected_duplicates': 0,
    'sample_qa_ids': ['m4-business-candidate-adidas-c1', 'm4-business-candidate-adidas-parkade', 'm4-business-candidate-affinity-one', 'm4-business-candidate-affinity-stopover', 'm4-business-candidate-philhealth', 'm4-business-candidate-wildflour-six', 'm4-business-candidate-wildflour-uptown', 'm4-business-candidate-toni'],
    'real_world_verification': 'PENDING', 'rights_review': 'PENDING', 'parent_review': 'PENDING'
}
(Path(__file__).parent / 'validation.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k != 'source_metadata_sha256'}, indent=2))
