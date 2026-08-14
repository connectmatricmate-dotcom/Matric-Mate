/**
 * @matricmate/core, everything both apps must agree on.
 *
 * Content, domain rules, copy and design tokens live here so the Android app and
 * the web app cannot drift apart. Anything platform-specific (components,
 * navigation, storage, asset loading) stays in the app that needs it.
 */
export * from './types';
export * from './avatars';
export * from './glyphs';
export * from './tutor';
export * from './ai';
export * from './content';
export * from './domain';
export * from './billing';
export * from './tokens';
export * from './icons';
export * from './papers';
export { api } from './api';
export {
  connectContent,
  connectLocalContent,
  setContentMedium,
  setContentGrade,
  setContentOnline,
  contentMedium,
  contentGrade,
  isLive,
  fetchSlos,
  fetchAiSession,
  fetchAiSessions,
  fetchAudioTracks,
  fetchChapterContentLive,
  primeAllContent,
} from './db';
export type { AiSessionRow, ContentClient, LocalContentProvider, Slo } from './db';
export * from './i18n';
export * from './sync';
