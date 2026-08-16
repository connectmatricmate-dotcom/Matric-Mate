import { cookies } from 'next/headers';
import { UI_LANG_COOKIE, type UiLanguage } from './ui-language';

/**
 * The interface language, on the server, before any script runs.
 *
 * Kept apart from ui-language.ts because that module is imported by the
 * client store, and `next/headers` cannot cross into a client bundle.
 */
export async function readUiLanguage(): Promise<UiLanguage> {
  return (await cookies()).get(UI_LANG_COOKIE)?.value === 'ur' ? 'ur' : 'en';
}
