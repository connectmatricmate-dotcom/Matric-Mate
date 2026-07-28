/**
 * App variants.
 *
 * app.json holds the shared config; this file applies per-variant overrides so the
 * developer build and the client build can sit on the same phone side by side.
 *
 *   APP_VARIANT=development  → "MatricMate Dev", package pk.matricmate.app.dev
 *   (unset)                  → "MatricMate",     package pk.matricmate.app
 *
 * The variant is set per build profile in eas.json, so nothing needs to be
 * remembered at the command line.
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
