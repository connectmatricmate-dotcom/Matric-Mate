/**
 * App variants.
 *
 * app.json holds the shared config; this file applies per-variant overrides so the
 * developer build and the client build can sit on the same phone side by side.
 *
 *   APP_VARIANT=development  → "MatricMate Dev", package pk.matricmate.app.dev
 *   (unset)                  → "MatricMate",     package pk.matricmate.app
 *
 * No build profile sets it any more: google-services.json (push) only covers
 * pk.matricmate.app, so a `.dev` build either failed or came out without
 * push. The `development` and `emulator` profiles both build the store
 * package as a development client. Setting APP_VARIANT by hand still works
 * for a build that does not need push.
 */
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? 'MatricMate Dev' : 'MatricMate',
  scheme: IS_DEV ? 'matricmatedev' : 'matricmate',
  android: {
    ...config.android,
    package: IS_DEV ? 'pk.matricmate.app.dev' : 'pk.matricmate.app',
  },
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? 'pk.matricmate.app.dev' : 'pk.matricmate.app',
  },
});
