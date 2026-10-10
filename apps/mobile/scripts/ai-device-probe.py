"""Read-only Android AI preflight; never persist USB serials or mutate device state."""
import argparse
import datetime
import json
import os
from pathlib import Path
import re
import subprocess


def connected_devices(output):
    # Keep the serial only in process memory for adb targeting.
    return [(parts[0], parts[1]) for line in output.splitlines()
            if len(parts := line.split()) >= 2 and parts[1] in
            {"device", "offline", "unauthorized", "recovery", "sideload"}]


def probe(adb, invoke=None):
    def execute(args):
        completed = subprocess.run([str(adb), *args], capture_output=True,
                                   text=True, timeout=20, check=True)
        return completed.stdout.strip()
    call = invoke or execute
    report = {"version": 1, "captured_at_utc": datetime.datetime.now(
        datetime.timezone.utc).isoformat(), "status": "BLOCKED", "physical_inference": "NOT_RUN"}
    try:
        devices = connected_devices(call(["devices", "-l"]))
        report["device_count"] = len(devices)
        report["device_states"] = [state for _, state in devices]
        if len(devices) != 1 or devices[0][1] != "device":
            report["reason"] = "Connect and authorize exactly one Android phone."
            return report
        serial = devices[0][0]
        def shell(*args):
            return call(["-s", serial, "shell", *args])
        report["adb_version"] = call(["version"]).splitlines()[0]
        properties = {"manufacturer": "ro.product.manufacturer", "model": "ro.product.model",
                      "android_release": "ro.build.version.release", "api_level": "ro.build.version.sdk",
                      "abi_list": "ro.product.cpu.abilist", "build_id": "ro.build.id",
                      "opengl_es_version": "ro.opengles.version"}
        report["device"] = {name: shell("getprop", key) for name, key in properties.items()}
        report["memory_kib"] = {key: int(value) for key, value in re.findall(
            r"^(MemTotal|MemAvailable):\s+(\d+)\s+kB", shell("cat", "/proc/meminfo"), re.M)}
        storage = shell("df", "-k", "/data").splitlines()
        report["storage_df_kib"] = storage[-1] if len(storage) >= 2 else None
        battery = shell("dumpsys", "battery")
        temperature = re.search(r"^\s*temperature:\s*(-?\d+)\s*$", battery, re.M)
        report["battery_temperature_tenths_c"] = int(temperature[1]) if temperature else None
        # Restrict to thermal status, rather than logging sensor/vendor dump contents.
        thermal = shell("dumpsys", "thermalservice")
        status = re.search(r"^\s*Thermal Status:\s*(\d+)\s*$", thermal, re.M)
        report["thermal_status"] = int(status[1]) if status else None
        report["status"] = "PREFLIGHT_ONLY"
        report["reason"] = "Device inventory is not model or application acceptance."
    except (OSError, subprocess.SubprocessError, IndexError):
        # Exception text can contain the target serial or personal adb stderr.
        report["reason"] = "ADB preflight failed; no native success is inferred."
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    default = Path(os.environ.get("LOCALAPPDATA", "")) / "Android/Sdk/platform-tools/adb.exe"
    parser.add_argument("--adb", type=Path, default=default)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = probe(args.adb)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(report["status"] + ": " + report["reason"])
    return 2 if report["status"] == "BLOCKED" else 0


if __name__ == "__main__":
    raise SystemExit(main())
