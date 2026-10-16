"""Host receipt failure-mode tests. Never builds Android or invokes ADB."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('omni_host_build', REPO / 'scripts/build-offline-ai-host.py')
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)


class HostReceiptTests(unittest.TestCase):
    def setUp(self):
        base = REPO / '.g/ai-layer/build-receipt-tests'
        base.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=base)
        self.root = Path(self.temporary.name).resolve()
        self.assertEqual(self.root.parent, base.resolve())

    def tearDown(self):
        self.temporary.cleanup()

    def write(self, relative, value):
        target = self.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(value if isinstance(value, str) else json.dumps(value), encoding='utf-8')
        return target

    def test_streaming_sha_matches_known_artifact_and_changes_with_content(self):
        file = self.write('artifact.bin', 'abc')
        self.assertEqual(BUILD.sha(file), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
        file.write_text('abd', encoding='utf-8')
        self.assertNotEqual(BUILD.sha(file), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')

    def test_frozen_source_drift_fails_before_build(self):
        source = self.write('stage/source.ts', 'export const fixture = 1;')
        self.write('stage/source-receipt.json', {'build_workflow_sha256': BUILD.sha(Path(BUILD.__file__)),
                   'frozen_sources': [{'path': 'source.ts', 'bytes': source.stat().st_size, 'sha256': BUILD.sha(source)}]})
        self.assertTrue(BUILD.frozen(self.root / 'stage'))
        source.write_text('export const fixture = 2;', encoding='utf-8')
        with self.assertRaisesRegex(RuntimeError, 'Frozen source changed'):
            BUILD.frozen(self.root / 'stage')

    def test_workflow_drift_fails_before_build(self):
        self.write('stage/source-receipt.json', {'build_workflow_sha256': '0' * 64, 'frozen_sources': []})
        with self.assertRaisesRegex(RuntimeError, 'Build workflow changed'):
            BUILD.frozen(self.root / 'stage')

    def test_normalized_staged_records_recompute_length_and_hash(self):
        source = self.write('stage/metro.config.js', '')
        source.write_bytes(b'short\n')
        original = {'path': 'metro.config.js', 'bytes': 662, 'sha256': '0' * 64}
        row = BUILD.staged_records(self.root / 'stage', [original])[0]
        self.assertEqual(row['bytes'], 6)
        self.assertEqual(row['sha256'], BUILD.sha(source))
        self.assertEqual(original['bytes'], 662)

    def test_incorrect_frozen_byte_metadata_is_rejected_even_with_valid_hash(self):
        source = self.write('stage/source.ts', 'fixture')
        self.write('stage/source-receipt.json', {'build_workflow_sha256': BUILD.sha(Path(BUILD.__file__)),
                   'frozen_sources': [{'path': 'source.ts', 'bytes': 999, 'sha256': BUILD.sha(source)}]})
        with self.assertRaisesRegex(RuntimeError, 'Frozen source byte count differs'):
            BUILD.frozen(self.root / 'stage')

    def dependencies(self):
        entry = {'version': '1.2.3', 'resolved': 'https://registry.invalid/fixture.tgz', 'integrity': 'sha512-FIXTURE'}
        lock = {'lockfileVersion': 3, 'packages': {'': {'name': 'host-fixture'}, 'node_modules/fixture': entry}}
        self.write('mobile/package-lock.json', lock)
        self.write('mobile/node_modules/.package-lock.json', {'packages': {'node_modules/fixture': entry}})
        self.write('mobile/node_modules/fixture/package.json', {'name': 'fixture', 'version': '1.2.3'})
        return lock

    def test_dependency_identity_binds_pinned_lock_and_actual_manifest(self):
        self.dependencies()
        result = BUILD.dependency_identity(self.root / 'mobile')
        self.assertEqual(len(result['checked']), 1)
        self.assertEqual(result['checked'][0]['version'], '1.2.3')
        self.assertEqual(result['checked'][0]['manifest_sha256'], BUILD.sha(self.root / 'mobile/node_modules/fixture/package.json'))
        self.assertEqual(result['package_lock_sha256'], BUILD.sha(self.root / 'mobile/package-lock.json'))

    def test_dependency_version_and_integrity_drift_are_rejected(self):
        self.dependencies()
        self.write('mobile/node_modules/fixture/package.json', {'version': '9.9.9'})
        with self.assertRaisesRegex(RuntimeError, 'Installed package version differs'):
            BUILD.dependency_identity(self.root / 'mobile')
        self.dependencies()
        installed = json.loads((self.root / 'mobile/node_modules/.package-lock.json').read_text(encoding='utf-8'))
        installed['packages']['node_modules/fixture']['integrity'] = 'sha512-TAMPERED'
        self.write('mobile/node_modules/.package-lock.json', installed)
        with self.assertRaisesRegex(RuntimeError, 'Installed dependency metadata differs'):
            BUILD.dependency_identity(self.root / 'mobile')

    def test_missing_non_optional_package_is_rejected(self):
        self.dependencies()
        (self.root / 'mobile/node_modules/fixture/package.json').unlink()
        with self.assertRaisesRegex(RuntimeError, 'Pinned dependency missing'):
            BUILD.dependency_identity(self.root / 'mobile')


if __name__ == '__main__':
    unittest.main()
