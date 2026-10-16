"""Regress ignored native source that built locally but vanished from Git."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('native_source', ROOT / 'scripts/check-offline-ai-source.py')
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


class NativeSourceControlTests(unittest.TestCase):
    def setUp(self):
        base = ROOT / '.g/ai-m10/source-control-tests'
        base.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=base)
        self.root = Path(self.temporary.name).resolve()
        self.git('init', '--quiet')
        receipt = json.loads((ROOT / CHECK.MANIFEST).read_text())
        for path in [CHECK.MANIFEST, *[row['path'] for row in receipt['native']],
                     *[CHECK.MODULE + name for name in ('index.ts', 'package.json', 'expo-module.config.json')]]:
            file = self.root / path
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes((ROOT / path).read_bytes())
        self.git('add', '.')
        self.git('-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid',
                 '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Synthetic source-control fixture')
        self.source = receipt['native'][0]['path']

    def tearDown(self):
        self.temporary.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', '-c', 'core.autocrlf=false', *args], cwd=self.root)

    def test_complete_index_survives_fresh_checkout_without_ignored_sources(self):
        self.assertEqual(CHECK.audit_index(self.root)['status'], 'NATIVE_SOURCE_INDEX_PASS')
        clone = self.root / 'fresh'
        self.git('clone', '--quiet', '--local', '--no-hardlinks', self.root.as_posix(), clone.as_posix())
        self.assertEqual(CHECK.audit_index(clone)['native'], CHECK.audit_index(self.root)['native'])

    def test_disk_presence_cannot_replace_missing_index_source(self):
        self.git('rm', '--cached', '--quiet', self.source)
        self.assertTrue((self.root / self.source).is_file())
        with self.assertRaisesRegex(RuntimeError, 'missing from Git index'):
            CHECK.audit_index(self.root)

    def test_unreviewed_local_native_source_fails(self):
        (self.root / CHECK.NATIVE / 'Extra.kt').write_text('class Extra')
        with self.assertRaisesRegex(RuntimeError, 'Local native inventory'):
            CHECK.audit_index(self.root)

    def test_tracked_build_output_fails(self):
        file = self.root / CHECK.NATIVE / 'build/classes/Leaked.class'
        file.parent.mkdir(parents=True)
        file.write_bytes(b'not a real binary')
        self.git('add', '.')
        with self.assertRaisesRegex(RuntimeError, 'Generated/private artifact'):
            CHECK.audit_index(self.root)

    def test_native_byte_drift_fails_even_when_staged(self):
        file = self.root / self.source
        file.write_bytes(file.read_bytes() + b'\n// changed\n')
        self.git('add', self.source)
        with self.assertRaisesRegex(RuntimeError, 'Reviewed native source differs'):
            CHECK.audit_index(self.root)

    def test_private_data_and_models_outside_module_fail(self):
        for path in ('data/raw/private.csv', 'data/generated/bundle.json', 'weights/model.litertlm'):
            with self.subTest(path=path):
                file = self.root / path
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('synthetic test fixture')
                self.git('add', path)
                with self.assertRaisesRegex(RuntimeError, 'Generated/private artifact'):
                    CHECK.audit_index(self.root)
                self.git('rm', '--cached', '--quiet', path)
                file.unlink()

    def test_wrong_expo_registration_fails(self):
        path = CHECK.MODULE + 'expo-module.config.json'
        (self.root / path).write_text('{"android":{"modules":["wrong.Module"]}}')
        self.git('add', path)
        with self.assertRaisesRegex(RuntimeError, 'Expo registration differs'):
            CHECK.audit_index(self.root)


if __name__ == '__main__':
    unittest.main()
