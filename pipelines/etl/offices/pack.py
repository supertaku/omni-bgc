"""Immutable places-pack proposal with a separately verified office text companion.

Preparation never grants trust or publication. A later exact-byte review receipt
can finalize metadata for parent inspection; the independent app digest registry
still rejects it until separately reviewed there. No upload/install operation.
"""
import argparse
from contextlib import closing
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import tempfile
from urllib.parse import urlsplit
from review import instant, metadata

ROOT = Path(__file__).resolve().parents[3]
PRIVATE = ROOT / 'data/generated/offices'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def encode(value):
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2) + '\n').encode()


def inventory(directory, entry):
    path = Path(entry['path'])
    if path.is_absolute() or not path.parts or any(part in {'.', '..'} for part in path.parts) or '\\' in entry['path']:
        raise ValueError('Unsafe pack inventory path')
    file = (directory / path).resolve()
    if not file.is_relative_to(directory.resolve()):
        raise ValueError('Pack inventory escapes directory')
    raw = file.read_bytes()
    if digest(raw) != entry['sha256'] or len(raw) != entry['sizeBytes']:
        raise ValueError('Pack file checksum/size mismatch')
    return file


def database(path, snapshots, *, office=False):
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        db.execute('PRAGMA query_only=ON'); db.execute('PRAGMA foreign_keys=ON')
        if [row[0] for row in db.execute('SELECT version FROM schema_migration ORDER BY version')] != [1, 3]:
            raise ValueError('Version 3 database required')
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or db.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Database integrity rejected')
        meta = dict(db.execute('SELECT key,value FROM pack_metadata'))
        if meta.get('synthetic_test_only') == 'true' or office and (meta.get('synthetic_test_only') != 'false' or meta.get('build_contract') != 'm4-local-content-v1'):
            raise ValueError('Synthetic/unbound office database rejected')
        rows = db.execute('SELECT id,raw_sha256,license,attribution FROM source_snapshot').fetchall()
        for ident, sha, license_, attribution in rows:
            if not any(s['id'] == ident and s['rawSha256'] == sha and s['license'] == license_ and s['attribution'] == attribution for s in snapshots):
                raise ValueError('Database snapshot not bound to manifest')
        if office and not db.execute("SELECT 1 FROM fact WHERE property='category' AND value_json='\"office\"'").fetchone():
            raise ValueError('Office projection has no approved office records')
        return meta


def prepare(base, office, output, version, file_base_url, now):
    base, office, output = Path(base).resolve(), Path(office).resolve(), Path(output).resolve()
    if output == PRIVATE.resolve() or not output.is_relative_to(PRIVATE.resolve()) or output.exists():
        raise ValueError('Use a new immutable version under ignored office storage')
    instant(now); metadata(version)
    url = urlsplit(file_base_url)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
        raise ValueError('Explicit HTTPS file base URL required; no download is performed')
    original = json.loads((base / 'manifest.json').read_text(encoding='utf-8'))
    if original.get('kind') != 'places' or original.get('schemaVersion') != 3 or original['version'] == version:
        raise ValueError('New version and an existing version 3 places artifact required')
    if instant(original['validUntil']) <= instant(now):
        raise ValueError('Base places pack expired')
    if any(f['path'] == 'office-directory.sqlite' for f in original['files']):
        raise ValueError('Use a clean geographic base; office versions cannot accumulate companions')
    if len({f['path'] for f in original['files']}) != len(original['files']):
        raise ValueError('Duplicate base inventory paths')
    files = [(inventory(base, entry), entry['path']) for entry in original['files']]
    if 'main.sqlite' not in [name for _, name in files]:
        raise ValueError('Base main.sqlite missing')
    scope = database(base / 'main.sqlite', original['snapshots'])
    if original['scopeId'] != 'omni-bgc:service-area:high-street-pilot-v1' and (scope.get('service_area_id') != original['scopeId'] or scope.get('service_area_sha256') != original.get('scopeManifestSha256')):
        raise ValueError('Base geographic database scope mismatch')
    proposal = json.loads((office / 'export-manifest.json').read_text(encoding='utf-8'))
    raw = (office / 'main.sqlite').read_bytes()
    if proposal.get('synthetic_test_only') is not False or proposal.get('publication_authorized') is not False or digest(raw) != proposal['dataset_sha256'] or len(raw) != proposal['size_bytes']:
        raise ValueError('Exact retained non-synthetic office export required')
    snapshots = {s['id']: s for s in original['snapshots']}
    for source in proposal['snapshots']:
        policies = [p for p in source['retained_evidence']['permission_evidence'] if p['use'] == 'data']
        permissions = [p['sha256'] for p in policies]
        if len(set(permissions)) != 1 or len(permissions[0]) != 64:
            raise ValueError('Exact retained data permission proof required')
        if any(not policy.get('valid_until') or instant(policy['valid_until']) <= instant(now) for policy in policies):
            raise ValueError('Exact current data permission expiry required')
        until = min([source['valid_until'], *[policy['valid_until'] for policy in policies]],key=instant)
        item = dict(id=source['id'], rawSha256=source['raw_sha256'], license=source['license'], attribution=source['attribution'], permissionEvidenceSha256=permissions[0], permittedUse='data', validUntil=until)
        if item['id'] in snapshots and snapshots[item['id']] != item:
            raise ValueError('Conflicting snapshot identity')
        snapshots[item['id']] = item
    database(office / 'main.sqlite', list(snapshots.values()), office=True)
    files.append((office / 'main.sqlite', 'office-directory.sqlite'))
    manifest = {**original, 'version': version, 'createdAt': now,
                'validUntil': min([original['validUntil'], *[s['validUntil'] for s in snapshots.values()]], key=instant),
                'snapshots': sorted(snapshots.values(), key=lambda s: s['id']), 'files': [],
                'review': {'parentReviewer': '', 'humanRightsReviewer': '', 'reviewedAt': '', 'userDistributionAuthorized': False, 'licenseObligationsSatisfied': False}}
    if instant(manifest['validUntil']) <= instant(now):
        raise ValueError('Expired snapshot')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.office-pack-', dir=output.parent) as folder:
        temp = Path(folder)
        for source, name in files:
            target = temp / name; target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            content = target.read_bytes()
            manifest['files'].append(dict(path=name, url=file_base_url.rstrip('/') + '/' + name.replace(' ', '%20'), sha256=digest(content), sizeBytes=len(content)))
        if len(manifest['files']) > 512 or any(f['sizeBytes'] > 64*1024*1024 for f in manifest['files']) or sum(f['sizeBytes'] for f in manifest['files']) > 256*1024*1024:
            raise ValueError('Pack exceeds mobile installer bounds')
        manifest['files'].sort(key=lambda f: f['path'])
        draft = encode(manifest); (temp / 'manifest-draft.json').write_bytes(draft)
        receipt = {'mode':'LOCAL_OFFICE_PACK_PROPOSAL', 'draft_sha256':digest(draft), 'publication_authorized':False,
                   'office_export_sha256':digest((office / 'export-manifest.json').read_bytes()),
                   'base_manifest_sha256':digest((base / 'manifest.json').read_bytes()), 'user_state_included':False}
        (temp / 'proposal.json').write_bytes(encode(receipt))
        temp.rename(output)
    return receipt


def finalize(folder, receipt, now):
    folder = Path(folder).resolve(); instant(now)
    if not folder.is_relative_to(PRIVATE.resolve()) or (folder / 'manifest.json').exists():
        raise ValueError('Immutable private proposal directory required')
    raw = (folder / 'manifest-draft.json').read_bytes(); manifest = json.loads(raw)
    if receipt.get('draft_sha256') != digest(raw):
        raise ValueError('Review must bind the exact draft bytes')
    for key in ('parentReviewer', 'humanRightsReviewer'):
        metadata(receipt.get(key))
    if receipt.get('userDistributionAuthorized') is not True or receipt.get('licenseObligationsSatisfied') is not True or not instant(manifest['createdAt']) <= instant(receipt['reviewedAt']) <= instant(now) < instant(manifest['validUntil']):
        raise ValueError('Explicit current parent/rights/distribution receipt required')
    for entry in manifest['files']:
        inventory(folder, entry)
    manifest['review'] = {k: receipt[k] for k in manifest['review']}
    with (folder / 'manifest.json').open('xb') as stream:
        stream.write(encode(manifest))
    (folder / 'review-receipt.json').write_bytes(encode(receipt))
    return {'manifest_file_sha256':digest(encode(manifest)),
            'canonical_manifest_sha256':digest(json.dumps(manifest,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()), 'installed':False, 'published':False,
            'independent_app_trust_registry_review_required':True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare','finalize']); parser.add_argument('--base', type=Path)
    parser.add_argument('--office', type=Path); parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--version'); parser.add_argument('--file-base-url'); parser.add_argument('--receipt', type=Path); parser.add_argument('--now', required=True)
    args = parser.parse_args()
    result = prepare(args.base,args.office,args.output,args.version,args.file_base_url,args.now) if args.action == 'prepare' else finalize(args.output,json.loads(args.receipt.read_text(encoding='utf-8')),args.now)
    print(json.dumps(result,sort_keys=True))


if __name__ == '__main__':
    main()
