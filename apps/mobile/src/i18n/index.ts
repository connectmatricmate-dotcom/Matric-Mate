/**
 * Android side of i18n. The dictionaries and lookup live in @matricmate/core;
 * this only binds them to the app's stored language setting.
 */
import { useCallback, useMemo } from 'react';
import { Language, StringKey, translate } from '@matricmate/core';
import { useApp } from '../store/app';

export type { Language, StringKey };

export function useT() {
  const { state } = useApp();
  const lang = state.settings.language;
  return useCallback(
    (key: StringKey, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );
}

/** Current language plus a setter, for the few places that need to branch. */
export function useLang() {
  const { state, actions } = useApp();
  const lang = state.settings.language;
  return useMemo(
    () => ({
      lang,
      isUrdu: lang === 'ur',
      setLang: (next: Language) => actions.setLanguage(next),
    }),
    [lang, actions]
  );
}
