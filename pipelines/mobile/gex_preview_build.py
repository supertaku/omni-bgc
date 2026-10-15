"""Host-only isolated ARM64 GEX preview APK build; never contacts Android devices.

Stages existing pinned source/dependencies/caches, uses CNG only in staging, and
embeds the production Metro/Hermes bundle. A distinct staging package leaves the
installed preview and the independent AI implementation untouched.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'apps/mobile'
PREVIEW_PACKAGES = {'com.omnibgc.gexpreview': 'GEX', 'com.omnibgc.officespreview': 'Offices'}
PACKAGE = 'com.omnibgc.gexpreview'
JDK = Path('C:/Program Files/Android/Android Studio/jbr')
JDK17 = ROOT / '.g/jdks/eclipse_adoptium-17-amd64-windows.2'
SDK = Path(os.environ.get('GEX_ANDROID_SDK_ROOT', str(ROOT.parents[1] / 'AppData/Local/Android/Sdk')))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
load = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def isolated(name):
    path = (ROOT / '.g' / name).resolve()
    require(path.parent == (ROOT / '.g').resolve() and path.name.startswith('gex-native-'), 'Only direct .g/gex-native-* output paths allowed')
    return path


def ignore_copy(base, names):
    parts = Path(base).parts
    native = any(part in ('android', 'ios', 'ReactAndroid') or 'gradle-plugin' in part for part in parts)
    ignored = {'.git', '.g', '.gradle', '.cxx', '.expo', '.cache', '__pycache__', 'artifacts'}
    if native: ignored.add('build')
    return set(names) & ignored


def extended(path):
    """Use Win32 extended paths for dependency copies; no OS setting change."""
    value = str(Path(path).resolve())
    return '\\\\?\\' + value if os.name == 'nt' and not value.startswith('\\\\?\\') else value


def source_files():
    roots = [(APP, 'apps/mobile'), (ROOT/'packages', 'packages'), (ROOT/'data/manifests', 'data/manifests'), (ROOT/'docs/geography', 'docs/geography')]
    records = []
    for directory, prefix in roots:
        for base, dirs, files in os.walk(directory):
            excluded = ignore_copy(base, dirs)
            if directory == APP and Path(base) == APP: excluded.update({'node_modules', 'android', 'ios'})
            dirs[:] = sorted(set(dirs)-excluded)
            for name in sorted(files):
                path = Path(base)/name
                records.append({'path': prefix + '/' + path.relative_to(directory).as_posix(), 'bytes': path.stat().st_size, 'sha256': sha(path)})
    return records


def source_unchanged(stage):
    receipt = load(stage/'source-receipt.json')
    for row in receipt['staged_sources']:
        path = stage / row['path']
        require(path.is_file() and sha(path) == row['sha256'], 'Frozen staging source changed: '+row['path'])
    # Parallel office UI work may evolve in the shared checkout. Bundle contracts
    # and exact geography approval must still agree with the frozen preview.
    critical=('apps/mobile/src/map/expanded-', 'apps/mobile/src/map/bundled-map-catalog.json', 'apps/mobile/src/map/offlineResources.ts', 'apps/mobile/src/map/bundled-catalog.ts', 'apps/mobile/plugins/withOfflinePilot.cjs', 'apps/mobile/assets/generated/gex/', 'apps/mobile/assets/generated/omni/', 'data/manifests/service-area-v2.json', 'docs/geography/internal-pack-approval.json')
    for row in receipt['sources']:
        if row['path'].startswith(critical):
            require(sha(ROOT/row['path'])==row['sha256'],'Shared GEX resource contract changed: '+row['path'])
    return receipt


def configure_staging(stage):
    mobile=stage/'apps/mobile'
    config=load(mobile/'app.json');config['expo']['android']['package']=PACKAGE
    label=PREVIEW_PACKAGES[PACKAGE]
    config['expo']['name']='Omni-BGC '+label+' Preview';config['expo']['scheme']='omni-bgc-'+label.lower()+'-preview'
    dump(mobile/'app.json',config)
    metro=mobile/'metro.config.js';original=metro.read_text(encoding='utf-8')
    lines=[line for line in original.splitlines() if r'\.g' not in line]
    require(len(lines)<len(original.splitlines()),'Expected staging-parent .g Metro block found')
    metro.write_text('\n'.join(lines)+'\n',encoding='utf-8')


def staged_records(stage,sources):
    return [{'path':row['path'],'sha256':sha(stage/row['path']),'bytes':(stage/row['path']).stat().st_size} for row in sources]


def refresh(stage):
    require(not (stage/'assemble-release.log').exists(),'Use a new build revision after native compilation starts')
    receipt=load(stage/'source-receipt.json');sources=source_files()
    shutil.copytree(APP,stage/'apps/mobile',dirs_exist_ok=True,ignore=lambda base,names:ignore_copy(base,names)|({'node_modules'} if Path(base)==APP else set()))
    for relative in ('packages','data/manifests','docs/geography'):shutil.copytree(ROOT/relative,stage/relative,dirs_exist_ok=True,ignore=ignore_copy)
    for row in sources:require(sha(stage/row['path'])==row['sha256'],'Authored copy raced another edit: '+row['path'])
    configure_staging(stage)
    receipt.update(sources=sources,staged_sources=staged_records(stage,sources))
    dump(stage/'source-receipt.json',receipt);source_unchanged(stage)
    print(json.dumps({'refreshed':str(stage),'source_files':len(sources),'source_bytes':sum(row['bytes'] for row in sources)}),flush=True)


def environment(cache):
    require((JDK/'bin/java.exe').is_file() and SDK.is_dir(), 'Existing pinned JDK/SDK required')
    result = os.environ.copy()
    result.update(JAVA_HOME=str(JDK), ANDROID_HOME=str(SDK), ANDROID_SDK_ROOT=str(SDK), GRADLE_USER_HOME=str(cache), NODE_ENV='production', EXPO_PUBLIC_NATIVE_QA='0', NODE_OPTIONS='--dns-result-order=ipv4first', EXPO_OFFLINE='1', EXPO_NO_TELEMETRY='1', CI='1')
    return result


def run(command, cwd, log, env):
    started = time.perf_counter()
    if log.exists():
        log.rename(log.with_name(log.stem + '-previous-' + str(time.time_ns()) + log.suffix))
    with log.open('w', encoding='utf-8') as output:
        output.write(json.dumps({'argv':command,'cwd':str(cwd)},ensure_ascii=False)+'\n'); output.flush()
        result = subprocess.run(command, cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT, shell=False)
    print(json.dumps({'command':command,'exit_code':result.returncode,'seconds':round(time.perf_counter()-started,3),'log':str(log)}),flush=True)
    require(result.returncode == 0, 'Command failed; inspect '+str(log))


def prepare(stage, cache, build_home):
    require(not (stage/'source-receipt.json').exists() and not build_home.exists(), 'Completed staging/build directories already exist; use a new revision')
    sources = source_files()
    stage.mkdir(parents=True,exist_ok=True)
    mobile = stage/'apps/mobile'
    print('Copying authored source and native templates into isolated staging.',flush=True)
    shutil.copytree(APP, mobile, dirs_exist_ok=True, ignore=lambda base,names: ignore_copy(base,names) | ({'node_modules'} if Path(base)==APP else set()))
    for relative in ('packages','data/manifests','docs/geography'):
        shutil.copytree(ROOT/relative,stage/relative,ignore=ignore_copy,dirs_exist_ok=True)
    for name in ('package.json','package-lock.json'):
        if (ROOT/name).is_file(): shutil.copyfile(ROOT/name,stage/name)
    for row in sources:
        copied=stage/row['path']
        require(copied.is_file() and sha(copied)==row['sha256'],'Copied source differs: '+row['path'])
    print('Copying pinned npm modules; native build outputs/caches excluded, JS build directories retained.',flush=True)
    shutil.copytree(extended(APP/'node_modules'),extended(mobile/'node_modules'),ignore=ignore_copy,dirs_exist_ok=True)
    if not cache.exists():
        cache.mkdir(parents=True)
        for relative in ('caches/modules-2','caches/9.3.1','wrapper/dists'):
            print('Copying existing offline Gradle cache '+relative,flush=True)
            shutil.copytree(extended(ROOT/'.g'/relative),extended(cache/relative),ignore=lambda base,names: {n for n in names if n.endswith('.lock') or n.endswith('.lck')})
    build_home.mkdir(parents=True)
    # All package/name/Metro/build-directory changes occur exclusively in staging.
    configure_staging(stage)
    # Shared sources are frozen; native/module build paths all point to private
    # copied modules or the isolated short build root, never the source checkout.
    write_init(stage,build_home)
    receipt={'format_version':1,'source_root':str(ROOT),'stage':str(stage),'cache':str(cache),'build_home':str(build_home),'package':PACKAGE,'sources':sources,'source_package_lock_sha256':sha(APP/'package-lock.json'),'staging_only_changes':['Android application package/name/scheme','Remove Metro .g ancestor exclusion for isolated staging','Private short app/CMake outputs; retain conventional private root/module paths for autolinking/codegen'],'device_operations':False,'dependencies_upgraded':False,'distribution_authorized':False}
    receipt['staged_sources']=staged_records(stage,sources)
    dump(stage/'source-receipt.json',receipt)
    source_unchanged(stage)
    print(json.dumps({'prepared':str(stage),'copied_source_files':len(sources),'source_bytes':sum(row['bytes'] for row in sources),'package':PACKAGE}),flush=True)


def write_init(stage,build_home):
    # RN settings/codegen embed conventional root/module build paths. Keep
    # those inside the copied tree; only app outputs use the private short root.
    groovy="""gradle.beforeProject { project ->
    def rootKey = Integer.toUnsignedString(project.rootProject.projectDir.absolutePath.hashCode(), 36)
    if (project.path == ':app') {
        project.layout.buildDirectory.set(new File('BUILD_HOME', rootKey + '/app'))
    }
    ['com.android.application', 'com.android.library'].each { pluginId ->
        project.plugins.withId(pluginId) {
            def android = project.extensions.getByName('android')
            def key = project.path == ':app' ? 'a' : Integer.toUnsignedString(project.projectDir.absolutePath.hashCode(), 36)
            android.externalNativeBuild.cmake.buildStagingDirectory = new File('BUILD_HOME', 'x/' + key)
            android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_OBJECT_PATH_MAX=250')
        }
    }
}
""".replace('BUILD_HOME',build_home.as_posix())
    (stage/'isolated-build.init.gradle').write_text(groovy,encoding='utf-8')


def prebuild(stage,cache):
    receipt=source_unchanged(stage)
    native=[]
    for base,dirs,files in os.walk(APP/'android'):
        dirs[:]=sorted(set(dirs)-ignore_copy(base,dirs))
        for name in sorted(files):
            path=Path(base)/name
            native.append({'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path)})
    receipt['preserved_main_native_files']=native
    dump(stage/'source-receipt.json',receipt)
    mobile=stage/'apps/mobile'
    run(['node','node_modules/expo/bin/cli','prebuild','--platform','android','--no-install'],mobile,stage/'prebuild.log',environment(cache))
    original_package=next(row for row in receipt['staged_sources'] if row['path']=='apps/mobile/package.json')
    if sha(mobile/'package.json')!=original_package['sha256']:
        original_package.update(sha256=sha(mobile/'package.json'),bytes=(mobile/'package.json').stat().st_size)
        receipt['cng_package_metadata_changed']=True
        dump(stage/'source-receipt.json',receipt)
    gradle=mobile/'android/app/build.gradle'
    content=gradle.read_text(encoding='utf-8')
    require(PACKAGE in content,'Staged CNG did not use distinct preview package')
    content=content.replace('    bundleCommand = "export:embed"','    bundleCommand = "export:embed"\n    extraPackagerArgs = ["--max-workers", "2"]')
    gradle.write_text(content,encoding='utf-8')
    source_unchanged(stage)


def build(stage,cache):
    source_unchanged(stage)
    write_init(stage,Path(load(stage/'source-receipt.json')['build_home']))
    require((JDK17/'bin/java.exe').is_file(), 'Existing offline Java 17 compiler toolchain required')
    mobile=stage/'apps/mobile'
    command=[str(mobile/'android/gradlew.bat'),'-p',str(mobile/'android'),':app:assembleRelease','--gradle-user-home',str(cache),'--offline','--no-daemon','--max-workers','2','--console=plain','--stacktrace','-PreactNativeArchitectures=arm64-v8a','-Pkotlin.compiler.execution.strategy=in-process','-Dorg.gradle.java.installations.paths='+str(JDK17),'-Dorg.gradle.java.installations.auto-download=false','--init-script',str(stage/'isolated-build.init.gradle')]
    run(command,mobile,stage/'assemble-release.log',environment(cache))
    source_unchanged(stage)


def verify(stage,cache,build_home):
    receipt=source_unchanged(stage)
    apks=list(build_home.rglob('app-release.apk'))
    require(len(apks)==1,'Expected exactly one staged release APK')
    apk=stage/('Omni-BGC-'+PREVIEW_PACKAGES[PACKAGE]+'-preview-arm64.apk');shutil.copyfile(apks[0],apk)
    checks=[]
    with ZipFile(apk) as archive:
        require(archive.testzip() is None,'APK ZIP CRC failure')
        names=archive.namelist();abis=sorted({name.split('/')[1] for name in names if name.startswith('lib/')})
        require(abis==['arm64-v8a'],'APK must contain only ARM64 native libraries')
        require(len(archive.read('assets/index.android.bundle'))>100000,'Embedded release bundle absent')
        bundle=archive.read('assets/index.android.bundle')
        for namespace in ('omni','gex'):
            source=stage/'apps/mobile/assets/generated'/namespace
            inventory=load(source/'manifest.json')
            require(archive.read('assets/'+namespace+'/manifest.json')==(source/'manifest.json').read_bytes(),'APK manifest differs: '+namespace)
            for entry in inventory['files']:
                data=archive.read('assets/'+namespace+'/'+entry['path'])
                require(len(data)==entry['bytes'] and hashlib.sha256(data).hexdigest()==entry['sha256'],'APK resource differs: '+namespace+'/'+entry['path'])
                checks.append({'namespace':namespace,**entry})
    tools=SDK/'build-tools/36.0.0'
    run([str(JDK/'bin/java.exe'),'-jar',str(tools/'lib/apksigner.jar'),'verify','--verbose','--print-certs',str(apk)],stage,stage/'signature.log',environment(cache))
    run([str(tools/'aapt.exe'),'dump','badging',str(apk)],stage,stage/'badging.log',environment(cache))
    run([str(tools/'aapt.exe'),'dump','permissions',str(apk)],stage,stage/'permissions.log',environment(cache))
    run([str(tools/'aapt.exe'),'dump','xmltree',str(apk),'AndroidManifest.xml'],stage,stage/'manifest-tree.log',environment(cache))
    badging=(stage/'badging.log').read_text(encoding='utf-8');signature=(stage/'signature.log').read_text(encoding='utf-8')
    require("name='"+PACKAGE+"'" in badging,'APK package identity differs')
    require("native-code: 'arm64-v8a'" in badging and "sdkVersion:'24'" in badging and "targetSdkVersion:'36'" in badging,'Unexpected native platform configuration')
    require('Verifies' in signature and 'v2): true' in signature and 'CN=Android Debug' in signature,'Existing internal development signature did not verify')
    permissions=(stage/'permissions.log').read_text(encoding='utf-8')
    blocked=('ACCESS_BACKGROUND_LOCATION','RECORD_AUDIO','SYSTEM_ALERT_WINDOW','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE')
    require(not any('android.permission.'+name in permissions for name in blocked),'Unexpected prohibited permission in preview APK')
    manifest_tree=(stage/'manifest-tree.log').read_text(encoding='utf-8')
    backup=next((line for line in manifest_tree.splitlines() if 'android:allowBackup' in line),'')
    require('(type 0x12)0x0' in backup,'Preview backup policy differs')
    debuggable=next((line for line in manifest_tree.splitlines() if 'android:debuggable' in line),'')
    require(not debuggable or '(type 0x12)0x0' in debuggable,'Release APK unexpectedly debuggable')
    mappings=list(build_home.rglob('index.android.bundle.map'))
    require(len(mappings)==1,'Expected one source map from release bundling')
    mapping=load(mappings[0]);require(isinstance(mapping.get('sourcesContent'),list),'Release source content unavailable')
    matched={}
    required_sources=('src/map/MapCanvas.tsx','src/map/bundled-catalog.ts','src/data/store.ts','App.tsx')
    for suffix in required_sources:
        candidates=[(s,c) for s,c in zip(mapping['sources'],mapping['sourcesContent']) if s.replace('\\','/').endswith(suffix)]
        require(candidates,'Required current source absent from release map: '+suffix)
        require(len(candidates)==1 and candidates[0][1] is not None,'Ambiguous source-map content: '+suffix)
        path=stage/'apps/mobile'/suffix
        require(candidates[0][1]==path.read_text(encoding='utf-8'),'Bundled source differs from staged authored content: '+suffix)
        matched[suffix]=sha(path)
    require(set(required_sources)==set(matched),'Current map/store/catalog interfaces must all be embedded')
    run(['node','--version'],stage,stage/'node-version.log',environment(cache))
    run([str(JDK/'bin/java.exe'),'-version'],stage,stage/'java-version.log',environment(cache))
    snapshot=stage/'staged-source-snapshot.zip'
    changes=[]
    with ZipFile(snapshot,'w',compression=ZIP_DEFLATED) as archive:
        for row in receipt['sources']:
            path=stage/row['path']
            current=sha(path)
            if current!=row['sha256']:changes.append({'path':row['path'],'original_sha256':row['sha256'],'staged_sha256':current})
            archive.write(path,row['path'])
    versions={name:load(stage/'apps/mobile/node_modules'/name/'package.json')['version'] for name in ('expo','react-native','@maplibre/maplibre-react-native','expo-sqlite','expo-file-system','expo-crypto','expo-sensors','typescript')}
    result={'format_version':1,'status':'HOST_BUILD_AND_STATIC_APK_VERIFIED','apk':{'path':str(apk),'bytes':apk.stat().st_size,'sha256':sha(apk),'package':PACKAGE,'abi':abis,'signing':'Existing development key; APK v2 verified; internal preview only'},'source_receipt_sha256':sha(stage/'source-receipt.json'),'source_map':{'path':str(mappings[0]),'sha256':sha(mappings[0]),'source_count':len(mapping['sources']),'matched_current_sources':matched},'embedded_bundle':{'bytes':len(bundle),'sha256':hashlib.sha256(bundle).hexdigest()},'resource_checks':checks,'resource_check_count':len(checks),'source_bytes':sum(row['bytes'] for row in receipt['sources']),'logs':{name:sha(stage/name) for name in ('prebuild.log','assemble-release.log','signature.log','badging.log','node-version.log','java-version.log')},'catalog_selection':load(stage/'apps/mobile/src/map/bundled-map-catalog.json')['selected'],'physical_device_tested':False,'usb_used':False,'installed':False,'distribution_authorized':False,'runtime_offline_render_performance':'UNVERIFIED'}
    divergence=[{'path':row['path'],'frozen_source_sha256':row['sha256'],'current_source_sha256':sha(ROOT/row['path']) if (ROOT/row['path']).is_file() else None} for row in receipt['sources'] if not (ROOT/row['path']).is_file() or sha(ROOT/row['path'])!=row['sha256']]
    result.update(source_snapshot_archive={'path':str(snapshot),'bytes':snapshot.stat().st_size,'sha256':sha(snapshot)},staging_only_source_changes=changes,tool_versions=versions,main_native_files_preserved=len(receipt.get('preserved_main_native_files',[])),allow_backup=False,debuggable=False,permission_log_sha256=sha(stage/'permissions.log'),manifest_tree_sha256=sha(stage/'manifest-tree.log'),build_workflow_sha256=sha(Path(__file__)),private_build_init_sha256=sha(stage/'isolated-build.init.gradle'),shared_checkout_divergence=divergence,shared_checkout_note='Frozen internal preview for selected package; concurrent shared sources may evolve. Host APK verification does not accept current directory facts or physical behavior.')
    dump(stage/'apk-verification.json',result)
    print(json.dumps({'verified_apk':str(apk),'sha256':sha(apk),'bytes':apk.stat().st_size,'exact_resource_checks':len(checks),'package':PACKAGE}),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage',default='gex-native-r1')
    parser.add_argument('--cache',default='gex-native-c')
    parser.add_argument('--build-home',default='gex-native-b')
    parser.add_argument('--phase',choices=('prepare','refresh','prebuild','build','verify','all'),default='all')
    parser.add_argument('--package',choices=tuple(PREVIEW_PACKAGES),default=PACKAGE)
    args=parser.parse_args();PACKAGE=args.package
    stage=isolated(args.stage);cache=isolated(args.cache);build_home=isolated(args.build_home)
    if (stage/'source-receipt.json').exists():
        require(load(stage/'source-receipt.json')['package']==PACKAGE,'Frozen staging package differs; pass matching --package or choose a new stage')
    if args.phase=='refresh':refresh(stage)
    for phase,callback in [('prepare',lambda:prepare(stage,cache,build_home)),('prebuild',lambda:prebuild(stage,cache)),('build',lambda:build(stage,cache)),('verify',lambda:verify(stage,cache,build_home))]:
        if args.phase in (phase,'all'):callback()
