/**
 * Tiny i18n layer. `useT()` returns a lookup bound to the current app language.
 *
 *   const t = useT();
 *   t('auth.logIn')
 *   t('dash.greeting', { name: 'Ahmed' })
 */
import { useCallback, useMemo } from 'react';
import { useApp } from '../store/app';
import { en, ur } from './strings';

export type Language = 'en' | 'ur';

const DICTS = { en, ur } as const;

type Dict = typeof en;
type Section = keyof Dict;
/** "section.key" — checked at compile time, so a typo is a build error. */
export type StringKey = {
  [S in Section]: `${S}.${Extract<keyof Dict[S], string>}`;
}[Section];

function lookup(lang: Language, key: string): string {
  const [section, name] = key.split('.') as [Section, string];
  const dict = DICTS[lang] ?? en;
  const value = (dict[section] as Record<string, string> | undefined)?.[name];
  if (value != null) return value;
  // Fall back to English rather than showing a raw key to a student.
  const fallback = (en[section] as Record<string, string> | undefined)?.[name];
  return fallback ?? key;
}

export function translate(lang: Language, key: StringKey, params?: Record<string, string | number>): string {
  const raw = lookup(lang, key);
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? `{${p}}`));
}

export function useT() {
  const { state } = useApp();
  const lang = state.settings.language;
  return useCallback(
    (key: StringKey, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );
}

/** Current language plus helpers, for the few places that need to branch. */
export function useLang() {
  const { state, actions } = useApp();
  const lang = state.settings.language;
  return useMemo(
    () => ({
      lang,
      isUrdu: lang === 'ur',
      setLang: (next: Language) => actions.setSettings({ language: next }),
    }),
    [lang, actions]
  );
}
