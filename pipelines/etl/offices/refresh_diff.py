"""Compare private snapshots without asserting stable canonical identity or moves."""
import argparse
import json
from collections import Counter
from pathlib import Path

from import_directory import encode, sha
from normalize import match_key


def diff(previous, current):
    def fingerprints(report):
        if report.get('mode') != 'INTERNAL_OFFICE_RESEARCH_ONLY' or report.get('approved_records') != 0:
            raise ValueError('Only research snapshots may be compared')
        return Counter(sha(encode(row['raw_values'])) for row in report['candidates'])
    before, after = fingerprints(previous), fingerprints(current)
    removed, added = before - after, after - before
    suggestions = []
    for old in previous['candidates']:
        if sha(encode(old['raw_values'])) not in removed:
            continue
        possible = [r['candidate_id'] for r in current['candidates']
                    if sha(encode(r['raw_values'])) in added and match_key(old['company_name']) == match_key(r['company_name'])]
        if possible:
            suggestions.append({'previous_candidate_id': old['candidate_id'], 'possible_current_candidate_ids': possible,
                                'action': 'human_review_not_automatic_move_or_identity_link'})
    return {'mode': 'INTERNAL_OFFICE_REFRESH_REVIEW',
            'previous_snapshot_id': previous['source_snapshot_id'], 'current_snapshot_id': current['source_snapshot_id'],
            'unchanged_row_values': sum((before & after).values()), 'added_row_values': sum(added.values()),
            'removed_row_values': sum(removed.values()), 'rejected_before': len(previous['rejected']),
            'rejected_after': len(current['rejected']), 'identity_change_suggestions': suggestions,
            'automatic_promotions': 0, 'automatic_moves': 0, 'publication_allowed': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--previous', type=Path, required=True)
    parser.add_argument('--current', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    private = (Path(__file__).resolve().parents[3] / 'data/generated/offices').resolve()
    for path in (args.previous, args.current, args.output):
        if not path.resolve().is_relative_to(private) or path.resolve() == private:
            parser.error('Refresh inputs/outputs must stay below ignored data/generated/offices/')
    report = diff(json.loads(args.previous.read_text(encoding='utf-8')), json.loads(args.current.read_text(encoding='utf-8')))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    payload = encode(report)
    if args.output.exists() and args.output.read_bytes() != payload:
        raise ValueError('Existing diff differs; use a new output path')
    args.output.write_bytes(payload)
    print(json.dumps({'output': str(args.output), 'added_row_values': report['added_row_values'], 'removed_row_values': report['removed_row_values']}))


if __name__ == '__main__':
    main()
