"""Inventory local cleanup, preserve research, and verify retained bytes.

Dry-run is the default. Deletion is performed only by cleanup.ps1 with an explicit
reviewed manifest. Inventories are private local records, never dataset exports.
"""
import argparse
from collections import defaultdict
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / '.g/cleanup'
CURRENT = ('ai-host-cleanup-current', 'ai-build-cleanup-current')
REQUIRED_DOCUMENTS = set()
RETIRED_TOOLS = {
    'pipelines/mobile/gex_preview_build.py',
    'pipelines/mobile/offices_preview_build.py',
    'scripts/audit-offline-ai-receipt-erratum.py',
}


def document_dependencies():
    """Keep literal active-code dependencies and recursively referenced records."""
    indexed = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    queue = [ROOT / path for path in indexed if path and path not in RETIRED_TOOLS and not path.startswith(('docs/', 'assets/'))
             and Path(path).suffix in {'.py', '.ts', '.tsx', '.cjs', '.mjs', '.js', '.json', '.yml', '.ps1'}]
    code = '\n'.join(path.read_text(encoding='utf-8', errors='replace') for path in queue if path.is_file())
    for path in indexed:
        if path.startswith('docs/') and Path(path).name in code and (ROOT / path).is_file():
            REQUIRED_DOCUMENTS.add(path)
            queue.append(ROOT / path)
    seen = set()
    while queue:
        path = queue.pop()
        if path in seen or not path.is_file():
            continue
        seen.add(path)
        text = path.read_text(encoding='utf-8', errors='replace')
        for match in re.findall(r'docs/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+', text):
            target = ROOT / match
            if target.is_file() and match not in REQUIRED_DOCUMENTS:
                REQUIRED_DOCUMENTS.add(match)
                queue.append(target)


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def extended(path):
    value = os.path.abspath(path)
    return '\\\\?\\' + value if os.name == 'nt' and not value.startswith('\\\\?\\') else value


def walk(path, relative):
    with os.scandir(extended(path)) as entries:
        for entry in entries:
            name = relative + '/' + entry.name
            if name == '.g/cleanup':
                continue
            if entry.is_symlink() or getattr(entry, 'is_junction', lambda: False)():
                yield {'path': name, 'link': True, 'bytes': 0}
            elif entry.is_dir(follow_symlinks=False):
                yield from walk(entry.path, name)
            else:
                stat = entry.stat(follow_symlinks=False)
                yield {'path': name, 'bytes': stat.st_size, 'mtime_ns': stat.st_mtime_ns}


def scan(label):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    output = EVIDENCE / (label + '.jsonl.gz')
    if output.exists():
        raise RuntimeError('Inventory already exists; use another label')
    totals = defaultdict(lambda: {'bytes': 0, 'files': 0})
    free = shutil.disk_usage(ROOT).free
    with gzip.open(output, 'wt', encoding='utf-8') as stream:
        for child in sorted(ROOT.iterdir()):
            records = walk(child, child.name) if child.is_dir() else [{'path': child.name, 'bytes': child.stat().st_size}]
            for row in records:
                if row['path'].startswith('.g/cleanup/'):
                    continue
                stream.write(json.dumps(row, separators=(',', ':')) + '\n')
                for depth in (1, 2, 3):
                    parts = row['path'].split('/')
                    if len(parts) >= depth:
                        total = totals['/'.join(parts[:depth])]
                        total['bytes'] += row['bytes']
                        total['files'] += not row.get('link', False)
            print('Scanned ' + child.name, flush=True)
    result = {'label': label, 'freeBytes': free, 'totals': dict(totals), 'inventorySha256': sha(output)}
    write(EVIDENCE / (label + '-summary.json'), result)
    print(json.dumps({'bytes': sum(v['bytes'] for k, v in totals.items() if '/' not in k), 'freeBytes': free}))


def records(label='before'):
    with gzip.open(EVIDENCE / (label + '.jsonl.gz'), 'rt', encoding='utf-8') as stream:
        for line in stream:
            yield json.loads(line)


def candidate(path):
    parts = path.split('/')
    name = Path(path).name.lower()
    if path == '.g/ai-m10/d2/Omni-BGC-invalid-model.litertlm':
        return path
    if path in RETIRED_TOOLS:
        return path
    if path.startswith('docs/'):
        if 'journal' in name or name.startswith('readme') or path in REQUIRED_DOCUMENTS or path.startswith('docs/journals/'):
            return None
        if path.startswith(('docs/design/', 'docs/milestone-handoffs/')):
            return path
        if path.startswith('docs/evaluations/') and not path.startswith('docs/evaluations/offline-ai/'):
            return path
        if path in {'docs/PARENT_AGENT_START_PROMPT.md', 'docs/TOOL_RATIONALE.md', 'docs/RISK_REGISTER.md'}:
            return path
        if path.startswith('docs/geography/') and Path(path).suffix == '.log':
            return path
    if path.startswith('assets/') and Path(path).suffix == '.png':
        return path
    if len(parts) >= 2 and parts[0] == '.g':
        name = parts[1]
        if name in CURRENT or name == 'cleanup':
            return None
        if name == 'ai14':
            return '.g/ai14'
        if name.startswith(('ai-host-', 'ai-build-', 'gex-native-', 'ux-v2')) or name in {
            'c2', 'of-b', 'of-c', 'of-r1', 'of-host-helper', 'ai-native', 'android-ci-clean', 'offline-ai-2026-10-14',
            'gex-device-r1', 'android-ci-clean.zip', 'quality-snapshot.py', 'verify-map-bundle.py',
        }:
            return '.g/' + name
        if name == 'jdks' and len(parts) == 3 and path.endswith('.zip'):
            return path
        if name == 'ai-m10' and len(parts) >= 3:
            if 'candidate' in parts[2] or parts[2] in {'source-control-tests', 'host-quality', 'u3-host-quality', 'u4-host-quality'}:
                return '/'.join(parts[:3])
            if Path(path).suffix.lower() in {'.png', '.xml', '.mp4', '.log'}:
                return path
        if name == 'food-research' and len(parts) >= 3 and parts[2].startswith('android-bundle'):
            return '/'.join(parts[:3])
    if path.startswith(('apps/mobile/artifacts/', 'apps/mobile/android/')):
        return '/'.join(parts[:3])
    return None


def preserve():
    """Consolidate unique BGC files and authored journals from disposable copies."""
    existing = {}
    for base in (ROOT / 'data', ROOT / 'apps/mobile/assets/generated'):
        for row in walk(base, base.relative_to(ROOT).as_posix()):
            if not row.get('link'):
                existing.setdefault(sha(extended(ROOT / row['path'])), row['path'])
    journal_hashes = {sha(path) for path in (ROOT / 'docs').rglob('*') if path.is_file() and ('journal' in path.name.lower() or path.name.lower().startswith('readme'))}
    retained = []
    for row in records():
        rel = row['path']
        if row.get('link') or not candidate(rel):
            continue
        parts = rel.split('/')
        if any(p in {'node_modules', '.venv', '__pycache__', '.git', 'caches', '.cxx', 'build'} for p in parts):
            continue
        match = re.search(r'/(data/(?:raw|generated|research|manifests|fixtures|licenses)/.+)$', rel)
        asset = re.search(r'/(apps/mobile/assets/generated/.+)$', rel)
        research_record = rel.startswith('docs/') and Path(rel).suffix.lower() in {'.json', '.csv', '.geojson', '.sql'}
        journal = ('journal' in Path(rel).name.lower() or Path(rel).name.lower().startswith('readme')) and '/experiments/' not in rel
        if not (match or asset or journal or research_record):
            continue
        path = extended(ROOT / rel)
        digest = sha(path)
        if match or asset or research_record:
            if digest in existing:
                retained.append({'from': rel, 'to': existing[digest], 'sha256': digest, 'action': 'existing-identical'})
                continue
            suffix = (match or asset).group(1) if match or asset else rel
            dest = ROOT / 'data/generated/retained-cleanup' / digest[:16] / suffix
            existing[digest] = dest.relative_to(ROOT).as_posix()
        else:
            if digest in journal_hashes:
                continue
            dest = ROOT / 'docs/journals/retained-cleanup' / digest[:16] / Path(rel).name
            journal_hashes.add(digest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
        if sha(dest) != digest:
            raise RuntimeError('Retained copy differs: ' + rel)
        retained.append({'from': rel, 'to': dest.relative_to(ROOT).as_posix(), 'sha256': digest, 'action': 'preserved-unique'})
    write(EVIDENCE / 'research-consolidation.json', retained)
    print(json.dumps({'uniquePreserved': sum(r['action'] == 'preserved-unique' for r in retained), 'researchMappings': len(retained)}))


def protect():
    paths = set()
    indexed = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    paths.update(p for p in indexed if p and not candidate(p))
    for base in ('data', 'apps/mobile/assets/generated', 'models'):
        if (ROOT / base).exists():
            paths.update(row['path'] for row in walk(ROOT / base, base) if not row.get('link'))
    paths.update(p.relative_to(ROOT).as_posix() for p in (ROOT / 'docs/journals').rglob('*') if p.is_file())
    rows = [{'path': path, 'bytes': (ROOT / path).stat().st_size, 'sha256': sha(ROOT / path)} for path in sorted(paths)]
    write(EVIDENCE / 'protected.json', rows)
    print(json.dumps({'protectedFiles': len(rows)}))


def catalog():
    output = ROOT / 'data/generated/research-catalog.json'
    rows = []
    for row in walk(ROOT / 'data', 'data'):
        path = row['path']
        if row.get('link') or path == output.relative_to(ROOT).as_posix() or any(
            part in {'__pycache__', 'dependencies', 'ui-tools', '.venv'} for part in path.split('/')
        ):
            continue
        rows.append({'path': path, 'bytes': row['bytes'], 'sha256': sha(extended(ROOT / path))})
    write(output, {'kind': 'LOCAL_RESEARCH_FILE_CATALOG_NOT_CANONICAL_FACT_DATABASE',
                   'distributionAuthorized': False, 'files': sorted(rows, key=lambda row: row['path'])})
    print(json.dumps({'catalogedFiles': len(rows), 'catalog': str(output)}))


def verify():
    failures = []
    rows = json.loads((EVIDENCE / 'protected.json').read_text(encoding='utf-8'))
    for row in rows:
        path = ROOT / row['path']
        if not path.is_file() or path.stat().st_size != row['bytes'] or sha(path) != row['sha256']:
            failures.append(row['path'])
    write(EVIDENCE / 'protected-verification.json', {'files': len(rows), 'failures': failures})
    if failures:
        raise RuntimeError('Protected files changed: ' + ', '.join(failures))
    print(f'PASS: {len(rows)} retained files match their recorded bytes')


def plan():
    groups = defaultdict(lambda: {'files': 0, 'bytes': 0})
    for row in records():
        target = candidate(row['path'])
        if target:
            groups[target]['files'] += not row.get('link', False)
            groups[target]['bytes'] += row['bytes']
    manifest = {'root': str(ROOT), 'inventorySha256': sha(EVIDENCE / 'before.jsonl.gz'),
                'targets': [{'path': name, **group} for name, group in sorted(groups.items())]}
    write(EVIDENCE / 'deletion-manifest.json', manifest)
    print(json.dumps({'targets': len(groups), 'logicalGiB': round(sum(g['bytes'] for g in groups.values()) / 2**30, 3)}))


def validate_manifest(preflight=False):
    manifest = json.loads((EVIDENCE / 'deletion-manifest.json').read_text(encoding='utf-8'))
    if manifest['root'] != str(ROOT) or manifest['inventorySha256'] != sha(EVIDENCE / 'before.jsonl.gz'):
        raise RuntimeError('Manifest root or inventory binding differs')
    protected = json.loads((EVIDENCE / 'protected.json').read_text(encoding='utf-8'))
    available = {candidate(row['path']) for row in records()}
    for target in manifest['targets']:
        path = target['path']
        resolved = (ROOT / path).resolve()
        if path not in available or not resolved.is_relative_to(ROOT) or resolved == ROOT or candidate(path + '/placeholder') != path and candidate(path) != path:
            raise RuntimeError('Unapproved target: ' + path)
        if any(row['path'] == path or row['path'].startswith(path + '/') for row in protected):
            raise RuntimeError('Target contains protected data: ' + path)
    if preflight:
        expected = {row['path']: (row['bytes'], row.get('mtime_ns'), row.get('link', False))
                    for row in records() if candidate(row['path'])}
        checked = 0
        links = []
        for target in manifest['targets']:
            rel = target['path']
            path = ROOT / rel
            if not path.exists():
                continue
            if path.is_dir():
                actual = walk(path, rel)
            else:
                stat = path.stat()
                actual = [{'path': rel, 'bytes': stat.st_size, 'mtime_ns': stat.st_mtime_ns}]
            for row in actual:
                identity = (row['bytes'], row.get('mtime_ns'), row.get('link', False))
                if expected.get(row['path']) != identity:
                    raise RuntimeError('New or changed file in deletion target; inventory again: ' + row['path'])
                if row.get('link'):
                    links.append(row['path'])
                checked += 1
        write(EVIDENCE / 'deletion-preflight.json', {'verifiedCurrentEntries': checked, 'links': links})
    print(f"PASS: {len(manifest['targets'])} deletion targets are inside the cleanup allowlist")


def main():
    global EVIDENCE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence', default='.g/cleanup', help='Private run directory below .g/cleanup')
    parser.add_argument('--scan', metavar='LABEL')
    parser.add_argument('--preserve', action='store_true')
    parser.add_argument('--protect', action='store_true')
    parser.add_argument('--verify', action='store_true')
    parser.add_argument('--catalog', action='store_true')
    parser.add_argument('--validate-manifest', action='store_true')
    parser.add_argument('--preflight', action='store_true')
    args = parser.parse_args()
    EVIDENCE = (ROOT / args.evidence).resolve()
    if not EVIDENCE.is_relative_to((ROOT / '.g/cleanup').resolve()):
        raise RuntimeError('Evidence directory must stay below .g/cleanup')
    document_dependencies()
    if args.scan:
        scan(args.scan)
    elif args.preserve:
        preserve()
    elif args.protect:
        protect()
    elif args.verify:
        verify()
    elif args.catalog:
        catalog()
    elif args.validate_manifest:
        validate_manifest(args.preflight)
    else:
        plan()


if __name__ == '__main__':
    main()
