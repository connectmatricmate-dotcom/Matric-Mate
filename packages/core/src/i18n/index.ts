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
  return raw.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? `{${p}}`));
}

export { en, ur };
