/**
 * The interface language, readable on the server.
 *
 * The store keeps it in localStorage, which is the right home for it: it is a
 * per-device preference and it has to survive a signed-out visit. But the root
 * layout renders on the server, and it has to decide two things before a single
 * byte reaches the browser: which way the page runs, and whether to fetch the
 * 240KB Nastaliq font. Neither can wait for hydration. An Urdu student would
 * otherwise get a left-to-right Latin page that visibly flips and reflows a
 * moment later, on every cold load.
 *
 * So the language is mirrored into a cookie whenever it changes. The cookie is
 * a rendering hint and nothing else: it is not trusted for content, not read
 * for authorisation, and if it goes missing the page simply renders in English
 * until the store hydrates and corrects it.
 */
export const UI_LANG_COOKIE = 'mm.lang';

export type UiLanguage = 'en' | 'ur';

export function isRtlLanguage(lang: UiLanguage): boolean {
  return lang === 'ur';
}

/** Client side: mirror the store's language into the cookie. */
export function writeLanguageCookie(lang: UiLanguage): void {
  if (typeof document === 'undefined') return;
  // A year, same-site, no sensitive content. Not http-only on purpose: the
  // client is the thing that writes it.
  document.cookie = `${UI_LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}
