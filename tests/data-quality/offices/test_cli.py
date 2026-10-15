import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from office_helpers import ROOT, raw, row


class PrivateBoundaryTests(unittest.TestCase):
    def test_import_refuses_output_outside_ignored_office_root(self):
        base = ROOT / 'data/generated/offices/test-workspace'
        base.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=base) as folder:
            self.assertTrue(Path(folder).resolve().is_relative_to(base.resolve()))
            source = Path(folder) / 'source.csv'
            source.write_bytes(raw([row()]))
            target = ROOT / '.g/office-output-guard-fixture'
            self.assertFalse(target.exists())
            result = subprocess.run([sys.executable, str(ROOT / 'pipelines/etl/offices/import_directory.py'),
                                     '--csv', str(source), '--output', str(target)], capture_output=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn(b'Outputs must stay in ignored', result.stderr)
            self.assertFalse(target.exists())

    def test_dashboard_and_refresh_refuse_public_paths_before_writes(self):
        target = ROOT / '.g/office-output-guard-fixture'
        for command in (
            [str(ROOT / 'pipelines/etl/review-dashboard/dashboard.py'), '--offices',
             str(ROOT / 'docs/offices/not-a-report.json'), '--output', str(target)],
            [str(ROOT / 'pipelines/etl/offices/refresh_diff.py'), '--previous',
             str(ROOT / 'docs/offices/not-a-report.json'), '--current',
             str(ROOT / 'docs/offices/not-a-report.json'), '--output', str(target)],
        ):
            result = subprocess.run([sys.executable, *command], capture_output=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn(b'ignored data/generated/offices/', result.stderr)
            self.assertFalse(target.exists())


if __name__ == '__main__':
    unittest.main()
