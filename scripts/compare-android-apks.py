"""Compare two verified clean APKs; list ZIP-level differences when bytes differ."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('first', type=Path)
parser.add_argument('second', type=Path)
parser.add_argument('--report', type=Path)
args = parser.parse_args()

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''): h.update(block)
    return h.hexdigest()

def entries(path):
    with zipfile.ZipFile(path) as archive:
        return {entry.filename: {'sha256': hashlib.sha256(archive.read(entry)).hexdigest(),
                                 'timestamp': entry.date_time, 'compressType': entry.compress_type,
                                 'externalAttr': entry.external_attr}
                for entry in archive.infolist()}

first, second = sha(args.first), sha(args.second)
report = {'firstSha256': first, 'secondSha256': second, 'byteReproducible': first == second}
if first != second:
    a, b = entries(args.first), entries(args.second)
    report['onlyFirst'] = sorted(a.keys() - b.keys())
    report['onlySecond'] = sorted(b.keys() - a.keys())
    report['changedEntries'] = {name: {'first': a[name], 'second': b[name]}
                                for name in sorted(a.keys() & b.keys()) if a[name] != b[name]}
    report['sameEntriesDifferentContainer'] = not (report['onlyFirst'] or report['onlySecond'] or report['changedEntries'])
output = json.dumps(report, indent=2) + '\n'
if args.report:
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(output, encoding='utf-8')
print(output, end='')
raise SystemExit(0 if first == second else 1)
