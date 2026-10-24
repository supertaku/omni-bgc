"""Verify an ARM64 release APK and record the exact source/build provenance."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import tomllib
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('apk', type=Path)
parser.add_argument('--report', type=Path)
parser.add_argument('--require-clean', action='store_true')
parser.add_argument('--expected-signer-sha256')
args = parser.parse_args()
apk = args.apk.resolve()

def digest(data): return hashlib.sha256(data).hexdigest()
def file_digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''): h.update(block)
    return h.hexdigest()
def run(*command):
    return subprocess.run(command, cwd=root, check=True, text=True, capture_output=True).stdout.strip()
def sdk_tool(name):
    sdk = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
    if not sdk and os.name == 'nt': sdk = str(Path.home() / 'AppData/Local/Android/Sdk')
    if not sdk: raise RuntimeError('Set ANDROID_HOME or ANDROID_SDK_ROOT')
    suffix = '.exe' if os.name == 'nt' and name == 'aapt' else '.bat' if os.name == 'nt' else ''
    tools = sorted((Path(sdk) / 'build-tools').glob(f'*/{name}{suffix}'), reverse=True)
    if not tools: raise RuntimeError(f'Missing Android SDK build tool: {name}')
    return str(tools[0])

source_commit = run('git', 'rev-parse', 'HEAD')
dirty = run('git', 'status', '--porcelain', '--untracked-files=normal')
if args.require_clean and dirty: raise ValueError('Clean committed source required')
config = json.loads((root / 'app.json').read_text(encoding='utf-8'))['expo']
badging = run(sdk_tool('aapt'), 'dump', 'badging', str(apk))
package = re.search(r"^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging, re.M)
minimum = re.search(r"^sdkVersion:'(\d+)'", badging, re.M)
target = re.search(r"^targetSdkVersion:'(\d+)'", badging, re.M)
label = re.search(r"^application-label:'([^']+)'", badging, re.M)
assert package and minimum and target and label, 'Incomplete APK manifest badging'
permissions = set(re.findall(r"^uses-permission(?:-sdk-\d+)?: name='([^']+)'", badging, re.M))
assert (package[1], int(package[2]), package[3], label[1]) == (config['android']['package'], config['android']['versionCode'], config['version'], config['name']), 'Package/version/label mismatch'
assert int(minimum[1]) == 26 and 'application-debuggable' not in badging, 'Unexpected minimum SDK or debuggable release'
assert set(config['android']['permissions']) <= permissions, 'Required location permission absent'
assert not set(config['android']['blockedPermissions']) & permissions, 'Blocked permission packaged'
signature = run(sdk_tool('apksigner'), 'verify', '--verbose', '--print-certs', str(apk))
assert re.search(r'^Verifies$', signature, re.M) and re.search(r'^Verified using v[23](?:\.1)? scheme .*: true$', signature, re.M), 'APK signature verification failed'
signer = re.search(r'^(?:Signer #1|V2 Signer):? certificate SHA-256 digest: ([0-9a-f]{64})$', signature, re.M)
assert signer and re.search(r'^Number of signers: 1$', signature, re.M), 'Expected one identifiable signer'
if args.expected_signer_sha256 and signer[1] != args.expected_signer_sha256.lower(): raise ValueError('APK signer differs from expected upgrade signer')
with zipfile.ZipFile(apk) as bundle:
    assert bundle.testzip() is None, 'APK ZIP CRC failed'
    names = bundle.namelist()
    libs = [name for name in names if name.startswith('lib/') and name.endswith('.so')]
    assert {name.split('/')[1] for name in libs} == {'arm64-v8a'}, 'Unexpected ABI'
    for library in ['liblitertlm_jni.so', 'libmaplibre.so']:
        assert f'lib/arm64-v8a/{library}' in libs, f'Missing native library: {library}'
    assert any('hermes' in name for name in libs), 'Missing Hermes native runtime'
    js = bundle.read('assets/index.android.bundle')
    preview = json.loads((root / 'assets/generated/preview/overlay.json').read_text(encoding='utf-8'))
    assert preview['fingerprint'].encode() in js, 'Current preview fingerprint absent from Hermes bundle'
    generated = root / 'android/app/build/generated/assets/react/release/index.android.bundle'
    assert js == generated.read_bytes(), 'APK does not contain final generated Hermes bundle'
    for token in [b'flat-v1', b'illustrated-v1', b'e6687177e00897731e7716267eebd4eba0dde7c2', b'resolveMapResultRecords', b'Choose map point']:
        assert token in js, f'Integrated feature absent: {token!r}'
    source_map = json.loads((root / 'android/app/build/generated/sourcemaps/react/release/index.android.bundle.map').read_text(encoding='utf-8'))
    checked_sources = set()
    for source, content in zip(source_map['sources'], source_map['sourcesContent']):
        normalized = source.replace('\\', '/').lstrip('/')
        if normalized.startswith('../'): normalized = normalized[3:]
        if normalized.startswith('src/') and normalized.endswith(('.ts', '.tsx')):
            local = root / normalized
            if local.is_file():
                assert content.replace('\r\n', '\n') == local.read_text(encoding='utf-8-sig'), f'Stale APK source: {normalized}'
                checked_sources.add(normalized)
    for source in ['src/app/Application.tsx', 'src/map/MapCanvas.tsx', 'src/map/presentation.ts',
                   'src/map/style-transition.ts', 'src/features/assistant/mapResults.ts',
                   'src/features/assistant/useAssistantConversation.ts', 'src/ai/modelCatalog.ts',
                   'src/ai/modelManager.ts', 'src/ai/hybridAssistant.ts']:
        assert source in checked_sources, f'Missing source-map evidence: {source}'
    resources = 0
    map_receipts = {}
    for pack, inventory in [('omni', 'bundled-resources.json'), ('gex', 'expanded-resources.json')]:
        receipt = json.loads((root / 'src/map' / inventory).read_text(encoding='utf-8-sig'))
        assert digest(bundle.read(f'assets/{pack}/manifest.json')) == receipt['packSha256']
        for entry in receipt['files']:
            data = bundle.read(f"assets/{pack}/{entry['path']}")
            assert len(data) == entry['bytes'] and digest(data) == entry['sha256'], entry['path']
            resources += 1
        map_receipts[pack] = receipt['packSha256']
    context = json.loads((root / 'assets/generated/context/manifest.json').read_text())['files'][0]
    data = bundle.read('assets/context/context.pmtiles')
    assert len(data) == context['bytes'] and digest(data) == context['sha256'], 'Context archive mismatch'
    assert not any(name.endswith(('.litertlm', '.gguf', '.tflite')) for name in names), 'Model weights bundled'
    media = json.loads((root / 'assets/generated/preview-media/manifest.json').read_text(encoding='utf-8'))['entries']
    packed_webp = {digest(bundle.read(name)) for name in names if name.startswith('res/') and name.endswith('.webp')}
    assert len(media) == 24, 'Unexpected preview media inventory'
    for entry in media:
        source = root / 'assets/generated/preview-media' / entry['file']
        assert source.stat().st_size == entry['bytes'] and file_digest(source) == entry['sha256'], f"Preview media source changed: {entry['file']}"
        assert entry['sha256'] in packed_webp, f"Preview media absent from APK: {entry['file']}"
for path, expected in preview['inputs'].items():
    assert file_digest(root / path) == expected, f'Preview input changed: {path}'
wrapper = (root / 'android/gradle/wrapper/gradle-wrapper.properties').read_text(encoding='utf-8')
gradle = re.search(r'gradle-([\d.]+)-bin\.zip', wrapper)
properties = (root / 'android/gradle.properties').read_text(encoding='utf-8')
kotlin = re.search(r'^android\.kotlinVersion=(\S+)$', properties, re.M)
sdk = Path(os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT') or str(Path.home() / 'AppData/Local/Android/Sdk'))
android_versions = tomllib.loads((root / 'node_modules/react-native/gradle/libs.versions.toml').read_text(encoding='utf-8'))['versions']
assert target[1] == android_versions['targetSdk'], 'Unexpected target SDK'
assert (sdk / 'ndk' / android_versions['ndkVersion']).is_dir(), 'Pinned NDK missing'
assert (sdk / 'platforms' / ('android-' + android_versions['compileSdk'])).is_dir(), 'Pinned Android platform missing'
assert (sdk / 'build-tools' / android_versions['buildTools']).is_dir(), 'Pinned Android build tools missing'
java = subprocess.run(['java', '-version'], capture_output=True, text=True, check=True)
report = dict(result='PASS', apk=str(apk), bytes=apk.stat().st_size, sha256=file_digest(apk),
              sourceCommit=source_commit, sourceClean=not bool(dirty),
              dependencyLockSha256=file_digest(root / 'package-lock.json'),
              toolchain=dict(node=run('node', '--version'), java=java.stderr.splitlines()[0],
                             gradle=gradle[1] if gradle else None, kotlin=kotlin[1] if kotlin else None,
                             androidSdk=str(sdk), compileSdk=android_versions['compileSdk'],
                             buildTools=android_versions['buildTools'], ndk=android_versions['ndkVersion'],
                             androidGradlePlugin=android_versions['agp']),
              package=package[1], version=package[3], versionCode=int(package[2]), minSdk=int(minimum[1]), targetSdk=int(target[1]),
              permissions=sorted(permissions), signerCertificateSha256=signer[1],
              abi='arm64-v8a', nativeLibraries=len(libs), mapResourceFiles=resources,
              mapPackSha256=map_receipts, contextBytes=context['bytes'], contextSha256=context['sha256'],
              previewFingerprint=preview['fingerprint'], previewInputs=preview['inputs'],
              previewMediaFiles=len(media), previewMediaManifestSha256=file_digest(root / 'assets/generated/preview-media/manifest.json'),
              jsBundleBytes=len(js), currentSourcesVerified=len(checked_sources),
              zipCRC='PASS', signature='PASS', bundledModels=False)
output = json.dumps(report, indent=2) + '\n'
if args.report:
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(output, encoding='utf-8')
print(output, end='')
