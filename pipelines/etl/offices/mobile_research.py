"""Private opt-in researcher view. Never a public Places/Assistant projection."""
import argparse
import json
from pathlib import Path
from import_directory import encode

ROOT = Path(__file__).resolve().parents[3]


def project(report):
    if report['mode'] != 'INTERNAL_OFFICE_RESEARCH_ONLY' or report['approved_records'] != 0:
        raise ValueError('Only unapproved research reports supported')
    rows = [{
        'candidateId': row['candidate_id'], 'name': row['company_name'], 'industry': row['industry_raw'],
        'district': row['district'], 'building': row['building_name'], 'floor': row['floor_raw'],
        'address': row['full_address'], 'presenceClaim': row['presence_claim_raw'],
        'researchDate': row['research_date'], 'evidenceStrength': row['evidence_strength_raw'],
        'sourceUrl': row['source_url'], 'issues': row['review_issues'],
    } for row in report['candidates']]
    return {'version': 'office-research-mobile-v1', 'origin': 'internal_research',
            'sourceSnapshotId': report['source_snapshot_id'], 'candidates': rows,
            'publicationAuthorized': False, 'mapPoints': 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path); parser.add_argument('--empty', action='store_true')
    args = parser.parse_args()
    if args.empty == bool(args.report):
        parser.error('Choose --report or --empty')
    document = {'version':'office-research-mobile-v1','origin':'internal_research','candidates':[],
                'publicationAuthorized':False,'mapPoints':0,'sourceSnapshotId':None}
    if args.report:
        if not args.report.resolve().is_relative_to((ROOT / 'data/generated/offices').resolve()):
            parser.error('Research input must stay in ignored office storage')
        document = project(json.loads(args.report.read_text(encoding='utf-8')))
    output = ROOT / 'apps/mobile/assets/generated/offices/research.json'
    output.parent.mkdir(parents=True, exist_ok=True); output.write_bytes(encode(document))
    print(json.dumps({'output':str(output),'research_candidates':len(document['candidates']),'canonical_places':0}))


if __name__ == '__main__':
    main()
