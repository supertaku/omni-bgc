"""Synthetic adb responses: check blocked evidence and serial privacy."""
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest

spec = importlib.util.spec_from_file_location("ai_probe", Path(__file__).parents[1] /
                                           "apps/mobile/scripts/ai-device-probe.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProbeTests(unittest.TestCase):
    def test_empty_unauthorized_and_multiple_do_not_probe(self):
        for listing in ["List of devices attached\n", "PRIVATE_A unauthorized",
                        "PRIVATE_A device\nPRIVATE_B device"]:
            calls = []
            def invoke(args):
                calls.append(args)
                return listing
            report = module.probe("adb", invoke)
            self.assertEqual(report["status"], "BLOCKED")
            self.assertEqual(report["physical_inference"], "NOT_RUN")
            self.assertEqual(len(calls), 1)
            self.assertNotIn("PRIVATE", json.dumps(report))

    def test_authorized_inventory_never_claims_inference_or_serial(self):
        calls = []
        def invoke(args):
            calls.append(args)
            if args == ["devices", "-l"]:
                return "List of devices attached\nPRIVATE_A device product:test"
            if args == ["version"]:
                return "Android Debug Bridge version 1.0.41\n"
            tail = args[3:]
            if tail == ["cat", "/proc/meminfo"]:
                return "MemTotal: 8000000 kB\nMemAvailable: 4000000 kB\n"
            if tail == ["df", "-k", "/data"]:
                return "Filesystem 1K-blocks Used Available Use% Mounted on\n/dev/test 100 10 90 10% /data"
            if tail == ["dumpsys", "battery"]:
                return "  temperature: 345\n"
            if tail == ["dumpsys", "thermalservice"]:
                return "Thermal Status: 2\nPRIVATE_SENSOR_NAME"
            return "test-value"
        report = module.probe("adb", invoke)
        self.assertEqual(report["status"], "PREFLIGHT_ONLY")
        self.assertEqual(report["memory_kib"]["MemTotal"], 8000000)
        self.assertEqual(report["thermal_status"], 2)
        self.assertEqual(report["battery_temperature_tenths_c"], 345)
        self.assertNotIn("PRIVATE", json.dumps(report))
        self.assertEqual(report["physical_inference"], "NOT_RUN")
        self.assertTrue(all(args[1] == "PRIVATE_A" for args in calls if args[0] == "-s"))

    def test_subprocess_failure_is_redacted_and_blocked(self):
        def invoke(args):
            raise subprocess.CalledProcessError(1, ["adb", "-s", "PRIVATE_A"])
        report = module.probe("adb", invoke)
        self.assertEqual(report["status"], "BLOCKED")
        self.assertNotIn("PRIVATE", json.dumps(report))


if __name__ == "__main__":
    unittest.main()
