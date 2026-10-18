"""Destructive cleanup must fail closed for changed data and unsafe targets."""
import gzip
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / 'scripts/cleanup.py'
FIXTURES = SOURCE.parents[1] / '.g/cleanup/test-fixtures'
spec = importlib.util.spec_from_file_location('repository_cleanup', SOURCE)
cleanup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cleanup)


class CleanupSafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        FIXTURES.mkdir(parents=True, exist_ok=True)

    def setup_manifest(self, root, target, rows, protected=()):
        evidence = root / '.g/cleanup'
        evidence.mkdir(parents=True)
        inventory = evidence / 'before.jsonl.gz'
        with gzip.open(inventory, 'wt', encoding='utf-8') as stream:
            for row in rows:
                stream.write(json.dumps(row) + '\n')
        cleanup.write(evidence / 'deletion-manifest.json', {
            'root': str(root), 'inventorySha256': cleanup.sha(inventory),
            'targets': [{'path': target}],
        })
        cleanup.write(evidence / 'protected.json', list(protected))
        return evidence

    def test_external_target_is_rejected(self):
        with tempfile.TemporaryDirectory(dir=FIXTURES) as folder:
            root = Path(folder)
            evidence = self.setup_manifest(root, '../outside', [])
            with patch.object(cleanup, 'ROOT', root), patch.object(cleanup, 'EVIDENCE', evidence):
                with self.assertRaisesRegex(RuntimeError, 'Unapproved target'):
                    cleanup.validate_manifest()

    def test_directory_containing_protected_data_is_rejected(self):
        with tempfile.TemporaryDirectory(dir=FIXTURES) as folder:
            root = Path(folder)
            evidence = self.setup_manifest(root, '.g/ai14', [
                {'path': '.g/ai14/data/raw/unique.csv', 'bytes': 3},
            ], [{'path': '.g/ai14/data/raw/unique.csv'}])
            with patch.object(cleanup, 'ROOT', root), patch.object(cleanup, 'EVIDENCE', evidence):
                with self.assertRaisesRegex(RuntimeError, 'contains protected data'):
                    cleanup.validate_manifest()

    def test_central_dependency_cache_is_rejected(self):
        with tempfile.TemporaryDirectory(dir=FIXTURES) as folder:
            root = Path(folder)
            evidence = self.setup_manifest(root, '.g/caches', [
                {'path': '.g/caches/required.aar', 'bytes': 3},
            ])
            with patch.object(cleanup, 'ROOT', root), patch.object(cleanup, 'EVIDENCE', evidence):
                with self.assertRaisesRegex(RuntimeError, 'Unapproved target'):
                    cleanup.validate_manifest()

    def test_new_research_file_after_inventory_blocks_deletion(self):
        with tempfile.TemporaryDirectory(dir=FIXTURES) as folder:
            root = Path(folder)
            target = root / '.g/ai14'
            target.mkdir(parents=True)
            original = target / 'old.txt'
            original.write_text('old', encoding='utf-8')
            stat = original.stat()
            evidence = self.setup_manifest(root, '.g/ai14', [
                {'path': '.g/ai14/old.txt', 'bytes': stat.st_size, 'mtime_ns': stat.st_mtime_ns},
            ])
            (target / 'new-research.csv').write_text('unique data', encoding='utf-8')
            with patch.object(cleanup, 'ROOT', root), patch.object(cleanup, 'EVIDENCE', evidence):
                with self.assertRaisesRegex(RuntimeError, 'New or changed file'):
                    cleanup.validate_manifest(preflight=True)
            self.assertTrue((target / 'new-research.csv').is_file())


if __name__ == '__main__':
    unittest.main()
