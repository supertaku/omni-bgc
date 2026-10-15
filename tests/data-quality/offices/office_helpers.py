import csv
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'pipelines/etl/offices'))
sys.path.insert(0, str(ROOT / 'pipelines/etl/review-dashboard'))
import import_directory as importer
import dashboard
import offices_view
import refresh_diff
import verify_snapshot

__all__ = ['ROOT', 'CONFIG', 'importer', 'dashboard', 'offices_view', 'refresh_diff',
           'verify_snapshot', 'row', 'raw', 'compile_rows']

CONFIG = json.loads(importer.CONFIG.read_text(encoding='utf-8'))


def row(**overrides):
    values = {h: '' for h in importer.HEADERS}
    values.update({'Company / organization': 'Synthetic Company', 'Industry': 'Synthetic technology',
                   'Subdistrict': 'BGC Core', 'Building / complex': 'Synthetic Tower',
                   'Floor / suite': '12F', 'City': 'Taguig', 'Full office location': 'Synthetic Tower, Taguig',
                   'Presence classification': 'Corporate / operating office',
                   'Evidence type': 'Synthetic contact', 'Verification status': 'High',
                   'Source URL': 'https://example.invalid/contact', 'Research date': '2026-10-14',
                   'Evidence strength': 'High', 'Address precision': 'Building + floor/suite'})
    values.update(overrides)
    return values


def raw(rows, headers=importer.HEADERS):
    stream = io.StringIO(newline='')
    writer = csv.writer(stream)
    writer.writerow(headers)
    for r in rows:
        writer.writerow([r[h] for h in headers] if isinstance(r, dict) else r)
    return b'\xef\xbb\xbf' + stream.getvalue().encode('utf-8')


def compile_rows(rows):
    return importer.compile_snapshot(raw(rows), CONFIG)
