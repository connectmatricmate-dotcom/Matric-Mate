/**
 * @matricmate/core, everything both apps must agree on.
 *
 * Content, domain rules, copy and design tokens live here so the Android app and
 * the web app cannot drift apart. Anything platform-specific (components,
 * navigation, storage, asset loading) stays in the app that needs it.
 */
export * from './types';
export * from './content';
export * from './domain';
export * from './billing';
export * from './tokens';
export * from './icons';
export { api } from './api';
export * from './i18n';
