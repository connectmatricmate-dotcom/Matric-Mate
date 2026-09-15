import 'server-only';
import type { Metadata } from 'next';
import { chapterName, translate, type Chapter, type StringKey } from '@matricmate/core';
import { readUiLanguage } from './ui-language.server';

/**
 * A student page's tab title in the language the student is using.
 *
 * Every title was an English literal, so an Urdu student's tabs, history and
 * bookmarks read "Study", "Weak topics", "{English chapter} audio lesson"
 * under an Urdu app. The language comes from the same cookie the pages render
 * from. Descriptions stay as written: these pages are never indexed.
 */
export async function localTitle(key: StringKey, description?: string): Promise<Metadata> {
  const lang = await readUiLanguage();
  return { title: translate(lang, key), ...(description ? { description } : {}) };
}

/** A chapter's page title: its name in the student's language, and what the page is. */
export async function chapterTitle(chapter: Chapter | undefined, what?: StringKey): Promise<Metadata> {
  const lang = await readUiLanguage();
  if (!chapter) return { title: translate(lang, what ?? 'session.chapter') };
  const name = chapterName(chapter, lang);
  return { title: what ? `${name} · ${translate(lang, what)}` : name, description: chapter.blurb };
}
