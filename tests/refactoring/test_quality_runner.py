"""Exercise false-green and failure paths in the actual portable CI runner."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("quality", ROOT / "apps/mobile/scripts/quality.py")
quality = importlib.util.module_from_spec(spec)
spec.loader.exec_module(quality)


class QualityRunnerTests(unittest.TestCase):
    def setUp(self):
        base = ROOT / ".g/quality-r2/runner-tests"
        base.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=base)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.output = self.root / "logs"
        self.output.mkdir()

    def run_check(self, command, name="synthetic", timeout=10):
        return quality.execute(name, command, self.output, timeout, self.root)

    def test_missing_and_empty_node_discovery_fail_before_node_starts(self):
        for files in ([], ["missing.test.cjs"]):
            result = self.run_check(["node", "--test", *files])
            self.assertEqual(result["status"], "FAIL")
            self.assertIsNone(result["exitCode"])

    def test_empty_python_discovery_and_zero_runtime_tests_fail(self):
        directory = self.root / "suite"
        directory.mkdir()
        command = [sys.executable, "-m", "unittest", "discover", "-s", "suite"]
        self.assertEqual(self.run_check(command)["status"], "FAIL")
        (directory / "test_empty.py").write_text("# No executable tests\n")
        result = self.run_check(command)
        # Python 3.13 itself exits 5 for no tests; older hosts exit 0.
        self.assertIn(result["exitCode"], (0, 5))
        self.assertEqual(result["status"], "FAIL")

    def test_unexpected_skip_fails_but_real_pass_succeeds(self):
        test = self.root / "case.test.cjs"
        test.write_text("require('node:test').test('real', {skip: true}, () => {});\n")
        command = ["node", "--test", "--test-reporter=tap", test.name]
        self.assertEqual(self.run_check(command)["status"], "FAIL")
        test.write_text("require('node:test').test('real', () => require('node:assert').equal(1, 1));\n")
        result = self.run_check(command)
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["tests"], 1)
        self.assertTrue(Path(result["evidence"]).is_file())

    def test_timeout_missing_executable_and_failure_have_evidence(self):
        result = self.run_check([sys.executable, "-c", "import time; time.sleep(10)"], timeout=1)
        self.assertEqual(result["status"], "TIMEOUT")
        for command in (["omni-nonexistent-executable"], [sys.executable, "-c", "raise SystemExit(2)"]):
            result = self.run_check(command)
            self.assertEqual(result["status"], "FAIL")
            self.assertTrue(Path(result["evidence"]).is_file())

    def test_ci_uses_shared_registry_and_offices_ai_are_enrolled(self):
        registry = dict(quality.commands())
        for name in ("ai-layer", "ai-native-source", "ai-host-build-python", "offices-python", "offices-js", "offices-lint"):
            self.assertIn(name, registry)
        workflow = (ROOT / ".github/workflows/quality.yml").read_text()
        self.assertIn("python apps/mobile/scripts/quality.py --output", workflow)
        self.assertNotIn("node --test", workflow)


if __name__ == "__main__":
    unittest.main()
