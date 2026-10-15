"""Import a supplied local directory into immutable, ignored research snapshots."""
import argparse
import csv
import hashlib
import io
import json
from collections import Counter
from pathlib import Path

from match_review import build_indexes
from normalize import HEADERS, normalize, source_issues
from workbook_audit import compare

ROOT = Path(__file__).resolve().parents[3]
VERSION = 'office-research-v1'
CONFIG = ROOT / 'data/research/offices/config-v1.json'


def encode(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8')


def sha(value):
    return hashlib.sha256(value).hexdigest()


def parse_csv(raw):
    reader = csv.reader(io.StringIO(raw.decode('utf-8-sig'), newline=''), strict=True)
    header = next(reader, None)
    if header != list(HEADERS):
        raise ValueError('Expected exact ordered 19-column v2 CSV header')
    rows, rejected = [], []
    for ordinal, cells in enumerate(reader, 1):
        if len(cells) != len(HEADERS):
            rejected.append({'source_row_ordinal': ordinal, 'raw_cells': cells,
                             'reason': 'row_width', 'expected': len(HEADERS), 'actual': len(cells)})
        else:
            rows.append((ordinal, dict(zip(HEADERS, cells))))
    return rows, rejected


def compile_snapshot(raw, config):
    snapshot_id = 'sha256:' + sha(raw)
    rows, rejected = parse_csv(raw)
    candidates, sources = [], {}
    for ordinal, row in rows:
        record = normalize(row, config)
        candidate_id = f'research:offices:{snapshot_id}:row-{ordinal:04d}'
        url = record['source_url']
        source_id = 'research:office-source:' + sha((url or '').encode()) if url else None
        record.update({'candidate_id': candidate_id, 'source_row_ordinal': ordinal,
                       'source_snapshot_id': snapshot_id, 'raw_values': row,
                       'source_ids': [source_id] if source_id else [], 'evidence_ids': []})
        candidates.append(record)
        if source_id:
            entry = sources.setdefault(source_id, {
                'source_id': source_id, 'canonical_url': url, 'owner': None,
                'source_kind': None, 'license': None,
                'rights': {k: 'unknown' for k in ('internal_retain', 'transform', 'redistribute_offline', 'images', 'geography')},
                'web_snapshot_sha256': None, 'source_published_at': None,
                'fetched_at': None, 'reviewer': None, 'reviewed_at': None, 'valid_until': None,
                'review_status': 'unreviewed', 'candidate_ids': [], 'issues': source_issues(url),
            })
            entry['candidate_ids'].append(candidate_id)
    buildings, queue, regressions = build_indexes(candidates, config)
    for rejected_row in rejected:
        rejected_row['source_snapshot_id'] = snapshot_id
        rejected_row['candidate_id'] = f'research:offices:{snapshot_id}:row-{rejected_row["source_row_ordinal"]:04d}'
    ledger = list(sorted(sources.values(), key=lambda s: s['source_id']))
    # A checksum of link metadata is explicitly not a checksum of a fetched page.
    for entry in ledger:
        entry['metadata_sha256'] = sha(encode(entry))
    report = {
        'mode': 'INTERNAL_OFFICE_RESEARCH_ONLY', 'format_version': VERSION,
        'source_snapshot_id': snapshot_id, 'config_sha256': sha(encode(config)),
        'input_rows': len(rows) + len(rejected), 'imported_rows': len(candidates),
        'rejected_rows': len(rejected), 'approved_records': 0, 'exported_records': 0,
        'distinct_company_name_strings': len({r['raw_values']['Company / organization'] for r in candidates}),
        'distinct_building_labels': len({r['raw_values']['Building / complex'] for r in candidates}),
        'unresolved_building_groups': len(buildings), 'source_count': len(sources),
        'district_distribution': dict(sorted(Counter(r['district'] or 'unknown' for r in candidates).items())),
        'evidence_strength_distribution': dict(sorted(Counter(r['evidence_strength_raw'] or 'unknown' for r in candidates).items())),
        'address_precision_distribution': dict(sorted(Counter(r['address_precision_raw'] or 'unknown' for r in candidates).items())),
        'missing_floor_rows': sum(r['floor_raw'] is None for r in candidates),
        'unknown_building_rows': sum(r['building_name'] is None for r in candidates),
        'issue_counts': dict(sorted(Counter(issue for r in candidates for issue in r['review_issues']).items())),
        'review_rows': len(candidates), 'duplicates_rejected': 0,
        'exact_duplicate_groups': sum(q['kind'] == 'exact_duplicate_rows' for q in queue),
        'coverage_denominator': None, 'coverage_percentage': None,
        'company_regressions': regressions,
        'sources': ledger, 'building_index': buildings, 'identity_review_groups': queue,
        'candidates': candidates, 'rejected': rejected,
    }
    return report


def snapshot_files(csv_path, xlsx_path=None):
    raw = csv_path.read_bytes()
    if len(raw) > 10_000_000:
        raise ValueError('CSV size limit exceeded')
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    report = compile_snapshot(raw, config)
    files = {'input/directory.csv': raw}
    manifest = {'format_version': VERSION, 'source_snapshot_id': report['source_snapshot_id'],
                'rights_status': 'research_only_unknown_third_party_rights',
                'retention_basis': 'user_supplied_local_files_for_requested_internal_review',
                'producer': {'version': VERSION, 'code_sha256': {
                    name: sha((Path(__file__).parent / name).read_bytes())
                    for name in ('import_directory.py', 'normalize.py', 'match_review.py', 'workbook_audit.py')}},
                'files': [{'path': 'input/directory.csv', 'supplied_filename': csv_path.name,
                           'sha256': sha(raw), 'bytes': len(raw)}]}
    if xlsx_path:
        workbook = xlsx_path.read_bytes()
        if len(workbook) > 10_000_000:
            raise ValueError('Workbook size limit exceeded')
        files['input/directory.xlsx'] = workbook
        manifest['files'].append({'path': 'input/directory.xlsx', 'supplied_filename': xlsx_path.name,
                                  'sha256': sha(workbook), 'bytes': len(workbook)})
        _, rejected = parse_csv(raw)
        if rejected:
            raise ValueError('Workbook comparison requires well-formed CSV rows')
        report['workbook_audit'] = compare(io.BytesIO(workbook), HEADERS, [r['raw_values'] for r in report['candidates']])
    files.update({
        'manifest.json': encode(manifest), 'import-report.json': encode(report),
        'candidates.json': encode({'format_version': VERSION, 'mode': report['mode'],
                                 'source_snapshot_id': report['source_snapshot_id'], 'candidates': report['candidates']}),
        'source-catalog.json': encode(report['sources']), 'building-review-index.json': encode(report['building_index']),
        'review-queue.json': encode({'row_reviews': [{'candidate_id': r['candidate_id'], 'issues': r['review_issues']}
                                                   for r in report['candidates']],
                                   'identity_reviews': report['identity_review_groups'], 'rejected': report['rejected']}),
    })
    inventory = [{'path': path, 'sha256': sha(content), 'bytes': len(content)} for path, content in sorted(files.items())]
    files['output-checksums.json'] = encode(inventory)
    return files, report


def write_snapshot(output, files):
    # Replay is read-only. Existing or interrupted snapshots are never overwritten.
    if output.exists():
        existing = {str(p.relative_to(output)).replace('\\', '/') for p in output.rglob('*') if p.is_file()}
        if existing != set(files) or any((output / k).read_bytes() != v for k, v in files.items()):
            raise ValueError('Snapshot exists with different/incomplete bytes; use a new output path')
        return 'identical_replay'
    output.parent.mkdir(parents=True, exist_ok=True)
    # Single rename publishes a complete local research snapshot, never a public pack.
    import tempfile
    import shutil
    temporary = Path(tempfile.mkdtemp(prefix='.office-import-', dir=output.parent))
    try:
        for name, content in files.items():
            path = temporary / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        temporary.rename(output)
    finally:
        if temporary.exists():
            if not temporary.resolve().is_relative_to(output.parent.resolve()):
                raise ValueError('Temporary snapshot cleanup target escapes output parent')
            shutil.rmtree(temporary)
    return 'created'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', required=True, type=Path)
    parser.add_argument('--xlsx', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    files, report = snapshot_files(args.csv, args.xlsx)
    base = (ROOT / 'data/generated/offices').resolve()
    build_id = sha(files['output-checksums.json'])
    output = (args.output or base / 'snapshots' / report['source_snapshot_id'].split(':')[1] / build_id).resolve()
    if not output.is_relative_to(base) or output == base:
        parser.error('Outputs must stay in ignored data/generated/offices/ below its root')
    result = write_snapshot(output, files)
    print(json.dumps({'result': result, 'output': str(output), 'input_rows': report['input_rows'],
                      'imported_rows': report['imported_rows'], 'rejected_rows': report['rejected_rows'],
                      'approved_records': 0, 'exported_records': 0}))


if __name__ == '__main__':
    main()
