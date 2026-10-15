"""Direct-input audit independent of candidate parsing/normalization logic."""
import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify(directory):
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    checksums = json.loads((directory / 'output-checksums.json').read_text(encoding='utf-8'))
    for artifact in manifest['files'] + checksums:
        target = (directory / artifact['path']).resolve()
        if not target.is_relative_to(directory.resolve()):
            raise ValueError('Snapshot file path escapes snapshot')
        content = target.read_bytes()
        if digest(content) != artifact['sha256'] or len(content) != artifact['bytes']:
            raise ValueError('Snapshot checksum mismatch')
    raw = (directory / 'input/directory.csv').read_bytes()
    # Use DictReader and the supplied original independently of the ETL row parser.
    with (directory / 'input/directory.csv').open(encoding='utf-8-sig', newline='') as stream:
        rows = list(csv.DictReader(stream))
    report = json.loads((directory / 'import-report.json').read_text(encoding='utf-8'))
    expected_id = 'sha256:' + digest(raw)
    if expected_id != report['source_snapshot_id'] or expected_id != manifest['source_snapshot_id']:
        raise ValueError('Snapshot identity mismatch')
    candidates = report['candidates']
    rejected = {r['source_row_ordinal']: r for r in report['rejected']}
    by_ordinal = {r['source_row_ordinal']: r for r in candidates}
    if (len(by_ordinal) != len(candidates) or set(by_ordinal) & set(rejected)
            or set(by_ordinal) | set(rejected) != set(range(1, len(rows) + 1))
            or report['input_rows'] != len(rows)
            or report['imported_rows'] != len(candidates) or report['rejected_rows'] != len(rejected)):
        raise ValueError('Row accounting mismatch')
    for ordinal, source in enumerate(rows, 1):
        if ordinal in rejected:
            continue
        candidate = by_ordinal[ordinal]
        if candidate['raw_values'] != source:
            raise ValueError('Raw value lineage mismatch')
        if candidate['candidate_id'] != f'research:offices:{expected_id}:row-{ordinal:04d}':
            raise ValueError('Provisional row identity mismatch')
        if (candidate['display_coordinate'] is not None or candidate['entrances']
                or candidate['publication_state'] != 'research_only' or candidate['verified_at'] is not None):
            raise ValueError('Unapproved office leaked into geographic/public fields')
    urls = {r['Source URL'].strip() for r in rows if r.get('Source URL', '').strip()}
    if urls != {s['canonical_url'] for s in report['sources']} or report['source_count'] != len(urls):
        raise ValueError('Source reconciliation mismatch')
    for source in report['sources']:
        if (source['web_snapshot_sha256'] is not None or source['fetched_at'] is not None
                or source['reviewer'] is not None or any(v != 'unknown' for v in source['rights'].values())):
            raise ValueError('Unsupported source retention/approval claim')
    if report['approved_records'] != 0 or report['exported_records'] != 0:
        raise ValueError('Unsupported publication claim')
    return {'result': 'PASS_DIRECT_INPUT_RECONCILIATION', 'input_rows': len(rows),
            'imported_rows': len(candidates), 'rejected_rows': len(rejected),
            'source_count': len(urls), 'district_distribution': dict(sorted(Counter(r['Subdistrict'] for r in rows if None not in r).items())),
            'approved_records': 0, 'exported_records': 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path, required=True)
    parser.add_argument('--seed-v2', action='store_true', help='Assert supplied 179-row v2 baseline and named leads')
    args = parser.parse_args()
    result = verify(args.snapshot)
    if args.seed_v2:
        with (args.snapshot / 'input/directory.csv').open(encoding='utf-8-sig', newline='') as stream:
            rows = list(csv.DictReader(stream))
        checks = {
            'rows': (len(rows), 179),
            'companies': (len({r['Company / organization'] for r in rows}), 173),
            'buildings': (len({r['Building / complex'] for r in rows}), 81),
            'sources': (len({r['Source URL'] for r in rows}), 108),
            'missing_floors': (sum(not r['Floor / suite'] for r in rows), 43),
        }
        leads = {'infor': 2, 'procter & gamble': 1, 'thinking machines': 1, 'digiplus': 1,
                 'hcltech': 3, 'sap philippines': 1, 'amazon web services': 1, 'lazada': 1}
        for query, count in leads.items():
            checks[query] = (sum(query in r['Company / organization'].casefold() for r in rows), count)
        if any(actual != expected for actual, expected in checks.values()):
            raise ValueError(f'Unexpected seed-v2 counts: {checks}')
        result['seed_v2_checks'] = {k: actual for k, (actual, _) in checks.items()}
    print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    main()
