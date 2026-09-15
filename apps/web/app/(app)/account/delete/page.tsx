import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import Link from 'next/link';
import { translate, type StringKey } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { DeleteAccountForm } from '@/components/app/DeleteAccountForm';
import { Card, Icon } from '@/components/ui/primitives';
import { readUiLanguage } from '@/lib/ui-language.server';

export const generateMetadata = (): Promise<Metadata> => localTitle('deletion.title', 'What deleting your account removes, what is kept, and the button that does it.');

const GONE: StringKey[] = ['deletion.gone1', 'deletion.gone2', 'deletion.gone3', 'deletion.gone4'];

/**
 * Deleting the account from inside the product, reached from Settings.
 *
 * Google Play wants the deletion reachable in the app, and a student should
 * not have to write an email to leave. What goes and what stays is said
 * before anything can be pressed; the button itself (DeleteAccountForm) waits
 * for DELETE to be typed and asks once more. Same words as the Android
 * screen (the `deletion` strings), plus the refund note, which only the
 * website may give. The public page at /delete-account stays for anyone who
 * cannot sign in.
 *
 * The explanation is rendered here, on the server, in the student's language;
 * only the form is a client component.
 */
export default async function DeleteAccountPage() {
  const lang = await readUiLanguage();
  const t = (key: StringKey) => translate(lang, key);
  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.settingsTitle')} title={t('deletion.title')} sub={t('deletion.intro')} />

      <Card flat>
        <h2 className="font-display text-[17px] text-ink rtl:leading-[1.9]">{t('deletion.goneTitle')}</h2>
        <ul className="mt-2.5 flex flex-col gap-2">
          {GONE.map((key) => (
            <li key={key} className="flex items-start gap-2.5 text-[14px] leading-[1.6] text-ink2 rtl:leading-[1.9]">
              <Icon name="trash" size={16} className="mt-1 shrink-0 text-red" />
              {t(key)}
            </li>
          ))}
        </ul>
      </Card>

      <Card flat className="mt-3">
        <h2 className="font-display text-[17px] text-ink rtl:leading-[1.9]">{t('deletion.keptTitle')}</h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{t('deletion.kept1')}</p>
        <p className="mt-2 text-[14px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{t('account.delRefund')}</p>
        <Link
          href="/delete-account"
          className="mt-1 inline-flex min-h-11 items-center gap-1 text-[13.5px] font-extrabold text-teal hover:underline"
        >
          {t('account.delHowItWorks')}
          <Icon name="chevron" size={15} />
        </Link>
      </Card>

      <DeleteAccountForm />
    </Page>
  );
}
