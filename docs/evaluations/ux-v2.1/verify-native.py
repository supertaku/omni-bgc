"""Static APK/source/resource proof, separate from native interaction evidence."""
import hashlib,json,re
from pathlib import Path
from zipfile import ZipFile

root=Path(__file__).resolve().parents[3]
out=Path(__file__).resolve().parent
apk=root/'apps/mobile/artifacts/Omni-BGC-UX-V2.1-0.3.1-arm64.apk'
sha=lambda data:hashlib.sha256(data).hexdigest()
report={'apk':str(apk),'apkSha256':sha(apk.read_bytes()),'bytes':apk.stat().st_size,'checks':[]}
with ZipFile(apk) as archive:
    data=archive.read('lib/arm64-v8a/libexpo-sqlite.so')
    strings=set(re.findall(rb'[ -~]{4,}',data))
    assert {b'ENABLE_RTREE',b'ENABLE_FTS5',b'rtree'}<=strings
    report['checks'].append('SQLite contains RTree and FTS5 compile/module strings (static binary evidence)')
    manifest=json.loads(archive.read('assets/omni/manifest.json'))
    local=json.loads((root/'apps/mobile/assets/generated/omni/manifest.json').read_text())
    assert manifest==local
    for entry in manifest['files']:
        data=archive.read('assets/omni/'+entry['path'])
        assert len(data)==entry['bytes'] and sha(data)==entry['sha256'],entry['path']
    report['checks'].append(f"All {len(manifest['files'])} offline map resources match inventory")
    report['mapManifestSha256']=sha(archive.read('assets/omni/manifest.json'))
mapping=json.loads((root/'apps/mobile/android/app/build/generated/sourcemaps/react/release/index.android.bundle.map').read_text(encoding='utf-8'))
matched=[]
for needle in ['App.tsx','src/ui/ExplorerPager.tsx','src/ui/useShakeNavigation.ts','src/ui/shake-detector.ts','src/ui/components.tsx','src/features/explore/PlaceDetails.tsx','src/features/explore/MapChrome.tsx','src/features/assistant/AssistantScreen.tsx','src/map/MapCanvas.tsx','src/data/localHealth.ts']:
    entries=[content for source,content in zip(mapping['sources'],mapping.get('sourcesContent',[])) if source.replace('\\','/').endswith('/'+needle)]
    assert len(entries)==1,needle
    local=root/'apps/mobile'/needle
    assert entries[0].replace('\r\n','\n')==local.read_text(encoding='utf-8').replace('\r\n','\n'),needle
    matched.append({'path':'apps/mobile/'+needle,'sha256':sha(local.read_bytes())})
report['matchedSources']=matched
report['passed']=True
report['interpretation']='Current source, native library and resource proof; physical interaction is recorded separately.'
(out/'bundle-verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print('PASS exact final bundled modules, offline resources and SQLite capability strings')
