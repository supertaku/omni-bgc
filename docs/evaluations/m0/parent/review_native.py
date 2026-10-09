"""Parent-owned M0 phone rerun; app-scoped logs, no serial/position export."""
import json
from pathlib import Path
import subprocess
import time

ADB = Path(r'C:\Users\joshu\AppData\Local\Android\Sdk\platform-tools\adb.exe')
APP = 'com.omnibgc.m0spike'
OUT = Path(__file__).resolve().parent

def run(args):
    try:
        result = subprocess.run([str(ADB), *args], capture_output=True, timeout=30)
    except subprocess.TimeoutExpired:
        raise RuntimeError('Scoped adb operation timed out; no device identifier exported') from None
    if result.returncode:
        raise RuntimeError('Scoped adb operation failed; no device identifier exported')
    return result.stdout

devices = run(['devices']).decode().splitlines()[1:]
physical = [line.split()[0] for line in devices if len(line.split()) == 2
            and line.split()[1] == 'device' and not line.startswith('emulator-')]
assert len(physical) == 1, 'Require exactly one authorized physical test device'
serial = physical[0]  # In-memory transport selection only; never written or printed.
prefix = ['-s', serial]
assert run(prefix + ['shell', 'pm', 'path', APP]).strip(), 'M0 diagnostic package is not installed'
device = {key: run(prefix + ['shell', 'getprop', prop]).decode().strip()
          for key, prop in [('model', 'ro.product.model'), ('api', 'ro.build.version.sdk'), ('abi', 'ro.product.cpu.abi')]}
assert device['abi'] == 'arm64-v8a'

run(prefix + ['shell', 'am', 'force-stop', APP])
run(prefix + ['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d',
              'omni-bgc-m0://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081', APP])
time.sleep(10)  # Bounded native launch wait; no system/network/security setting change.
pid = run(prefix + ['shell', 'pidof', APP]).decode().strip().split()[0]
log = run(prefix + ['logcat', '--pid', pid, '-d']).decode(errors='replace')
markers = [line for line in log.splitlines() if 'M0_MAP' in line or 'M0_SQLITE' in line]
assert any('M0_MAP PASS fully rendered local background' in line for line in markers), 'Native renderer PASS not observed'
assert any('M0_SQLITE lifecycle cycle 1 closed' in line for line in markers)
assert any('M0_SQLITE lifecycle cycle 2 closed' in line for line in markers)
assert any('M0_SQLITE PASS SQLite' in line and 'FTS5 hit=1, absent=0, integrity=ok, close/reopen=ok' in line for line in markers), 'Native SQLite lifecycle assertions not observed'
time.sleep(50)
assert run(prefix + ['shell', 'pidof', APP]).decode().strip().split()[0] == pid, 'Native process did not survive the 60-second observation'
final_log = run(prefix + ['logcat', '--pid', pid, '-d']).decode(errors='replace')
assert 'Scudo ERROR' not in final_log and 'Fatal signal' not in final_log, 'Native fatal error observed in fresh process'
(OUT / 'physical-native-markers.log').write_text('\n'.join(markers) + '\n', encoding='utf-8')
png = run(prefix + ['exec-out', 'screencap', '-p'])
assert png.startswith(b'\x89PNG\r\n\x1a\n')
(OUT / 'physical-native-parent.png').write_bytes(png)
print(json.dumps({'parent_phone_rerun': 'PASS', 'device': device, 'physical': True,
                  'fresh_app_process_native_markers': True, 'native_process_stable_60_seconds': True,
                  'sqlite_positive_absent_integrity': 'PASS',
                  'maplibre_fully_rendered_local_background': 'PASS', 'screenshot': 'physical-native-parent.png',
                  'scope': 'M0 diagnostic native feasibility with local Metro; not production offline pack/release'}, indent=2))
