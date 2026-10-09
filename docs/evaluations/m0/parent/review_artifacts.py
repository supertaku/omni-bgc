"""Parent final identity reconciliation; no dependencies or device actions."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
EVAL = HERE.parent
checks = []


def verify(path, digest, size=None):
    path = Path(path).resolve()
    assert path.is_relative_to(ROOT), f'Outside workspace: {path}'
    content = path.read_bytes()
    assert hashlib.sha256(content).hexdigest().lower() == digest.lower(), path
    if size is not None:
        assert len(content) == int(size), path
    checks.append(path.relative_to(ROOT).as_posix())


with (EVAL / 'sources/artifact-checksums.csv').open(encoding='utf-8-sig', newline='') as stream:
    for row in csv.DictReader(stream):
        verify(row['path'], row['sha256'], row['bytes'])
for name, item in json.loads((EVAL / 'gis/evidence-sha256.json').read_text(encoding='utf-8-sig')).items():
    verify(EVAL / 'gis' / name, item['sha256'], item['bytes'])
mobile = json.loads((EVAL / 'mobile/evidence-manifest.json').read_text(encoding='utf-8-sig'))
for item in mobile['Evidence']:
    verify(EVAL / 'mobile' / item['Path'], item['SHA256'], item['Bytes'])
native = json.loads((EVAL / 'mobile/logs/native-evidence-sha256.json').read_text(encoding='utf-8-sig'))
for item in native:
    verify(ROOT / item['Path'], item['SHA256'], item['Bytes'])
apk_identity = json.loads((EVAL / 'mobile/logs/apk-identities-final.json').read_text(encoding='utf-8-sig'))
assert len({item['SHA256'] for item in apk_identity}) == 1
for item in apk_identity:
    verify(item['Path'], item['SHA256'], item['Bytes'])
original = json.loads((HERE / 'initial-files.json').read_text(encoding='utf-8-sig'))
appended = {'docs/DECISION_JOURNAL.md', 'docs/TOOL_RATIONALE.md'}
for item in original:
    if item['path'] not in appended:
        verify(ROOT / item['path'], item['sha256'], item['bytes'])

audit = json.loads((EVAL / 'mobile/logs/npm-audit-final.json').read_text(encoding='utf-8-sig'))
assert audit['metadata']['vulnerabilities'] == dict(info=0, low=0, moderate=8, high=16, critical=0, total=24)
markers = (HERE / 'physical-native-markers.log').read_text(encoding='utf-8-sig')
for marker in ('lifecycle cycle 1 closed', 'lifecycle cycle 2 closed', 'M0_SQLITE PASS', 'close/reopen=ok', 'M0_MAP PASS'):
    assert marker in markers, marker
physical = json.loads((HERE / 'independent-physical-review.json').read_text(encoding='utf-8-sig'))
assert physical['physical'] and physical['native_process_stable_60_seconds']
assert physical['parent_phone_rerun'] == 'PASS'
result = {
    'status': 'PASS', 'verified_manifest_entries': len(checks),
    'protected_original_files_unchanged': len(original) - len(appended),
    'shared_original_changes': sorted(appended),
    'final_audit': audit['metadata']['vulnerabilities'],
    'saved_native_lifecycle_markers_verified': True,
    'verified_paths': checks,
    'scope': 'Artifact identity, protected originals and saved-test evidence; not license or production approval',
}
(HERE / 'artifact-integrity.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')

paths = []
for base in (EVAL, ROOT / 'docs/architecture', ROOT / 'docs/milestone-handoffs'):
    paths.extend(p for p in base.rglob('*') if p.is_file())
paths.extend(ROOT / item for item in appended)
paths.extend(p for p in (ROOT / 'apps/mobile').iterdir() if p.is_file())
for name in ('fixtures', 'scripts'):
    paths.extend(p for p in (ROOT / 'apps/mobile' / name).rglob('*') if p.is_file())
paths.append(ROOT / 'apps/mobile/artifacts/m0-arm64-final.apk')
entries = []
for path in sorted(set(paths)):
    if path == HERE / 'final-artifacts.json' or path.name == 'metro-sqlite-lifecycle.log':
        continue
    content = path.read_bytes()
    entries.append(dict(path=path.relative_to(ROOT).as_posix(), bytes=len(content), sha256=hashlib.sha256(content).hexdigest()))
(HERE / 'final-artifacts.json').write_text(json.dumps({
    'scope': 'Final authored app/report/evidence files plus retained debug APK; excludes self, live Metro log and generated caches/native outputs',
    'artifacts': entries,
}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in result.items() if k != 'verified_paths'}))
