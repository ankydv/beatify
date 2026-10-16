// Expo config plugin: injects the custom native AudioRouteModule.
// Source of truth lives in modules/audio-route/ (tracked in git).
// `android/` is gitignored + a prebuild artifact, so without this plugin
// EAS cloud builds would silently lose AudioRouteModule.
const {
  withDangerousMod,
  withMainApplication,
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODULE_DIR = path.join(__dirname, '..', 'modules', 'audio-route');
const MODULE_FILE = 'AudioRouteModule.kt';
const PACKAGE_FILE = 'AudioRoutePackage.kt';

function withAudioRoute(config) {
  // 1. Copy the .kt sources into the prebuilt android project
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const pkg = AndroidConfig.Package.getPackage(config) || 'com.ankydv.beatify';
      const targetDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        ...pkg.split('.'),
      );
      fs.mkdirSync(targetDir, { recursive: true });
      for (const file of [MODULE_FILE, PACKAGE_FILE]) {
        const src = path.join(MODULE_DIR, file);
        const dest = path.join(targetDir, file);
        let content = fs.readFileSync(src, 'utf8');
        // Rewrite the `package ...` line to match the variant's package
        // (prod: com.ankydv.beatify / dev: com.ankydv.beatify.dev)
        content = content.replace(/^package\s+[\w.]+/m, `package ${pkg}`);
        fs.writeFileSync(dest, content);
      }
      return config;
    },
  ]);

  // 2. Register the package in MainApplication.kt
  config = withMainApplication(config, (config) => {
    const pkg = AndroidConfig.Package.getPackage(config) || 'com.ankydv.beatify';
    if (config.modResults.language === 'kt') {
      let contents = config.modResults.contents;
      const importLine = `import ${pkg}.AudioRoutePackage`;
      if (!contents.includes('AudioRoutePackage')) {
        contents = contents.replace(
          /import expo\.modules\.ReactNativeHostWrapper/,
          `import expo.modules.ReactNativeHostWrapper\n${importLine}`,
        );
        contents = contents.replace(
          /val packages = PackageList\(this\)\.packages/,
          `val packages = PackageList(this).packages\n            packages.add(AudioRoutePackage())`,
        );
      }
      config.modResults.contents = contents;
    }
    return config;
  });

  // 3. Ensure Bluetooth and audio permissions are in AndroidManifest
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    const permissions = [
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.WAKE_LOCK',
      'android.permission.ACCESS_WIFI_STATE',
    ];
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }
    for (const perm of permissions) {
      if (!androidManifest['uses-permission'].some((p) => p.$?.['android:name'] === perm)) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }
    return config;
  });

  return config;
}

module.exports = withAudioRoute;
