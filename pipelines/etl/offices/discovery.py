"""Generate local, bounded research work queues. No crawler or publication."""
import argparse
import json
from collections import defaultdict
from pathlib import Path
from import_directory import encode, sha


def build(report):
    industries = defaultdict(list)
    for row in report['candidates']:
        industries[row['industry_raw'] or 'Unclassified'].append(row['candidate_id'])
    buildings = [{
        'building_label': row['building_label'], 'district': row['district_code'],
        'candidate_ids': row['candidate_ids'], 'status': 'unsearched',
        'queries': [f'"{row["building_label"]}" official tenant directory',
                    f'"{row["building_label"]}" company contact office address'],
        'independent_inventory': None, 'coverage_denominator': None,
    } for row in report['building_index']]
    queues = {
        'building_first': buildings,
        'industry_first': [{'industry': name, 'candidate_ids': ids, 'status': 'unsearched',
                            'query': f'"{name}" BGC official office contact Philippines',
                            'independent_inventory': None} for name, ids in sorted(industries.items())],
        'evidence_first': [{'source_id': source['source_id'], 'url': source['canonical_url'],
                            'candidate_ids': source['candidate_ids'], 'rights': source['rights'],
                            'status': 'terms_access_retention_and_claim_review_required'} for source in report['sources']],
        'gaps_and_conflicts': [{'candidate_id': row['candidate_id'], 'company': row['company_name'],
                               'issues': row['review_issues'], 'status': 'needs_review'} for row in report['candidates']],
        'must_check_companies': report['company_regressions'],
    }
    return {'format_version': 'office-discovery-v1', 'source_snapshot_id': report['source_snapshot_id'],
            'queues': queues, 'coverage_denominator': None, 'coverage_percentage': None,
            'automatic_fetches': 0, 'automatic_approvals': 0, 'queue_sha256': sha(encode(queues))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = (Path(__file__).resolve().parents[3] / 'data/generated/offices').resolve()
    if not args.report.resolve().is_relative_to(root) or not args.output.resolve().is_relative_to(root):
        parser.error('Research input/output must stay in ignored office storage')
    result = build(json.loads(args.report.read_text(encoding='utf-8')))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(encode(result))
    print(json.dumps({'building_queues': len(result['queues']['building_first']),
                      'industry_queues': len(result['queues']['industry_first']), 'automatic_fetches': 0}))


if __name__ == '__main__':
    main()
