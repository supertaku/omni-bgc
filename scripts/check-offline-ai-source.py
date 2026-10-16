"""Require indexed authored native source, even when ignored local files can build.

No ADB, network, staging or Git writes. The CLI also verifies Expo autolinking.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MODULE = 'apps/mobile/modules/omni-local-ai/'
NATIVE = MODULE + 'android/'
MANIFEST = 'docs/evaluations/offline-ai/NATIVE_SOURCE_RECOVERY.json'
CLASS = 'expo.modules.omnilocalai.OmniLocalAiModule'


def require(value, message):
    if not value:
        raise RuntimeError(message)


def git(root, *args):
    return subprocess.check_output(['git', *args], cwd=root)


def forbidden(path):
    parts = path.split('/')
    return (path.startswith(('apps/mobile/android/', 'apps/mobile/ios/',
                             'apps/mobile/assets/generated/', 'data/raw/', 'data/generated/', '.g/'))
            or 'node_modules' in parts
            or Path(path).suffix.lower() in {'.litertlm', '.gguf', '.pte', '.apk'}
            or (path.startswith(NATIVE) and any(part in {
                'build', '.gradle', '.cxx', '.externalNativeBuild', '.idea',
                'local.properties'} for part in parts))
            or (path.startswith(MODULE) and Path(path).suffix.lower() in {
                '.so', '.aar', '.jar', '.class', '.apk', '.litertlm', '.gguf', '.pte'}))


def audit_index(root=ROOT):
    root = Path(root).resolve()
    indexed = set(git(root, 'ls-files', '-z').decode().rstrip('\0').split('\0'))
    require(MANIFEST in indexed, 'Recovery manifest missing from Git index')
    read = lambda path: git(root, 'show', ':' + path)
    receipt = json.loads(read(MANIFEST))
    expected = {row['path']: row for row in receipt['native']}
    require(len(expected) == 8 and all(path.startswith(NATIVE) for path in expected),
            'Recovery manifest must enumerate the eight reviewed Android source files')
    required = set(expected) | {MODULE + name for name in (
        'index.ts', 'package.json', 'expo-module.config.json')}
    require(required <= indexed, 'Native source missing from Git index: ' + ', '.join(sorted(required - indexed)))
    bad = sorted(path for path in indexed if forbidden(path))
    require(not bad, 'Generated/private artifact tracked: ' + ', '.join(bad))
    actual = {path for path in indexed if path.startswith(NATIVE)}
    require(actual == set(expected), 'Native index inventory differs from reviewed manifest')
    local = {path.relative_to(root).as_posix() for path in (root / NATIVE).rglob('*')
             if path.is_file() and not forbidden(path.relative_to(root).as_posix())}
    require(local == actual, 'Local native inventory differs from Git index')
    rows = []
    blobs = {}
    for path in sorted(required):
        content = read(path)
        require((root / path).read_bytes() == content, 'Worktree differs from indexed source: ' + path)
        digest = hashlib.sha256(content).hexdigest()
        if path in expected:
            require(digest == expected[path]['sha256'] and len(content) == expected[path]['bytes'],
                    'Reviewed native source differs: ' + path)
        rows.append({'path': path, 'bytes': len(content), 'sha256': digest})
        blobs[path] = content.decode('utf-8')
    config = json.loads(blobs[MODULE + 'expo-module.config.json'])
    require(config['android']['modules'] == [CLASS], 'Expo registration differs')
    kotlin = [path for path in actual if path.endswith('.kt')]
    implementations = [path for path in kotlin if re.search(r'class\s+OmniLocalAiModule\s*:\s*Module\(\)', blobs[path])]
    require(len(implementations) == 1, 'Expected exactly one native implementation class')
    source = blobs[implementations[0]]
    require('package expo.modules.omnilocalai' in source and 'Name("OmniLocalAi")' in source,
            'Kotlin registration identity differs')
    require("requireOptionalNativeModule<NativeEngineBridge>('OmniLocalAi')" in blobs[MODULE + 'index.ts'],
            'TypeScript bridge identity differs')
    gradle = blobs[NATIVE + 'build.gradle']
    require("apply plugin: 'expo-module-gradle-plugin'" in gradle
            and 'litertlm-android:0.18.0' in gradle, 'Native Gradle declaration differs')
    for name in ('OwnershipTest.kt', 'NativeMessagesTest.kt'):
        require(any(path.endswith('/' + name) and '/src/test/' in path for path in kotlin),
                'Native ownership/codec test missing: ' + name)
    return {'status': 'NATIVE_SOURCE_INDEX_PASS', 'head': git(root, 'rev-parse', 'HEAD').decode().strip(),
            'native': rows, 'recovery_manifest_sha256': hashlib.sha256(read(MANIFEST)).hexdigest()}


def audit_autolinking(root=ROOT):
    root = Path(root).resolve()
    command = ['node', 'apps/mobile/node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js',
               'resolve', '--platform', 'android', '--json', '--project-root', 'apps/mobile']
    graph = json.loads(subprocess.check_output(command, cwd=root))
    matches = [row for row in graph['modules'] if row['packageName'] == 'omni-local-ai']
    require(len(matches) == 1, 'Expected one locally autolinked omni-local-ai module')
    projects = matches[0]['projects']
    require(len(projects) == 1 and Path(projects[0]['sourceDir']).resolve() == (root / NATIVE).resolve(),
            'Autolinking resolved a different Android source directory')
    require([row['classifier'] for row in projects[0]['modules']] == [CLASS], 'Autolinked class differs')
    return {'status': 'EXPO_AUTOLINKING_PASS', 'module': matches[0]}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = audit_index(args.root)
    result['autolinking'] = audit_autolinking(args.root)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
