"""Verify the final bundle/resources/capability strings; never claims device execution."""
import hashlib, json, re
from pathlib import Path
from zipfile import ZipFile
root=Path(__file__).resolve().parents[3]
out=root/'docs/evaluations/ux-v2'
apk=root/'apps/mobile/artifacts/Omni-BGC-preview-arm64.apk'
with ZipFile(apk) as archive:
    name='lib/arm64-v8a/libexpo-sqlite.so'
    data=archive.read(name)
    strings=set(re.findall(rb'[ -~]{4,}',data))
    checks={'rtreeCompileString':b'ENABLE_RTREE' in strings,'fts5CompileString':b'ENABLE_FTS5' in strings,'hasRtreeModuleText':b'rtree' in strings}
    assert all(checks.values()),checks
    report={'apk':str(apk),'apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'sqliteLibraries':[{'path':name,'sha256':hashlib.sha256(data).hexdigest(),**checks}],'interpretation':'Rebuilt binary contains both compiled capability strings and RTree module text. Static evidence, not a device runtime query.'}
    (out/'rebuilt-sqlite-capabilities.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
mapping=json.loads((root/'apps/mobile/android/app/build/generated/sourcemaps/react/release/index.android.bundle.map').read_text(encoding='utf-8'))
matched=[]
for needle in ['apps/mobile/App.tsx','src/ui/ExplorerPager.tsx','src/ui/RouteWorkflowPreview.tsx','src/features/assistant/AssistantScreen.tsx','src/data/localHealth.ts','src/map/MapCanvas.tsx']:
    entries=[(source,content) for source,content in zip(mapping['sources'],mapping.get('sourcesContent',[])) if source.replace('\\','/').endswith(needle) or source.replace('\\','/').endswith(needle.removeprefix('apps/mobile/'))]
    assert len(entries)==1,needle
    local=root/(needle if needle.startswith('apps/') else 'apps/mobile/'+needle)
    assert entries[0][1].replace('\r\n','\n')==local.read_text(encoding='utf-8').replace('\r\n','\n'),needle
    matched.append({'path':str(local),'sha256':hashlib.sha256(local.read_bytes()).hexdigest()})
(out/'bundle-source-verification.json').write_text(json.dumps({'apkSha256':report['apkSha256'],'matchedSources':matched,'passed':True},indent=2)+'\n',encoding='utf-8')
print('PASS native SQLite capability strings and six final bundled source modules; device runtime NOT_RUN')
