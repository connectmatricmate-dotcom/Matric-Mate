import { translate } from '@matricmate/core';
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';
import { readUiLanguage } from '@/lib/ui-language.server';

/**
 * A bad chapter or paper id lands here INSIDE the Shell, so the student keeps
 * the nav and a route back into Study instead of being dropped on a bare page.
 *
 * In the student's language, from the same cookie the rest of the app renders
 * from. It was the one English screen left inside the app, and in an Urdu
 * account it was set in the Nastaliq stack, which has no business drawing
 * English. A div, not a main: the Shell's main is already around it, with its
 * own gutter.
 */
export default async function NotFound() {
  const lang = await readUiLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(lang, key);
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-[520px] items-center">
      <Card className="w-full text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tealtint text-teal">
          <Icon name="search" size={26} />
        </span>
        <h1 className="mt-3 font-display text-[22px] text-ink rtl:leading-[1.9]">{t('states.notFoundTitle')}</h1>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{t('states.notFoundBody')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <LinkBtn title={t('downloads.browse')} href="/study" />
          <LinkBtn title={t('states.goHome')} href="/dashboard" variant="line" />
        </div>
      </Card>
    </div>
  );
}
