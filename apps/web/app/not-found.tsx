import { translate } from '@matricmate/core';
import { Localized } from '@/components/app/Localized';
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';
import { readUiLanguage } from '@/lib/ui-language.server';

/**
 * An address that matches no route at all, anywhere on the site.
 *
 * In the reader's language when the cookie says Urdu. This is the page a
 * mistyped address inside the app lands on (a bad chapter id has its own, in
 * the app shell), and it was the last screen an Urdu student could reach that
 * was wholly English. English readers keep the site's own wording.
 */
export default async function NotFound() {
  const lang = await readUiLanguage();
  const ur = lang === 'ur';
  const title = ur ? translate('ur', 'states.notFoundTitle') : 'Page not found';
  const body = ur
    ? translate('ur', 'states.notFoundBody')
    : 'That link doesn’t point anywhere. It may have moved, or the address has a typo.';
  const home = ur ? translate('ur', 'states.goHome') : 'Go to the homepage';
  return (
    <Localized lang={lang}>
      <main className="mx-auto flex min-h-[70vh] max-w-[520px] items-center px-5">
        <Card className="w-full text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tealtint text-teal">
            <Icon name="search" size={26} />
          </span>
          <h1 className="mt-3 font-display text-[22px] text-ink rtl:leading-[1.9]">{title}</h1>
          <p className="mt-1.5 text-[14px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{body}</p>
          <div className="mt-5 flex justify-center">
            <LinkBtn title={home} href="/" />
          </div>
        </Card>
      </main>
    </Localized>
  );
}
