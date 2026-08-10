import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/landing/Nav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { Card, Icon, LinkBtn } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Delete your account',
  description: 'How to permanently delete a MatricMate account and everything stored against it.',
};

/**
 * Google Play requires a publicly reachable page explaining account deletion,
 * usable without installing the app, for any app that has accounts. It has to
 * be reachable without signing in, which is why the instructions come first
 * and the signed-in shortcut second.
 */
export default function DeleteAccountPage() {
  return (
    <>
      <Nav />

      <main className="mx-auto max-w-[720px] px-5 py-14">
        <h1 className="font-display text-mk-h1 text-ink">Delete your account</h1>
        <p className="mt-3 text-mk-lead text-ink2">
          You can delete your MatricMate account and everything stored against it. This does not need the app
          installed, and it cannot be undone.
        </p>

        <Card className="mt-8">
          <h2 className="font-display text-[20px] text-ink">Delete it yourself</h2>
          <p className="mt-2 text-mk-body text-ink2">
            Sign in, open Profile, then Settings, then Delete account. You will be asked to confirm, and the account
            is gone immediately.
          </p>
          <LinkBtn title="Sign in and delete" href="/login?next=/account/settings" className="mt-4" />
        </Card>

        <Card className="mt-4">
          <h2 className="font-display text-[20px] text-ink">Ask us to delete it</h2>
          <p className="mt-2 text-mk-body text-ink2">
            If you cannot sign in, email <span className="font-extrabold text-ink">help@matricmate.com.pk</span> from
            any address, or message the support number, with the mobile number on the account. We verify ownership by
            sending a code to that number, then delete it within seven days.
          </p>
        </Card>

        <h2 className="mt-10 font-display text-[22px] text-ink">What gets deleted</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {[
            'Your name, mobile number and any email on the account',
            'Every answer, test attempt, score and weak-topic record',
            'Reading progress, downloads, flashcard history and study plans',
            'AI tutor conversations',
            'Push notification tokens for your devices',
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
          in Pakistan requires. They are kept separately from your study data and are not linked to a usable account.
          We cannot delete these on request, and no payment provider allows it.
        </p>

        <h2 className="mt-8 font-display text-[22px] text-ink">Before you delete</h2>
        <p className="mt-2 text-mk-body leading-[1.75] text-ink2">
          Deleting does not refund a plan you have already paid for, and the two are handled separately. If you want
          money back as well, read the{' '}
          <Link href="/refunds" className="font-extrabold text-teal hover:underline">
            refund policy
          </Link>{' '}
          first and ask for the refund before deleting, because afterwards we can no longer see the account it belongs
          to.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
