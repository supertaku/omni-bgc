"""Record explicit parent revisions without changing historical lane evidence."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[4]
lane = root / 'docs/evaluations/m1/governance/artifact-manifest.json'
original = json.loads(lane.read_text(encoding='utf-8'))
records = []
changed = []
for old in original['records']:
    p = root / old['path']
    updated = {'path': old['path'], 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
    if updated['sha256'] != old['sha256']:
        changed.append({'path': old['path'], 'lane_sha256': old['sha256'], 'parent_sha256': updated['sha256']})
    records.append(updated)
assert {c['path'] for c in changed} == {'pipelines/sources/governance.py', 'pipelines/sources/test_governance.py'}
result = {'status': 'PARENT_REVIEW_CANDIDATE', 'created_at_utc': datetime.now(timezone.utc).isoformat(),
          'historical_lane_manifest_sha256': hashlib.sha256(lane.read_bytes()).hexdigest(),
          'reason': 'Independent probes found free-text placeholder approval and padded raster kind gaps; parent now rejects trimmed/case-insensitive placeholders and tests every required metadata field.',
          'changed_records': changed, 'records': records}
(Path(__file__).parent / 'governance-final-manifest.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'records': len(records), 'changed_records': changed}, indent=2))
