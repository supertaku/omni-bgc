"""Verify one immutable R4 metadata erratum. Does not build, sign, or contact devices.

The original R4 workflow, receipt and APK remain unchanged. Only a recorded
Metro byte count is corrected; no hash or source-content exception is allowed.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / '.g/ai-host-r4'
ORIGINAL = {
    'Omni-BGC-AI-preview-arm64.apk': '1f5fa8bd0b2cd0b3ec7af5002977f6d5dfdc21a463e3d05c2341e0d88dd9be7e',
    'frozen-source-snapshot.zip': '4ddc3c2262fe697ac033bee8c352df37b03f9e1a63f8034a69cf3cbfd4051424',
    'source-receipt.json': '93a002260356fba7963ed8cbff0e9806f18440ae9bfc533fbecbf9db3498ff14',
    'apk-verification.json': 'c87617b428adbda941bba2c3063781fe598f2b1edc8ead73be2b535ee662adbf',
}
ORIGINAL_WORKFLOW = 'f7d95149859f182bb002f00312af8f26f7bebbfae8a3628b98ab7a78b36d4c9f'
METRO = 'apps/mobile/metro.config.js'
APP_ROOTS = ('apps/mobile/', 'packages/', 'data/manifests/', 'docs/geography/')


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def audit():
    for name, expected in ORIGINAL.items():
        require(sha(STAGE / name) == expected, 'Immutable original changed: ' + name)
    receipt = load(STAGE / 'source-receipt.json')
    result = load(STAGE / 'apk-verification.json')
    require(receipt['build_workflow_sha256'] == ORIGINAL_WORKFLOW == result['build_workflow_sha256'], 'Original workflow binding differs')
    require(sha(STAGE / 'scripts/build-offline-ai-host.py') == ORIGINAL_WORKFLOW, 'Original staged workflow differs')
    mismatches, inspected = [], []
    with ZipFile(STAGE / 'frozen-source-snapshot.zip') as archive:
        require(archive.testzip() is None, 'Snapshot CRC failure')
        rows = receipt['frozen_sources']
        require(len(rows) == 370 and len({row['path'] for row in rows}) == 370, 'Unexpected snapshot inventory')
        require(set(archive.namelist()) == {row['path'] for row in rows}, 'Snapshot entries differ')
        for row in rows:
            data = archive.read(row['path'])
            actual_hash = digest(data)
            require(actual_hash == row['sha256'] == sha(STAGE / row['path']), 'Snapshot/stage hash mismatch: ' + row['path'])
            require(len(data) == (STAGE / row['path']).stat().st_size, 'Snapshot/stage length mismatch: ' + row['path'])
            if len(data) != row['bytes']:
                mismatches.append({'path': row['path'], 'recorded_bytes': row['bytes'], 'corrected_bytes': len(data), 'sha256': actual_hash})
            inspected.append({'path': row['path'], 'bytes': len(data), 'sha256': actual_hash})
    require(len(mismatches) == 1 and mismatches[0]['path'] == METRO and mismatches[0]['recorded_bytes'] == 662 and mismatches[0]['corrected_bytes'] == 655, 'Only exact known Metro size erratum permitted')
    spec = importlib.util.spec_from_file_location('omni_host_build_audit', ROOT / 'scripts/build-offline-ai-host.py')
    workflow = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(workflow)
    current = {row['path']: row for row in workflow.authored_files()}
    authored = {row['path']: row for row in receipt['authored_sources']}
    expected_app = {path for path in authored if path.startswith(APP_ROOTS)}
    actual_app = {path for path in current if path.startswith(APP_ROOTS)}
    require(expected_app == actual_app, 'Current application source inventory differs')
    for path in expected_app:
        require(current[path]['sha256'] == authored[path]['sha256'] and current[path]['bytes'] == authored[path]['bytes'], 'Current authored application source differs: ' + path)
    for name, expected in result['logs'].items():
        require(sha(STAGE / name) == expected, 'Original build/audit log changed: ' + name)
    for name, expected in result['generated_android_hashes'].items():
        require(sha(STAGE / name) == expected, 'Generated Android evidence changed: ' + name)
    require(workflow.dependency_identity(STAGE / 'apps/mobile') == receipt['dependency_identity'] == result['dependency_identity'], 'Dependency metadata drift')
    tests, xml_hashes = 0, {}
    for xml in (STAGE / 'apps/mobile/modules/omni-local-ai/android/build/test-results/testReleaseUnitTest').glob('*.xml'):
        report = ET.parse(xml).getroot()
        require(all(int(report.attrib.get(key, '0')) == 0 for key in ('failures', 'errors', 'skipped')), 'Native unit-test failure')
        tests += int(report.attrib['tests'])
        xml_hashes[xml.name] = sha(xml)
    require(tests == 7, 'Expected seven final native tests')
    certificate = {
        'status': 'HOST_STATIC_VERIFIED_WITH_EXPLICIT_RECEIPT_SIZE_ERRATUM',
        'original_artifacts_sha256': ORIGINAL,
        'original_build_workflow_sha256': ORIGINAL_WORKFLOW,
        'corrected_future_build_workflow_sha256': sha(ROOT / 'scripts/build-offline-ai-host.py'),
        'audit_workflow_sha256': sha(Path(__file__)),
        'corrections': mismatches,
        'all_370_snapshot_and_staged_source_hashes_match_original_receipt': True,
        'all_370_snapshot_and_staged_byte_lengths_match_each_other': True,
        'current_authored_application_inventory_and_content_match_original': True,
        'current_app_source_files_verified': len(expected_app),
        'inspected_frozen_sources': inspected,
        'original_logs_and_generated_android_hashes_unchanged': True,
        'dependency_metadata_unchanged': True,
        'native_tests': {'tests': tests, 'failures': 0, 'xml_sha256': xml_hashes},
        'scope': 'Receipt byte-count metadata correction only; original build workflow/receipt/APK/ZIP preserved. No Android rebuild or inference claim.',
        'physical_device_tested': False,
        'on_device_inference': 'NOT_RUN_PENDING_M10',
        'distribution_authorized': False,
    }
    return certificate


if __name__ == '__main__':
    target = STAGE / 'receipt-erratum.json'
    require(not target.exists(), 'Preserve erratum evidence; refusing overwrite')
    certificate = audit()
    target.write_text(json.dumps(certificate, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': certificate['status'], 'certificate': str(target), 'sha256': sha(target), 'corrections': certificate['corrections']}))
