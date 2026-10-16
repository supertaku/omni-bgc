"""Build the private ARM64 AI preview entirely on the host. Never invokes ADB.

Requires restored reviewed generated map/food/office assets, pinned npm modules,
Android SDK/JDK, and a populated Gradle cache. All generated projects/build files
remain inside a new .g/ai-host-* directory; no recursive cleanup is performed.
"""
import argparse
import hashlib
import json
import os
import re
import runpy
from pathlib import Path
import shutil
import subprocess
import time
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'apps/mobile'
JDK = Path('C:/Program Files/Android/Android Studio/jbr')
JDK17 = Path(os.environ.get('OMNI_AI_JDK17', str(ROOT / '.g/jdks/eclipse_adoptium-17-amd64-windows.2')))
SDK = Path(os.environ.get('ANDROID_HOME', str(ROOT.parents[1] / 'AppData/Local/Android/Sdk')))
PACKAGE = 'com.omnibgc.aipreview'
SOURCE_ROOTS = ('apps/mobile', 'packages', 'data/manifests', 'docs/geography', 'docs/evaluations/offline-ai', 'docs/architecture', 'tests/ai', 'tests/helpers')
SOURCE_FILES = ('scripts/build-offline-ai-host.py', 'scripts/check-offline-ai-source.py', 'AGENTS.md', 'docs/OFFLINE_AI_IMPLEMENTATION_PLAN.md', 'docs/DECISION_JOURNAL.md')


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(data)
    return digest.hexdigest()


def dump(path, value):
    Path(path).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8-sig'))


def ignored(base, names):
    excluded = {'.git', '.g', '.gradle', '.cxx', '.expo', '.cache', '__pycache__', 'artifacts'}
    if any(part in ('android', 'ios', 'ReactAndroid') or 'gradle-plugin' in part for part in Path(base).parts):
        excluded.add('build')
    return excluded.intersection(names)


def extended(path):
    value = str(Path(path).resolve())
    return '\\\\?\\' + value if os.name == 'nt' else value


def environment():
    result = os.environ.copy()
    result.update(JAVA_HOME=str(JDK), ANDROID_HOME=str(SDK), ANDROID_SDK_ROOT=str(SDK), GRADLE_USER_HOME=os.environ.get('GRADLE_USER_HOME', str(ROOT / '.g')), NODE_ENV='production', EXPO_PUBLIC_NATIVE_QA='0', NODE_OPTIONS='--dns-result-order=ipv4first', EXPO_OFFLINE='1', EXPO_NO_TELEMETRY='1', CI='1', OMNI_AI_PREVIEW='1')
    return result


def run(command, cwd, log):
    started = time.monotonic()
    require(not log.exists(), 'Preserve build evidence; use a fresh stage or new log: ' + str(log))
    with log.open('w', encoding='utf-8') as output:
        output.write(json.dumps({'argv': command, 'cwd': str(cwd)}) + '\n')
        output.flush()
        result = subprocess.run(command, cwd=cwd, env=environment(), stdout=output, stderr=subprocess.STDOUT, shell=False)
    print(json.dumps({'exit_code': result.returncode, 'seconds': round(time.monotonic() - started, 2), 'log': str(log)}), flush=True)
    require(result.returncode == 0, 'Host command failed: ' + str(log))


def authored_files():
    records = []
    for relative in SOURCE_ROOTS:
        source = ROOT / relative
        for base, dirs, files in os.walk(source):
            excluded = ignored(base, dirs)
            if Path(base) == APP:
                excluded.update({'node_modules', 'android', 'ios'})
            dirs[:] = sorted(set(dirs) - excluded)
            for name in sorted(files):
                path = Path(base) / name
                records.append({'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size, 'sha256': sha(path)})
    for relative in SOURCE_FILES:
        path = ROOT / relative
        records.append({'path': relative, 'bytes': path.stat().st_size, 'sha256': sha(path)})
    return records


def dependency_identity(mobile):
    lock = load(mobile / 'package-lock.json')
    installed_path = mobile / 'node_modules/.package-lock.json'
    installed = load(installed_path)
    checked, absent_optional = [], []
    for relative, expected in lock['packages'].items():
        if not relative:
            continue
        file = mobile / relative / 'package.json'
        if not file.is_file() and expected.get('optional'):
            absent_optional.append(relative)
            continue
        require(file.is_file(), 'Pinned dependency missing: ' + relative)
        actual = load(file)
        require(actual.get('version') == expected.get('version'), 'Installed package version differs: ' + relative)
        installed_row = installed['packages'].get(relative)
        require(installed_row is not None, 'Installed npm lock entry missing: ' + relative)
        for key in ('version', 'integrity', 'resolved'):
            require(installed_row.get(key) == expected.get(key), 'Installed dependency metadata differs: ' + relative + ':' + key)
        checked.append({'path': relative, 'version': actual['version'], 'manifest_sha256': sha(file)})
    return {'package_lock_sha256': sha(mobile / 'package-lock.json'), 'installed_lock_sha256': sha(installed_path),
            'checked': checked, 'absent_optional': absent_optional}


def staged_records(stage, records):
    return [{**row, 'bytes': (stage / row['path']).stat().st_size, 'sha256': sha(stage / row['path'])} for row in records]


def refresh(stage):
    require(not (stage / 'prebuild.log').exists(), 'Freeze a new stage after prebuild starts.')
    source_control = runpy.run_path(str(ROOT / 'scripts/check-offline-ai-source.py'))['audit_index'](ROOT)
    for relative in SOURCE_ROOTS:
        source = ROOT / relative
        shutil.copytree(extended(source), extended(stage / relative), dirs_exist_ok=True,
                        ignore=lambda base, names: ignored(base, names) | ({'node_modules', 'android', 'ios'} if str(base).replace('\\', '/').endswith('/apps/mobile') else set()))
    for relative in SOURCE_FILES:
        target = stage / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative, target)
    records = authored_files()
    for row in records:
        require(sha(stage / row['path']) == row['sha256'], 'Source copy raced an edit: ' + row['path'])
    metro = stage / 'apps/mobile/metro.config.js'
    metro.write_text('\n'.join(line for line in metro.read_text(encoding='utf-8').splitlines() if r'\.g' not in line) + '\n', encoding='utf-8')
    receipt = {'base_head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
               'branch': subprocess.check_output(['git', 'branch', '--show-current'], cwd=ROOT, text=True).strip(),
               'authored_sources': records, 'frozen_sources': staged_records(stage, records),
               'staging_changes': ['Remove ancestor .g Metro exclusion; preview identity set by OMNI_AI_PREVIEW=1'],
               'build_workflow_sha256': sha(Path(__file__)),
               'native_source_control': source_control,
               'device_operations': False, 'distribution_authorized': False}
    dump(stage / 'source-receipt.json', receipt)
    print(json.dumps({'stage': str(stage), 'source_count': len(records)}), flush=True)


def prepare(stage):
    require(not stage.exists(), 'Use a new ai-host stage; existing outputs are retained.')
    stage.mkdir(parents=True)
    refresh(stage)
    print('Copying pinned dependencies into isolated staging.', flush=True)
    shutil.copytree(extended(APP / 'node_modules'), extended(stage / 'apps/mobile/node_modules'), ignore=ignored)
    receipt = load(stage / 'source-receipt.json')
    receipt['dependency_identity'] = dependency_identity(stage / 'apps/mobile')
    dump(stage / 'source-receipt.json', receipt)


def frozen(stage):
    receipt = load(stage / 'source-receipt.json')
    require(receipt.get('build_workflow_sha256') == sha(Path(__file__)), 'Build workflow changed or is unbound; use a fresh stage.')
    for row in receipt['frozen_sources']:
        require(sha(stage / row['path']) == row['sha256'], 'Frozen source changed: ' + row['path'])
        require((stage / row['path']).stat().st_size == row['bytes'], 'Frozen source byte count differs: ' + row['path'])
    return receipt


def prebuild(stage):
    frozen(stage)
    mobile = stage / 'apps/mobile'
    run(['node', 'node_modules/expo/bin/cli', 'prebuild', '--platform', 'android', '--no-install'], mobile, stage / 'prebuild.log')
    # Expo may add npm native scripts; record this explicit generated metadata update.
    receipt = load(stage / 'source-receipt.json')
    for row in receipt['frozen_sources']:
        if row['path'] == 'apps/mobile/package.json':
            row.update(sha256=sha(stage / row['path']), bytes=(stage / row['path']).stat().st_size)
    dump(stage / 'source-receipt.json', receipt)
    gradle = mobile / 'android/app/build.gradle'
    text = gradle.read_text(encoding='utf-8')
    require(PACKAGE in text, 'Preview identity was not applied.')
    gradle.write_text(text.replace('    bundleCommand = "export:embed"', '    bundleCommand = "export:embed"\n    extraPackagerArgs = ["--max-workers", "2"]'), encoding='utf-8')
    frozen(stage)


def build(stage):
    frozen(stage)
    build_root = ROOT / '.g' / (stage.name.replace('ai-host-', 'ai-build-'))
    build_root.mkdir(exist_ok=True)
    init = stage / 'isolated-build.init.gradle'
    init.write_text('''gradle.beforeProject { project ->
      if (project.path == ':app') project.layout.buildDirectory.set(new File('BUILD_ROOT', 'app'))
      ['com.android.application','com.android.library'].each { id -> project.plugins.withId(id) {
        def android = project.extensions.getByName('android')
        def key = Integer.toUnsignedString(project.projectDir.absolutePath.hashCode(),36)
        android.externalNativeBuild.cmake.buildStagingDirectory = new File('BUILD_ROOT','x/'+key)
        android.defaultConfig.externalNativeBuild.cmake.arguments.add('-DCMAKE_OBJECT_PATH_MAX=250')
      } }
    }
    '''.replace('BUILD_ROOT', build_root.as_posix()), encoding='utf-8')
    mobile = stage / 'apps/mobile'
    command = [str(mobile / 'android/gradlew.bat'), '-p', str(mobile / 'android'), ':app:assembleRelease', ':omni-local-ai:testReleaseUnitTest', '--offline', '--no-daemon', '--max-workers', '2', '--console=plain', '--stacktrace', '-PreactNativeArchitectures=arm64-v8a', '-Pandroid.enableMinifyInReleaseBuilds=true', '-Pkotlin.compiler.execution.strategy=in-process', '-Dorg.gradle.java.installations.paths=' + str(JDK17), '-Dorg.gradle.java.installations.auto-download=false', '--init-script', str(init)]
    run(command, mobile, stage / 'assemble-release.log')
    run([str(mobile / 'android/gradlew.bat'), '-p', str(mobile / 'android'), ':omni-local-ai:dependencies', '--configuration', 'releaseRuntimeClasspath', '--offline', '--no-daemon', '--console=plain'], mobile, stage / 'native-dependencies.log')
    frozen(stage)


def verify(stage):
    receipt = frozen(stage)
    build_root = ROOT / '.g' / stage.name.replace('ai-host-', 'ai-build-')
    apks = list(build_root.rglob('app-release.apk'))
    require(len(apks) == 1, 'Expected one release APK.')
    apk = stage / 'Omni-BGC-AI-preview-arm64.apk'
    shutil.copyfile(apks[0], apk)
    with ZipFile(apk) as archive:
        require(archive.testzip() is None, 'APK ZIP CRC failure.')
        names = archive.namelist()
        libraries = [name for name in names if name.startswith('lib/')]
        require({name.split('/')[1] for name in libraries} == {'arm64-v8a'}, 'Unexpected APK ABI.')
        require(any('litertlm' in name for name in libraries), 'LiteRT JNI library is missing.')
        require(any('maplibre' in name for name in libraries), 'MapLibre native library is missing.')
        require(len(archive.read('assets/index.android.bundle')) > 100000, 'Embedded JS missing.')
        require(not any(name.endswith('.litertlm') for name in names), 'Weights unexpectedly bundled.')
        dex = b''.join(archive.read(name) for name in names if name.endswith('.dex'))
        require(b'expo/modules/omnilocalai/OmniLocalAiModule' in dex, 'Expo native module is missing from DEX.')
        require(b'com/google/ai/edge/litertlm/Engine' in dex and b'com/google/ai/edge/litertlm/LiteRtLmJni' in dex, 'Typed runtime/JNI classes missing from R8 DEX.')
        for namespace in ('omni', 'gex'):
            for row in load(stage / f'apps/mobile/assets/generated/{namespace}/manifest.json')['files']:
                data = archive.read(f'assets/{namespace}/' + row['path'])
                require(len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], 'Bundled map checksum mismatch.')
    tools = SDK / 'build-tools/36.0.0'
    run([str(JDK / 'bin/java.exe'), '-jar', str(tools / 'lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', str(apk)], stage, stage / 'signature.log')
    for command in ('badging', 'permissions', 'xmltree'):
        args = [str(tools / 'aapt.exe'), 'dump', command, str(apk)] + (['AndroidManifest.xml'] if command == 'xmltree' else [])
        run(args, stage, stage / (command + '.log'))
    badging = (stage / 'badging.log').read_text(encoding='utf-8')
    require("name='" + PACKAGE + "'" in badging and "sdkVersion:'26'" in badging and "targetSdkVersion:'36'" in badging, 'APK package/SDK differs.')
    permissions = (stage / 'permissions.log').read_text(encoding='utf-8')
    require(not any('android.permission.' + item in permissions for item in ('RECORD_AUDIO', 'ACCESS_BACKGROUND_LOCATION', 'SYSTEM_ALERT_WINDOW', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE')), 'Forbidden permission.')
    baseline_path = stage / 'docs/evaluations/offline-ai/ANDROID_PERMISSION_BASELINE.json'
    baseline = load(baseline_path)
    normalize = lambda value: value.replace(PACKAGE, '<APPLICATION_ID>')
    observed_uses = sorted(normalize(value) for value in re.findall(r"uses-permission: name='([^']+)'", permissions))
    observed_declared = sorted(normalize(line.split(': ', 1)[1]) for line in permissions.splitlines() if line.startswith('permission: '))
    require(observed_uses == sorted(baseline['usesPermissions']) and observed_declared == sorted(baseline['declaredPermissions']), 'Permission set differs from accepted APK baseline.')
    require('Verifies' in (stage / 'signature.log').read_text(encoding='utf-8'), 'APK signature failed.')
    manifest = (stage / 'xmltree.log').read_text(encoding='utf-8')
    backup = next((line for line in manifest.splitlines() if 'android:allowBackup' in line), '')
    require('(type 0x12)0x0' in backup, 'Backup must remain disabled.')
    debuggable = next((line for line in manifest.splitlines() if 'android:debuggable' in line), '')
    require(not debuggable or '(type 0x12)0x0' in debuggable, 'Release cannot be debuggable.')
    require('libOpenCL.so' in manifest and 'libvndksupport.so' in manifest, 'Optional GPU library declarations missing.')
    require((build_root / 'app/outputs/mapping/release/mapping.txt').is_file(), 'R8 mapping missing.')
    registrations = [file for directory in (stage / 'apps/mobile/android', stage / 'apps/mobile/node_modules/expo/android/build/generated', build_root) for file in directory.rglob('*')
                     if file.is_file() and file.suffix in ('.kt', '.java') and 'generated' in file.parts
                     and 'OmniLocalAiModule' in file.read_text(encoding='utf-8', errors='ignore')]
    require(registrations, 'Expo autolinking registration source is missing.')
    maps = list(build_root.rglob('index.android.bundle.map'))
    require(len(maps) == 1, 'One embedded release source map is required.')
    mapping = load(maps[0])
    checked = {}
    for suffix in ('src/map/MapCanvas.tsx', 'src/ai/NativeLiteRtProvider.ts', 'src/ai/AgentOrchestrator.ts', 'src/ai/modelStorage.ts', 'src/features/assistant/useAssistantConversation.ts', 'src/features/assistant/AssistantScreen.tsx', 'src/data/store.ts'):
        matches = [content for source, content in zip(mapping['sources'], mapping['sourcesContent']) if source.replace('\\', '/').endswith(suffix)]
        file = stage / 'apps/mobile' / suffix
        require(len(matches) == 1 and matches[0] == file.read_text(encoding='utf-8'), 'Embedded source differs: ' + suffix)
        checked[suffix] = sha(file)
    dependencies = (stage / 'native-dependencies.log').read_text(encoding='utf-8')
    require('com.google.ai.edge.litertlm:litertlm-android:0.18.0' in dependencies, 'Pinned runtime absent from dependency graph.')
    require('An error occurred when parsing kotlin metadata' not in (stage / 'assemble-release.log').read_text(encoding='utf-8'), 'R8 cannot parse the selected Kotlin metadata.')
    installed_identity = dependency_identity(stage / 'apps/mobile')
    require(installed_identity == receipt.get('dependency_identity'), 'Installed dependency metadata drifted after preparation.')
    with ZipFile(stage / 'frozen-source-snapshot.zip', 'w', compression=ZIP_DEFLATED) as archive:
        for row in receipt['frozen_sources']:
            archive.write(stage / row['path'], row['path'])
    divergence = [row['path'] for row in receipt['authored_sources'] if not (ROOT / row['path']).is_file() or sha(ROOT / row['path']) != row['sha256']]
    app_divergence = [path for path in divergence if path.startswith(('apps/mobile/', 'packages/', 'data/manifests/', 'docs/geography/'))]
    require(not app_divergence, 'Application source changed since freeze: ' + ', '.join(app_divergence))
    result = {'status': 'HOST_COMPILED_STATIC_APK_VERIFIED', 'apk': str(apk), 'sha256': sha(apk), 'bytes': apk.stat().st_size, 'package': PACKAGE, 'native_libraries': libraries, 'source_receipt_sha256': sha(stage / 'source-receipt.json'), 'model_weights_bundled': False, 'physical_device_tested': False, 'on_device_inference': 'NOT_RUN_PENDING_M10', 'distribution_authorized': False,
              'build_workflow_sha256': sha(Path(__file__)), 'source_snapshot_sha256': sha(stage / 'frozen-source-snapshot.zip'),
              'expo_registration': [str(file) for file in registrations], 'source_map_sha256': sha(maps[0]), 'embedded_source_hashes': checked,
              'generated_android_hashes': {str(file.relative_to(stage)): sha(file) for file in (stage / 'apps/mobile/android/build.gradle', stage / 'apps/mobile/android/settings.gradle', stage / 'apps/mobile/android/gradle.properties', stage / 'apps/mobile/android/app/build.gradle', stage / 'isolated-build.init.gradle', *registrations) if file.is_relative_to(stage)},
              'permission_baseline_sha256': sha(baseline_path),
              'dependency_identity': installed_identity,
              'dependency_verification_limit': 'Pinned lock and installed package manifests/metadata checked; full npm package contents are trusted from explicit npm ci --offline --ignore-scripts, not independently rehashed here.',
              'r8_compiler_pin': '9.1.31', 'r8_kotlin_metadata_warnings': 0,
              'application_source_divergence_since_freeze': app_divergence,
              'source_divergence_since_freeze': divergence, 'logs': {name: sha(stage / name) for name in ('prebuild.log', 'assemble-release.log', 'native-dependencies.log', 'signature.log', 'badging.log', 'permissions.log', 'xmltree.log')}}
    dump(stage / 'apk-verification.json', result)
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage', default='ai-host-r1')
    parser.add_argument('--phase', choices=('prepare', 'refresh', 'prebuild', 'build', 'verify', 'all'), default='all')
    args = parser.parse_args()
    stage = (ROOT / '.g' / args.stage).resolve()
    require(stage.parent == (ROOT / '.g').resolve() and stage.name.startswith('ai-host-'), 'Output must be direct .g/ai-host-* child.')
    for name, work in [('prepare', prepare), ('refresh', refresh), ('prebuild', prebuild), ('build', build), ('verify', verify)]:
        if args.phase == name or (args.phase == 'all' and name != 'refresh'):
            work(stage)
