"""Parent static artifact review. Never installs/runs a device or grants release rights."""
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
APP=ROOT/'apps/mobile'
APK=APP/'artifacts/Omni-BGC-preview-arm64.apk'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))

inventory=read(ROOT/'data/manifests/offline-pilot-inventory.json')
assert sha(ROOT/'data/manifests/offline-pilot-inventory.json')=='2fa53a5bd54425bad58b86d592fd69baf687ac048a982e3e1e7489ed96cae808'
assert not inventory['distribution_authorized'] and inventory['navigation_eligible_edges']==0
with ZipFile(APK) as archive:
    assert archive.testzip() is None
    checks=[]
    for entry in inventory['files']:
        data=archive.read('assets/omni/'+entry['path'])
        assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256']
        checks.append({'path':entry['path'],'size_bytes':len(data),'sha256':entry['sha256'],'PASS':True})
    assert archive.read('assets/omni/manifest.json')==(ROOT/'data/manifests/offline-pilot-inventory.json').read_bytes()
    assert archive.read('assets/omni/style.json')==(APP/'src/map/pilot-style.json').read_bytes()
    abis=sorted({name.split('/')[1] for name in archive.namelist() if name.startswith('lib/')})
    assert abis==['arm64-v8a']
    bundle=archive.read('assets/index.android.bundle')
    assert len(bundle)>100000
    style=json.loads(archive.read('assets/omni/style.json'))
    assert style['sources']['geography']['url']=='pmtiles://asset://omni/pilot.pmtiles'
    assert style['glyphs'].startswith('asset://') and style['sprite'].startswith('asset://')
    assert any(l['type']=='fill-extrusion' for l in style['layers'])

manifest=APP/'android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml'
xml=ET.parse(manifest).getroot();android='{http://schemas.android.com/apk/res/android}'
permissions=sorted(p.attrib[android+'name'] for p in xml.findall('uses-permission'))
blocked=['ACCESS_BACKGROUND_LOCATION','RECORD_AUDIO','SYSTEM_ALERT_WINDOW','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE']
assert not any('android.permission.'+p in permissions for p in blocked)
application=xml.find('application');assert application is not None
assert application.attrib[android+'allowBackup']=='false'
assert application.attrib.get(android+'debuggable','false')=='false'
assert xml.attrib['package']=='com.omnibgc.preview'
assert xml.attrib[android+'versionName']=='0.1.0'
updates=next(m for m in application.findall('meta-data') if m.attrib.get(android+'name')=='expo.modules.updates.ENABLED')
assert updates.attrib[android+'value']=='false'
signature=(OUT/'signature.log').read_text(encoding='utf-8-sig')
assert signature.startswith('Verifies') and 'v2): true' in signature and 'CN=Android Debug' in signature
badging=(OUT/'badging.log').read_text(encoding='utf-8-sig')
assert "sdkVersion:'24'" in badging and "targetSdkVersion:'36'" in badging and "native-code: 'arm64-v8a'" in badging
build=OUT/'final-build.log'
assert 'BUILD SUCCESSFUL' in build.read_text(encoding='utf-8-sig')

source_map=APP/'android/app/build/generated/sourcemaps/react/release/index.android.bundle.map'
mapping=read(source_map)
audit=read(ROOT/'docs/evaluations/program/security/final-npm-audit.json')
assert 'error' not in audit and audit['metadata']['vulnerabilities']['total']==24
leaf=sorted({v['name'] for package in audit['vulnerabilities'].values() for v in package.get('via',[]) if isinstance(v,dict)})
matches={name:[s for s in mapping['sources'] if ('node_modules/'+name+'/') in s.replace('\\','/')] for name in leaf}
source_records=[]
for path in [APP/'App.tsx',APP/'app.json',APP/'metro.config.js',APP/'package-lock.json',APP/'src/map/MapCanvas.tsx',APP/'plugins/withOfflinePilot.cjs']:
    source_records.append({'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'bytes':path.stat().st_size})
result={
    'reviewed_at_utc':datetime.now(timezone.utc).isoformat(),'parent_decision':'ACCEPT_INTERNAL_PREVIEW_ARTIFACT_ONLY',
    'apk':{'path':APK.relative_to(ROOT).as_posix(),'bytes':APK.stat().st_size,'sha256':sha(APK),'abi':abis,
           'package':xml.attrib['package'],'version_name':'0.1.0','min_sdk':24,'target_sdk':36,
           'signing':'APK v2 verified; Android development key; not production identity'},
    'resource_inventory_sha256':sha(ROOT/'data/manifests/offline-pilot-inventory.json'),'resource_checks':checks,
    'bundled_bytecode_bytes':len(bundle),'permissions':permissions,'allow_backup':False,'debuggable':False,
    'background_location_audio_overlay_external_storage_permissions':False,'expo_auto_updates':False,
    'build':{'result':'PASS','log':build.relative_to(ROOT).as_posix(),'log_sha256':sha(build),'source_map_sha256':sha(source_map)},
    'sources':source_records,'online_audit':audit['metadata']['vulnerabilities'],
    'direct_advisory_package_js_sources':matches,'js_source_count':len(mapping['sources']),
    'physical_device':'NOT_RUN_USER_REQUEST','runtime_offline_and_lifecycle':'UNVERIFIED',
    'performance':'NOT_MEASURED','ios_map':'UNIMPLEMENTED_UNVERIFIED','approved_places_menus_entrances_transit':0,
    'navigation_eligible_real_edges':0,'distribution_authorized':False,'production_accepted':False,
    'limits':['Signature/ZIP/static contents do not prove install/launch/resource requests/native rendering.',
              'JS source inclusion is not runtime/native/host security clearance.',
              'No actual user/field/device or remote CI result is inferred.']}
(OUT/'ARTIFACT.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'apk_bytes':APK.stat().st_size,'apk_sha256':sha(APK),'resource_checks':len(checks),
                  'direct_advisory_source_counts':{k:len(v) for k,v in matches.items()},'source_count':len(mapping['sources']),
                  'decision':result['parent_decision']}))
