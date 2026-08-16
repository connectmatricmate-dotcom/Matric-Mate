import { type UiLanguage, isRtlLanguage } from '@/lib/ui-language';

/**
 * Marks the part of the site that speaks the student's language.
 *
 * Deliberately not on `<html>`. The marketing pages, pricing, terms and
 * refunds are written in English in the source and never go through the
 * dictionary, so a document-level `dir="rtl"` would lay out English prose
 * right to left and set it in Nastaliq, which has no business rendering Latin.
 * Only the four signed-in surfaces are translated, and only they mirror.
 *
 * `display: contents` so this introduces no box of its own: `lang` and `dir`
 * are inherited HTML attributes and do not need one, and a box here would sit
 * between `<body>` and the app shell's own flex layout.
 */
export function Localized({ lang, children }: { lang: UiLanguage; children: React.ReactNode }) {
  return (
    <div lang={lang} dir={isRtlLanguage(lang) ? 'rtl' : 'ltr'} className="contents">
      {children}
    </div>
  );
}
