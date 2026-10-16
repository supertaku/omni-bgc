const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function plugin(env = {}) {
  const hooks = {};
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../apps/mobile/plugins/withLocalAi.cjs'), 'utf8'), {
    module, process: { env }, require(name) {
      assert.equal(name, 'expo/config-plugins');
      return Object.fromEntries(['withProjectBuildGradle', 'withSettingsGradle', 'withGradleProperties', 'withAndroidManifest'].map(name => [name, (cfg, callback) => { hooks[name] = callback; return cfg; }]));
    },
  });
  const config = module.exports({ name: 'Omni-BGC', scheme: 'omni-bgc-preview', android: { package: 'com.omnibgc.preview' } });
  return { config, hooks };
}
test('CNG retains default identifier and only explicit internal build changes identity', () => {
  assert.equal(plugin().config.android.package, 'com.omnibgc.preview');
  assert.equal(plugin({ OMNI_AI_PREVIEW: '1' }).config.android.package, 'com.omnibgc.aipreview');
});
test('CNG compiler pin and optional GPU declarations remain idempotent', () => {
  const { hooks } = plugin();
  let gradle = { modResults: { contents: "dependencies { classpath('org.jetbrains.kotlin:kotlin-gradle-plugin') }" } };
  gradle = hooks.withProjectBuildGradle(gradle); const once = gradle.modResults.contents; hooks.withProjectBuildGradle(gradle);
  assert.equal(gradle.modResults.contents, once); assert.match(once, /kotlin-gradle-plugin:2\.3\.20/);
  const settings = { modResults: { contents: 'pluginManagement { includeBuild("preserve") }' } };
  hooks.withSettingsGradle(settings); const pinned = settings.modResults.contents; hooks.withSettingsGradle(settings);
  assert.equal(settings.modResults.contents, pinned); assert.match(pinned, /com\.android\.tools:r8:9\.1\.31/);
  let properties = { modResults: [{ type: 'property', key: 'android.kotlinVersion', value: 'OLD' }, { type: 'property', key: 'OTHER', value: 'preserve' }] };
  properties = hooks.withGradleProperties(properties); hooks.withGradleProperties(properties);
  assert.equal(properties.modResults.filter(row => row.key === 'android.kotlinVersion').length, 1);
  assert.equal(properties.modResults.find(row => row.key === 'android.minSdkVersion').value, '26');
  const manifest = { modResults: { manifest: { application: [{ 'uses-native-library': [{ $: { 'android:name': 'unrelated.so', 'android:required': 'false' } }] }] } } };
  hooks.withAndroidManifest(manifest); hooks.withAndroidManifest(manifest);
  const libraries = manifest.modResults.manifest.application[0]['uses-native-library'];
  assert.equal(libraries.length, 3);
  for (const name of ['libOpenCL.so', 'libvndksupport.so']) assert.equal(libraries.find(row => row.$['android:name'] === name).$['android:required'], 'false');
  assert.throws(() => hooks.withProjectBuildGradle({ modResults: { contents: 'unexpected template' } }));
});
