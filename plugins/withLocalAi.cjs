const { withProjectBuildGradle, withSettingsGradle, withGradleProperties, withAndroidManifest } = require('expo/config-plugins');

// Typed LiteRT 0.18.0 + Expo 57 compile with Kotlin 2.3.20. No metadata checks disabled.
const KOTLIN_VERSION = '2.3.20';
module.exports = config => {
  if (process.env.OMNI_AI_PREVIEW === '1') {
    config = { ...config, name: 'The Fort AI Preview', scheme: 'omni-bgc-ai-preview', android: { ...config.android, package: 'com.omnibgc.aipreview' } };
  }
  config = withProjectBuildGradle(config, cfg => {
    const expression = /classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::[^'"]+)?['"]\)/g;
    if (!expression.test(cfg.modResults.contents)) throw new Error('Cannot locate Kotlin plugin declaration in generated Android build.');
    cfg.modResults.contents = cfg.modResults.contents.replace(expression, `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}')`);
    return cfg;
  });
  config = withSettingsGradle(config, cfg => {
    // Official R8 replacement mechanism; 9.1.31 exceeds Kotlin 2.4's minimum 9.1.29.
    // https://r8.googlesource.com/r8/+/refs/heads/main/README.md#replacing-r8-in-android-gradle-plugin
    const marker = /\s*\/\/ @omni-local-ai-r8-start[\s\S]*?\/\/ @omni-local-ai-r8-end\n?/g;
    const original = cfg.modResults.contents.replace(marker, '');
    if (!/pluginManagement\s*\{/.test(original)) throw new Error('Cannot locate Android pluginManagement block.');
    cfg.modResults.contents = original.replace(/pluginManagement\s*\{/, `pluginManagement {
  // @omni-local-ai-r8-start
  buildscript {
    repositories { google(); mavenCentral() }
    dependencies { classpath('com.android.tools:r8:9.1.31') }
  }
  // @omni-local-ai-r8-end\n`);
    return cfg;
  });
  config = withGradleProperties(config, cfg => {
    for (const [key, value] of [['android.kotlinVersion', KOTLIN_VERSION], ['android.minSdkVersion', '26']]) {
      cfg.modResults = cfg.modResults.filter(row => row.key !== key);
      cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
  return withAndroidManifest(config, cfg => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application) throw new Error('Android application manifest is missing.');
    const names = ['libvndksupport.so', 'libOpenCL.so'];
    const existing = application['uses-native-library'] ?? [];
    application['uses-native-library'] = [
      ...existing.filter(row => !names.includes(row.$?.['android:name'])),
      ...names.map(name => ({ $: { 'android:name': name, 'android:required': 'false' } })),
    ];
    return cfg;
  });
};
