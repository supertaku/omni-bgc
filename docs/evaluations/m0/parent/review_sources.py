"""Independent M0 inventory review; no data acquisition or publication."""
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[4]
SOURCES = ROOT / 'docs/evaluations/m0/sources'
baseline = (ROOT / 'docs/data-source-register/source-register.csv').read_text(encoding='utf-8-sig').strip()
with (SOURCES / 'source-inventory.csv').open(encoding='utf-8-sig', newline='') as stream:
    reader = csv.DictReader(stream)
    assert ','.join(reader.fieldnames) == baseline
    rows = list(reader)
assert len(rows) == 11
assert len({row['source_id'] for row in rows}) == len(rows)
canonical = []
for row in rows:
    uri = urlsplit(row['source_url_or_document'])
    assert uri.scheme == 'https' and uri.netloc
    canonical.append((uri.scheme.lower(), uri.netloc.lower(), uri.path.rstrip('/'), uri.query))
    assert not row['raw_sha256'], 'Documentation-only inventory cannot invent raw data hashes'
    assert row['review_status'] in {'CANDIDATE', 'RESEARCH_ONLY'}
assert len(set(canonical)) == len(rows)
by_id = {row['source_id']: row for row in rows}
for key in ['M0-SRC-007', 'M0-SRC-010', 'M0-SRC-011']:
    row = by_id[key]
    assert row['redistribution_allowed'] == 'UNKNOWN'
    assert row['images_allowed'] == 'UNKNOWN'
    assert row['menu_text_allowed'] == 'UNKNOWN'
assert by_id['M0-SRC-005']['redistribution_allowed'] == 'false'
assert 'Internal Error' in by_id['M0-SRC-009']['restriction_notes']

# Parent counterexample: even a source with conditional raw-data permission
# and public discoverability is not an approved dataset or licensed media.
osm = by_id['M0-SRC-001']
assert osm['redistribution_allowed'] == 'true'
assert osm['review_status'] == 'CANDIDATE' and not osm['raw_sha256']
assert osm['images_allowed'] == 'UNKNOWN' and osm['menu_text_allowed'] == 'UNKNOWN'

assets = []
with (SOURCES / 'local-concept-assets.csv').open(encoding='utf-8-sig', newline='') as stream:
    for row in csv.DictReader(stream):
        path = Path(row['path'])
        if not path.is_absolute():
            path = ROOT / path
        assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256']
        assets.append(row)
assert len(assets) == 4
result = {
    'parent_independent_source_checks': 'PASS',
    'records': len(rows), 'status_counts': dict(Counter(row['review_status'] for row in rows)),
    'redistribution_unknown': sum(row['redistribution_allowed'] == 'UNKNOWN' for row in rows),
    'approved': 0, 'acquired_raw_datasets': 0, 'raw_hashes': 0,
    'duplicate_ids': 0, 'duplicate_canonical_urls': 0, 'concept_hashes_verified': len(assets),
    'parent_counterexample': 'Conditional OSM raw permission is not dataset approval or media/menu permission',
    'scope': 'Inventory consistency only; no legal signoff or exporter implementation',
}
print(json.dumps(result, indent=2))
