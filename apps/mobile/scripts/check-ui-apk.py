"""Inspect the built archive; does not imply Android launch or rendering passed."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT=Path(__file__).resolve().parents[3]
apk=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'apps/mobile/artifacts/Omni-BGC-preview-arm64.apk'
inventory=json.loads((ROOT/'data/manifests/offline-pilot-inventory.json').read_text(encoding='utf-8'))
font_inventory=json.loads((ROOT/'apps/mobile/assets/fonts/manifest.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(apk) as archive:
    names=archive.namelist()
    assert archive.testzip() is None
    assert archive.read('assets/omni/manifest.json')==(ROOT/'data/manifests/offline-pilot-inventory.json').read_bytes()
    for entry in inventory['files']:
        data=archive.read('assets/omni/'+entry['path'])
        assert len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256'],entry['path']
    ttf={hashlib.sha256(archive.read(name)).hexdigest() for name in names if name.endswith('.ttf')}
    expected=[entry for entry in font_inventory['files'] if entry['path'] in ('Nunito-Bold.ttf','NunitoSans-Regular.ttf','NunitoSans-SemiBold.ttf')]
    assert all(entry['sha256'] in ttf for entry in expected),'Static native fonts missing from archive'
    icon=ROOT/'apps/mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'
    assert hashlib.sha256(icon.read_bytes()).hexdigest() in ttf,'Offline icon font missing'
    assert 'assets/index.android.bundle' in names
    assert set(name.split('/')[1] for name in names if name.startswith('lib/') and name.endswith('.so'))=={'arm64-v8a'}
report={'path':str(apk.resolve()),'bytes':apk.stat().st_size,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),
        'mapResourcesVerified':len(inventory['files']),'offlineFontWeightsVerified':len(expected),
        'offlineIconFontVerified':True,'abi':'arm64-v8a','archiveIntegrity':'PASS','nativeLaunch':'NOT_RUN'}
target=ROOT/'docs/evaluations/ux-program/apk-verification.json'
target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
