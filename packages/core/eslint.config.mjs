import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Lint for the shared package.
 *
 * This is the one place both apps depend on, so a mistake here lands twice. It
 * had only ever been typechecked, which catches nothing about unused exports,
 * shadowed bindings or a promise nobody awaited.
 *
 * No React plugin on purpose: this package is plain TypeScript. Content, domain
 * rules, copy and tokens, no components. Keeping it that way is what lets the
 * Expo app and the Next app share it without either one's build getting
 * opinions about the other's.
 */
export default tseslint.config(
  { ignores: ['dist/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Matches the two apps: an unused argument prefixed with _ is deliberate.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  }
);
