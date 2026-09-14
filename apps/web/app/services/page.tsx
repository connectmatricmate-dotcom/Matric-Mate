import type { Metadata } from 'next';
import Link from 'next/link';
import { AI_QUOTA, BUSINESS, SUPPORT_EMAIL } from '@matricmate/core';
import { Nav } from '@/components/landing/Nav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { BASIC_PLAN, THE_PLAN, rupees } from '@/lib/plans';
import { canonicalUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'What a plan includes',
  description:
    'Every service in a MatricMate plan: chapter notes, audio lessons, practice questions, past papers, progress reports and a parent report card, with the AI tutor and mock papers in Premium.',
  alternates: { canonical: canonicalUrl('/services') },
};

/**
 * The service catalogue, on one page.
 *
 * MatricMate sells a single plan, so "what am I buying" was answered only by
 * a landing page written to persuade. This page answers it plainly instead,
 * one entry per service, which is also what a payment gateway looks for when
 * it reviews a merchant: a site that says what the money buys before it asks
 * for any.
 */
const SERVICES: { name: string; what: string; premium?: true }[] = [
  {
    name: 'Chapter notes',
    what: 'Every chapter of the FBISE and Punjab Board Class 9 and Class 10 syllabus, written as revision notes rather than a textbook reprint. English and Urdu medium, switchable at any time.',
  },
  {
    name: 'Audio lessons',
    what: 'A recorded walkthrough of each published chapter, for revising while travelling or when reading is hard going. Plays inside the app and the website.',
  },
  {
    name: 'Practice questions',
    what: 'Chapter-wise multiple choice and short questions with worked answers, drawn from the syllabus and past board papers, so practice matches what the board actually asks.',
  },
  {
    name: 'Mock papers',
    what: 'Papers in the board pattern: Section A as a timed test, then Sections B and C written in the app and marked against the points an examiner looks for.',
    premium: true,
  },
  {
    name: 'Past papers',
    what: 'A directory of past papers from FBISE and the Punjab boards, plus FBISE topper scripts, linked to each board’s own published copies so you are always reading the original.',
  },
  {
    name: 'AI tutor',
    what: `Ask a question in English or Urdu and get it explained, stepped through, and followed up. Up to ${AI_QUOTA.premium} questions a day, with your chapters and progress already in view. Written answers marked the way an examiner would, AI practice tests, one-page revision sheets, a weekly coach and career guidance come with it.`,
    premium: true,
  },
  {
    name: 'Progress tracking',
    what: 'What you have read, what you have answered, and which topics keep costing you marks, kept current as you work so revision goes where it is needed.',
  },
  {
    name: 'Parent report card',
    what: 'A monthly report card the student downloads as a PDF: a grade per subject, how it moved, questions answered and days studied, so a parent can follow along without an account.',
  },
  {
    name: 'Android app',
    what: 'Coming to Google Play: the same account on a phone, with chapters you can download and study without a connection. Until it arrives, everything above works in a phone’s browser.',
  },
];

export default function ServicesPage() {
  return (
    <>
      <Nav />

      <main className="mx-auto max-w-[720px] px-5 py-14">
        <h1 className="font-display text-mk-h1 text-ink">What a plan includes</h1>
        <p className="mt-3 text-mk-lead text-ink2">
          Two plans: Basic at {rupees(BASIC_PLAN.price)} a month and Premium at {rupees(THE_PLAN.price)}. Basic includes
          everything below except the services marked Premium; Premium includes all of it. There is no free tier,
          but a new account can try one subject free for three days, and nothing costs extra once you have paid.
        </p>

        <div className="mt-10 flex flex-col gap-9">
          {SERVICES.map((s) => (
            <section key={s.name}>
              <h2 className="font-display text-[22px] text-ink">
                {s.name}
                {s.premium ? <span className="ms-2 align-middle text-[13px] font-extrabold text-orangedark">Premium</span> : null}
              </h2>
              <p className="mt-2 text-mk-body leading-[1.75] text-ink2">{s.what}</p>
            </section>
          ))}

          <section>
            <h2 className="font-display text-[22px] text-ink">How the service is delivered</h2>
            <p className="mt-2 text-mk-body leading-[1.75] text-ink2">
              MatricMate is a digital service. Nothing is posted or shipped. Access opens on the account you paid
              with, normally within a few seconds of the payment being confirmed, and is used by signing in on this
              website, and in the Android app once it is on Google Play. A plan runs for one month from the day it is
              paid, and the end date is shown on your account.
            </p>
            <p className="mt-2 text-mk-body leading-[1.75] text-ink2">
              If a payment succeeds and access has not opened within a few minutes, write to {SUPPORT_EMAIL}
              {BUSINESS.phone ? ` or call ${BUSINESS.phone}` : ''} with the receipt and we will sort it out the same
              day.
            </p>
          </section>
        </div>

        <p className="mt-10 text-mk-small text-ink3">
          See also <Link className="text-teal hover:underline" href="/pricing">pricing</Link>,{' '}
          <Link className="text-teal hover:underline" href="/refunds">refunds and cancellation</Link>, and{' '}
          <Link className="text-teal hover:underline" href="/terms">terms</Link>.
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
