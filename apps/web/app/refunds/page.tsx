import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/landing/Nav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { BUSINESS, SUPPORT_EMAIL } from '@matricmate/core';

export const metadata: Metadata = {
  title: 'Refund and cancellation policy',
  description: 'When MatricMate refunds a payment, how to ask for one, and how long money takes to come back.',
};

const SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: 'Stopping',
    paragraphs: [
      'There is no subscription to cancel, and that is deliberate. A plan is one payment for a fixed stretch of time, we keep no card on file, and nothing charges you again, so if you do nothing at all the plan simply ends on its last paid day.',
      'When a plan ends you keep your account and everything in it: your progress, your practice history and your weak-topic analysis. What stops is access to chapters, tests and the AI tutor.',
    ],
  },
  {
    heading: 'When we refund in full',
    paragraphs: [
      'If you were charged twice for the same plan, we refund the duplicate in full, and you do not need to ask. We check for duplicates ourselves.',
      'If a payment went through for a plan you did not choose, we refund it in full.',
      'If a technical fault on our side stopped you using what you paid for and we could not fix it within three working days, we refund the unused part of the plan.',
      'If you paid within the last seven days and have not opened more than one chapter, we refund it in full, no reason needed.',
    ],
  },
  {
    heading: 'When we do not refund',
    paragraphs: [
      'We do not refund a plan that has been used for more than seven days, because the content has been delivered. The plan then runs to its end date, and since nothing renews there is no further payment to worry about.',
      'We do not refund on the grounds of exam results. MatricMate is a study aid and cannot promise a grade.',
    ],
  },
  {
    heading: 'How to ask for one',
    paragraphs: [
      `Call ${BUSINESS.phone} or email ${SUPPORT_EMAIL} with the mobile number on the account and the date of the payment. That is all we need to find it.`,
      'We reply within two working days. Approved refunds go back through the payment gateway to the same method you paid with, which is the only place they can go. Wallets usually take two to three working days, and cards five to ten working days, depending on the bank.',
    ],
  },
  {
    heading: 'Failed and pending payments',
    paragraphs: [
      'If money left your account but the plan did not activate, do not pay again. Send us the transaction ID and we will either activate the plan or return the payment.',
      'A payment the gateway declines is never taken. If you see it held on your statement it is an authorisation, and your bank releases it, usually within a few working days.',
    ],
  },
];

export default function RefundsPage() {
  return (
    <>
      <Nav />

      <main className="mx-auto max-w-[720px] px-5 py-14">
        <h1 className="font-display text-mk-h1 text-ink">Refund and cancellation policy</h1>
        <p className="mt-3 text-mk-lead text-ink2">
          Plain terms, and the same ones we hold ourselves to. If something here seems unfair, tell us and we will
          look at it.
        </p>

        <div className="mt-10 flex flex-col gap-9">
          {SECTIONS.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-[22px] text-ink">{s.heading}</h2>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="mt-2 text-mk-body leading-[1.75] text-ink2">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        <p className="mt-10 text-mk-small text-ink2">
          See also the{' '}
          <Link href="/terms" className="font-extrabold text-teal hover:underline">
            terms and privacy policy
          </Link>
          .
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
