import type { Metadata } from 'next';
import Link from 'next/link';
import { BUSINESS, SUPPORT_EMAIL } from '@matricmate/core';
import { Nav } from '@/components/landing/Nav';
import { SiteFooter } from '@/components/landing/SiteFooter';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What MatricMate stores about a student, why, who else sees it, and how to have it deleted.',
};

/**
 * Privacy on its own page.
 *
 * It was a section inside /terms, which is fine to read and wrong to find:
 * anyone looking for a privacy policy, a parent or a payment gateway
 * reviewing the merchant, looks for the word on its own. Same commitments,
 * their own address.
 */
const SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: 'Who we are',
    paragraphs: [
      `${BUSINESS.name} runs this website and the MatricMate Android app, from ${[BUSINESS.address, BUSINESS.city, BUSINESS.country].filter(Boolean).join(', ')}. We decide what is collected here and we are the people to complain to about it.`,
      `Write to ${SUPPORT_EMAIL}${BUSINESS.phone ? `, or call ${BUSINESS.phone}` : ''}.`,
    ],
  },
  {
    heading: 'What we collect',
    paragraphs: [
      'When you make an account: your name, email address and mobile number. The mobile number is used to reach you about your account and to fill in the payment form, so you are not typing it on a phone keyboard mid-purchase.',
      'When you study: your class, board, medium and subjects, which sections you have read, which questions you answered and how you rated your own confidence, your test scores, and the days you were active. This is the part that makes weak topics, streaks and the report card work; without it the app has nothing true to tell you.',
      'When you use the AI tutor: the questions you ask and the answers given, kept so you can read your own history back.',
      'Technical basics that any website receives, such as the pages requested and rough device information, used to keep the service working.',
    ],
  },
  {
    heading: 'What we do not collect',
    paragraphs: [
      'Card numbers, wallet PINs and bank credentials never reach us. Those are typed on the payment gateway’s own page and stay with them; we keep only the reference number printed on your receipt and the amount.',
      'We do not track you across other websites, we do not sell data, and we do not use your study history to advertise to you.',
    ],
  },
  {
    heading: 'Who else sees it',
    paragraphs: [
      'The payment gateway, for the transaction itself: your name, email and mobile number are passed so the payment can be attributed and a receipt issued.',
      'Our hosting and database providers, who store the data on our behalf and may not use it for anything else.',
      'The provider of the language model behind the AI tutor, which receives the question being asked in order to answer it.',
      'A parent or guardian you choose to share a report card with. That link is created by you, and it shows study progress, never your password or payment details.',
      'Nobody else, unless a Pakistani law or court requires it.',
    ],
  },
  {
    heading: 'How long we keep it',
    paragraphs: [
      'Your account and study history stay while the account exists, because a progress record that resets every month is not a progress record.',
      'Receipts and payment references are kept as long as tax and accounting rules require, even after an account is deleted. This is the one thing deletion does not remove.',
    ],
  },
  {
    heading: 'Children',
    paragraphs: [
      'MatricMate is built for Class 9 and Class 10 students, most of whom are under 18. A parent or guardian should read this page with them. A parent may write to us about their child’s account and ask for it to be corrected or deleted, and we will act on that.',
    ],
  },
  {
    heading: 'Your choices',
    paragraphs: [
      'You can correct your name, contact details, class and subjects at any time from Settings.',
      `You can have the whole account and everything attached to it deleted: use the delete account page, or write to ${SUPPORT_EMAIL}. It is done within seven days.`,
      'You can ask us for a copy of what we hold about you, and we will send it.',
    ],
  },
  {
    heading: 'Security',
    paragraphs: [
      'Traffic is encrypted in transit, passwords are stored hashed and never in readable form, and study data is walled off per account at the database itself rather than only in the app, so one student cannot read another’s work.',
    ],
  },
  {
    heading: 'Changes',
    paragraphs: [
      'If this policy changes in a way that affects what we collect or who sees it, we will say so in the app rather than quietly editing this page.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Nav />

      <main className="mx-auto max-w-[720px] px-5 py-14">
        <h1 className="font-display text-mk-h1 text-ink">Privacy policy</h1>
        <p className="mt-3 text-mk-lead text-ink2">
          What we store about a student, why we need it, and how to get rid of it.
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

        <p className="mt-10 text-mk-small text-ink3">
          See also <Link className="text-teal hover:underline" href="/terms">terms and conditions</Link> and{' '}
          <Link className="text-teal hover:underline" href="/refunds">refunds and cancellation</Link>.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
