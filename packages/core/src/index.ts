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
export * from './markdown';
export * from './tutor';
export * from './ai';
export * from './content';
export * from './quota';
export * from './brand-mark';
export * from './report-html';
export * from './domain';
export * from './billing';
export * from './access';
export * from './daily';
export * from './tokens';
export * from './icons';
export * from './papers';
export * from './boards';
export * from './tutor-actions';
export { api } from './api';
export {
  connectContent,
  clearContentCache,
  connectLocalContent,
  setContentMedium,
  setContentGrade,
  setContentBoard,
  setContentOnline,
  contentMedium,
  contentGrade,
  contentBoard,
  isLive,
  fetchSlos,
  fetchAiSession,
  readAiSession,
  fetchAiSessions,
  fetchAudioTracks,
  fetchChapterContentLive,
  fetchChapterTopics,
  primeAllContent,
} from './db';
export type { AiSessionRead, AiSessionRow, ContentClient, LocalContentProvider, Slo } from './db';
export * from './i18n';
export * from './sync';
