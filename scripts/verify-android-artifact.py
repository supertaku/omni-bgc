"""Verify local release contents against current source; SDK signing is checked separately."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
apk = Path(sys.argv[1]).resolve()
digest = lambda data: hashlib.sha256(data).hexdigest()
with zipfile.ZipFile(apk) as bundle:
    assert bundle.testzip() is None, 'APK ZIP CRC failed'
    names = bundle.namelist()
    libs = [name for name in names if name.startswith('lib/') and name.endswith('.so')]
    assert {name.split('/')[1] for name in libs} == {'arm64-v8a'}, 'Unexpected ABI'
    for library in ['liblitertlm_jni.so', 'libmaplibre.so']:
        assert f'lib/arm64-v8a/{library}' in libs, f'Missing native library: {library}'
    assert any('hermes' in name for name in libs), 'Missing Hermes native runtime'
    js = bundle.read('assets/index.android.bundle')
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
    for pack, inventory in [('omni', 'bundled-resources.json'), ('gex', 'expanded-resources.json')]:
        receipt = json.loads((root / 'src/map' / inventory).read_text(encoding='utf-8-sig'))
        assert digest(bundle.read(f'assets/{pack}/manifest.json')) == receipt['packSha256']
        for entry in receipt['files']:
            data = bundle.read(f"assets/{pack}/{entry['path']}")
            assert len(data) == entry['bytes'] and digest(data) == entry['sha256'], entry['path']
            resources += 1
    context = json.loads((root / 'assets/generated/context/manifest.json').read_text())['files'][0]
    data = bundle.read('assets/context/context.pmtiles')
    assert len(data) == context['bytes'] and digest(data) == context['sha256'], 'Context archive mismatch'
    assert not any(name.endswith(('.litertlm', '.gguf', '.tflite')) for name in names), 'Model weights bundled'
    report = dict(apk=str(apk), bytes=apk.stat().st_size, sha256=digest(apk.read_bytes()),
                  abi='arm64-v8a', nativeLibraries=len(libs), originalResources=resources,
                  contextBytes=context['bytes'], contextSha256=context['sha256'],
                  jsBundleBytes=len(js), currentSourcesVerified=len(checked_sources),
                  zipCRC='PASS', bundledModels=False)
print(json.dumps(report, indent=2))
