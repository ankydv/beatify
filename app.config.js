/**
 * Dynamic Expo config to allow dev-client + prod installed side-by-side.
 *
 * - Prod (default):  android.package = com.ankydv.beatify
 * - Dev  (APP_VARIANT=development): android.package = com.ankydv.beatify.dev
 *
 * The `android/` folder in this repo is a prebuild artifact — EAS runs
 * `expo prebuild` on the builder, so this file is the source of truth.
 * For local `run-devbuild.ps1` (direct Gradle) builds, see the
 * `applicationIdSuffix '.dev'` in android/app/build.gradle.
 */
const base = require('./app.json').expo;

const IS_DEV = process.env.APP_VARIANT === 'development';

const DEV_ANDROID_PACKAGE = 'com.ankydv.beatify.dev';
const PROD_ANDROID_PACKAGE = base?.android?.package || 'com.ankydv.beatify';

const DEV_IOS_BUNDLE_ID = 'com.ankydv.beatify.dev';
const PROD_IOS_BUNDLE_ID = base?.ios?.bundleIdentifier || 'com.ankydv.beatify';

module.exports = {
  expo: {
    ...base,
    name: IS_DEV ? 'Beatify Dev' : base.name,
    // Keep slug/projectId/updates URL identical — channels already
    // separate dev vs prod OTA (`development` vs `production`).
    ios: {
      ...(base.ios || {}),
      bundleIdentifier: IS_DEV ? DEV_IOS_BUNDLE_ID : PROD_IOS_BUNDLE_ID,
    },
    android: {
      ...(base.android || {}),
      package: IS_DEV ? DEV_ANDROID_PACKAGE : PROD_ANDROID_PACKAGE,
    },
    plugins: [...(base.plugins || []), './plugins/withAudioRoute.js'],
    // NOTE: `scheme` intentionally NOT varied. Clerk AuthSession
    // (`AuthSession.makeRedirectUri()`) derives its redirect from it,
    // so changing it would require re-whitelisting OAuth redirects.
    // Package/bundleId difference alone is enough for side-by-side install.
  },
};
