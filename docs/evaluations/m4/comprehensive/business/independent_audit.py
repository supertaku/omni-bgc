"""Read-only audit of parent modules using disposable synthetic fixtures."""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[5]
def module(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded

capture = module('capture_audit', 'pipelines/etl/research/capture.py')
program = module('program_audit', 'pipelines/etl/research/program.py')
retrieval_tests = module('retrieval_fixture_audit', 'tests/data-quality/retrieval/test_retrieval.py')
results = []
fixture = retrieval_tests.RetrievalTests('test_branch_specific_menu_and_prices')
fixture.setUp()
try:
    fixture.db.execute("UPDATE fact SET value_json=? WHERE id='7-price'", (json.dumps({'amount': '350.00', 'currency': 'USD'}),))
    reader = fixture.reader()
    got = reader.find_menu_items(currency='PHP')
    results.append({'probe': 'currency_without_budget', 'result': 'FAIL_EXPECTED_FILTER' if len(got) != 1 else 'PASS', 'returned_ids': [r['id'] for r in got], 'expected_count': 1})
    fixture.db.execute("UPDATE fact SET valid_until='2026-10-05T00:00:00Z' WHERE id='1-name'")
    got = fixture.reader().find_places()
    results.append({'probe': 'expired_building_parent', 'result': 'PASS' if not got else 'PARENT_SEMANTICS_REVIEW', 'returned_count': len(got), 'returned_parent_ids': [r['parent_id'] for r in got], 'note': 'Current place results should exclude or mark unknown a parent whose name evidence expired.'})
    fixture.db.execute("UPDATE fact SET valid_until='2026-10-05T00:00:00Z' WHERE id='4-name'")
    got = fixture.reader().get_restaurant_menu(retrieval_tests.uid(2))
    results.append({'probe': 'stale_menu', 'result': 'PASS' if not got else 'FAIL', 'returned_count': len(got)})
finally:
    fixture.doCleanups()

try:
    parsed = capture.parse(b'[{"id":"first","id":"second"}]', 'json', {})
    results.append({'probe': 'duplicate_json_key', 'result': 'FAIL_EXPECTED_REJECTION', 'parsed': parsed, 'note': 'Duplicate upstream identity keys are silently overwritten; adapter should reject ambiguity.'})
except ValueError:
    results.append({'probe': 'duplicate_json_key', 'result': 'PASS', 'note': 'Duplicate JSON identity keys rejected.'})
for point in ([180, 90], [-180, -90], [121.05, 14.55]):
    capture.coordinate(point)
results.append({'probe': 'wgs84_range_edges', 'result': 'PASS'})
data = program.aggregate([ROOT / 'data/research/m4/business/inventory.json'])
results.append({'probe': 'business_aggregation', 'result': 'PASS' if not data['unmapped_zones'] and not data['unmapped_categories'] else 'FAIL', 'candidate_count': data['candidate_pointer_count'], 'source_count': data['source_count'], 'unmapped_zones': data['unmapped_zones'], 'unmapped_categories': data['unmapped_categories']})
status = 'CHANGES_REQUESTED' if any(r['result'].startswith('FAIL') for r in results) else ('PASS_WITH_SEMANTICS_NOTE' if any(r['result'] == 'PARENT_SEMANTICS_REVIEW' for r in results) else 'PASS')
report = {'reviewer': 'independent business research agent', 'status': status, 'scope': 'Read-only parent source audit, disposable synthetic fixtures, no parent source edits', 'results': results, 'reviewed_file_sha256': {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in ['pipelines/etl/research/capture.py','pipelines/etl/research/program.py','packages/database/retrieval.py','pipelines/etl/review-dashboard/dashboard.py']}}
(Path(__file__).parent / 'independent-audit.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
