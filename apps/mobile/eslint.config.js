/**
 * ESLint for the Expo app.
 *
 * The web app has been linted since it was created. This side was only ever
 * typechecked, so anything the compiler tolerates went unseen: unused imports,
 * a hook called behind a condition, a missing effect dependency, an `<a>` where
 * a `<Link>` belongs. None of those are type errors and all of them are bugs.
 *
 * eslint-config-expo is version-matched to the SDK on purpose. It carries the
 * React Native globals, the React Compiler rules Expo ships with, and the
 * platform-suffix conventions (`.web.tsx`, `.android.tsx`) that a generic React
 * config reads as duplicate modules.
 *
 * CommonJS because the app has no `"type": "module"`. The web app's config is
 * `.mjs` for the same reason in reverse; they are not gratuitously different.
 */

const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Generated, never hand-edited: the export bundle, Expo's local cache, and
    // the type shim Expo rewrites on every install.
    ignores: ['dist/*', '.expo/*', 'expo-env.d.ts'],
  },
]);
