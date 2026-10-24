"""Exercise APK comparison with tiny ZIP fixtures; no Android build or device required."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

comparator = Path(__file__).with_name('compare-android-apks.py')
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    first, second = root / 'first.apk', root / 'second.apk'
    def write(path, content, date=(2026, 10, 24, 0, 0, 0)):
        with zipfile.ZipFile(path, 'w') as archive:
            archive.writestr(zipfile.ZipInfo('assets/test', date_time=date), content)
    def compare(expected):
        run = subprocess.run([sys.executable, str(comparator), str(first), str(second)],
                             capture_output=True, text=True, check=False)
        assert run.returncode == expected, run.stderr
        return json.loads(run.stdout)
    write(first, b'original')
    second.write_bytes(first.read_bytes())
    assert compare(0)['byteReproducible'] is True
    write(second, b'changed')
    changed = compare(1)
    assert changed['byteReproducible'] is False
    assert changed['changedEntries']['assets/test']['first']['sha256'] != changed['changedEntries']['assets/test']['second']['sha256']
    write(second, b'original', (2026, 10, 25, 0, 0, 0))
    metadata = compare(1)['changedEntries']['assets/test']
    assert metadata['first']['sha256'] == metadata['second']['sha256']
    assert metadata['first']['timestamp'] != metadata['second']['timestamp']
    second.write_bytes(first.read_bytes() + b'container difference')
    assert compare(1)['sameEntriesDifferentContainer'] is True
print('Release comparison: equal bytes, changed payload, timestamps and container differences passed.')
