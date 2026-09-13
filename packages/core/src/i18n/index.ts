/**
 * Language-independent half of the i18n layer: the dictionaries, the key type,
 * and the lookup. Each app wraps `translate` in its own hook, because the two
 * read the current language from different places.
 */
import { en, ur } from './strings';

export type Language = 'en' | 'ur';

export const DICTS = { en, ur } as const;

type Dict = typeof en;
type Section = keyof Dict;

/** "section.key", checked at compile time, so a typo is a build error. */
export type StringKey = {
  [S in Section]: `${S}.${Extract<keyof Dict[S], string>}`;
}[Section];

function lookup(lang: Language, key: string): string {
  const [section, name] = key.split('.') as [Section, string];
  const dict = DICTS[lang] ?? en;
  const value = (dict[section] as Record<string, string> | undefined)?.[name];
  if (value != null) return value;
  // Fall back to English rather than showing a raw key to a student.
  return (en[section] as Record<string, string> | undefined)?.[name] ?? key;
}

export function translate(
  lang: Language,
  key: StringKey,
  params?: Record<string, string | number>
): string {
  const raw = lookup(lang, key);
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, p: string) => (p in params ? isolate(lang, params[p]) : `{${p}}`));
}

/**
 * A value in the other script from the sentence it goes into, set apart.
 *
 * An English topic in an Urdu sentence ("Fundamental forces دہرائیں · ابھی تک
 * 0%") or an Urdu chapter name in an English one ("Read قوت اور حرکت · 15 min")
 * made the line start with the wrong script, so the whole line was laid out in
 * that direction and the words around the name came out in the wrong order.
 * Wrapped in a first-strong isolate (U+2068 ... U+2069, invisible), the name
 * keeps its own direction as one piece and the sentence keeps the direction of
 * its language. isUrduScript reads past isolated names for the same reason.
 */
function isolate(lang: Language, value: string | number): string {
  const text = String(value);
  const foreign = lang === 'ur' ? /[A-Za-z]/.test(text) : /[\u0600-\u06FF]/.test(text);
  return foreign ? `\u2068${text}\u2069` : text;
}

/**
 * Values that get interpolated into translated sentences, and so have to
 * follow the sentence.
 *
 * These were written inline at a dozen call sites as `medium === 'ur' ?
 * 'Urdu' : 'English'`, which put an English word in the middle of an Urdu
 * line: "کلاس 9 · FBISE · English میڈیم". A board's initials stay Latin
 * because that is how the board writes them; a language's name does not.
 */
export function boardName(board: string | undefined, lang: Language): string {
  return translate(lang, board === 'punjab' ? 'onboarding.punjab' : 'onboarding.fbise');
}

export function mediumName(medium: string | undefined, lang: Language): string {
  return translate(lang, medium === 'ur' ? 'lang.mediumUrdu' : 'lang.mediumEnglish');
}

/**
 * Dates in the reader's language: Urdu month and weekday names, but Latin
 * digits. Pakistani boards, schoolbooks and mark sheets all write numbers in
 * Latin, so `-u-nu-latn` keeps "15 اگست" rather than "۱۵ اگست".
 */
export function formatDate(at: number | string | Date, lang: Language, opts: Intl.DateTimeFormatOptions): string {
  return new Date(at).toLocaleDateString(lang === 'ur' ? 'ur-PK-u-nu-latn' : 'en-GB', opts);
}

export { en, ur };
export { SUBJECT_NAMES_UR, CHAPTER_TITLES_UR } from './names-ur';
