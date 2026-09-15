import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/landing/Nav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { Card, Icon, LinkBtn } from '@/components/ui';
import { BUSINESS, SUPPORT_EMAIL } from '@matricmate/core';
import { canonicalUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Delete your account',
  description: 'How to permanently delete a MatricMate account and everything stored against it.',
  alternates: { canonical: canonicalUrl('/delete-account') },
};

/**
 * Google Play requires a publicly reachable page explaining account deletion,
 * usable without installing the app, for any app that has accounts.
 *
 * Deletion is in the product now: account settings, "Delete my account", in
 * both apps. This page says how, what goes and what stays, and keeps the
 * request by email for anybody who can no longer sign in.
 *
 * The Android app links here with ?from=app, and that version is bare: no
 * navigation, and no word about refunds or a link to the refund policy,
 * which carries the site's full navigation, pricing two taps away.
 */
export default async function DeleteAccountPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const bare = (await searchParams).from === 'app';
  return (
    <>
      <Nav bare={bare} />

      <main className="mx-auto max-w-[720px] px-5 py-14">
        <h1 className="font-display text-mk-h1 text-ink">Delete your account</h1>
        <p className="mt-3 text-mk-lead text-ink2">
          You can delete your MatricMate account and everything stored against it. It cannot be undone.
        </p>

        <Card className="mt-8">
          <h2 className="font-display text-[20px] text-ink">Delete it yourself</h2>
          <ol className="mt-3 flex flex-col gap-2.5">
            {[
              'Sign in to MatricMate, in the Android app or on the website.',
              'Open your account settings and choose “Delete my account”.',
              'Read what is deleted, type DELETE and confirm. The account is gone straight away and you are signed out.',
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3 text-mk-body text-ink2">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal font-display text-[14px] text-onbrand">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="mt-4">
          <h2 className="font-display text-[20px] text-ink">If you cannot sign in</h2>
          <p className="mt-2 text-mk-body text-ink2">
            Email <span className="font-extrabold text-ink wrap-anywhere">{SUPPORT_EMAIL}</span> with “delete my account”
            in the subject, or call {BUSINESS.phone} ({BUSINESS.hours}), with the name and mobile number on the account.
            You do not have to give a reason. We check the account is really yours, then delete it within seven days.
          </p>
          <LinkBtn
            title={`Email ${SUPPORT_EMAIL}`}
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Delete my account')}`}
            icon="mail"
            variant="line"
            className="mt-4 w-full wrap-anywhere sm:w-auto"
          />
        </Card>

        <h2 className="mt-10 font-display text-[22px] text-ink">What gets deleted</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {[
            'Your name, mobile number and any email on the account',
            'Every answer, test attempt, score and weak-topic record',
            'Reading progress, downloads, flashcard history and study plans',
            'AI tutor conversations',
          ].map((li) => (
            <li key={li} className="flex items-start gap-2.5 text-mk-body text-ink2">
              <Icon name="check" size={17} strokeWidth={2.6} className="mt-0.5 shrink-0 text-green" />
              {li}
            </li>
          ))}
        </ul>

        <h2 className="mt-8 font-display text-[22px] text-ink">What we have to keep</h2>
        <p className="mt-2 text-mk-body leading-[1.75] text-ink2">
          Records of payments, meaning the amount, date and reference, are kept for as long as tax and accounting law
          in Pakistan requires. They are kept separately from your study data and are no longer linked to any account.
        </p>

        {bare ? null : (
          <>
            <h2 className="mt-8 font-display text-[22px] text-ink">Before you delete</h2>
            <p className="mt-2 text-mk-body leading-[1.75] text-ink2">
              Deleting does not refund a plan you have already paid for, and the two are handled separately. If you want
              money back as well, read the{' '}
              <Link href="/refunds" className="font-extrabold text-teal hover:underline">
                refund policy
              </Link>{' '}
              first and ask for the refund before deleting, because afterwards we can no longer see the account it
              belongs to.
            </p>
          </>
        )}
      </main>

      <SiteFooter bare={bare} />
    </>
  );
}
