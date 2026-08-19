import type { Metadata } from 'next';
import Link from 'next/link';
import { AI_QUOTA, BUSINESS, SUPPORT_EMAIL } from '@matricmate/core';
import { Nav } from '@/components/landing/Nav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { THE_PLAN } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'What a plan includes',
  description:
    'Every service in a MatricMate Premium plan: chapter notes, audio lessons, practice questions, mock papers, past papers, an AI tutor, progress reports and a parent report card.',
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
const SERVICES: { name: string; what: string }[] = [
  {
    name: 'Chapter notes',
    what: 'Every chapter of the FBISE Class 9 and Class 10 syllabus, written as revision notes rather than a textbook reprint. English and Urdu medium, switchable at any time.',
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
    what: 'Full-length papers in the FBISE pattern, timed and marked, with a breakdown afterwards of where the marks went.',
  },
  {
    name: 'Past papers',
    what: 'A directory of FBISE past papers and topper scripts, linked to the board’s own published copies so you are always reading the original.',
  },
  {
    name: 'AI tutor',
    what: `Ask a question in English or Urdu and get it explained, stepped through, and followed up. Up to ${AI_QUOTA.premium} questions a day, with your chapters and progress already in view.`,
  },
  {
    name: 'Progress tracking',
    what: 'What you have read, what you have answered, and which topics keep costing you marks, kept current as you work so revision goes where it is needed.',
  },
  {
    name: 'Parent report card',
    what: 'A shareable summary of study time, test scores and weak topics, so a parent can follow along without needing an account.',
  },
  {
    name: 'Android app',
    what: 'The same account on a phone, including downloaded chapters that keep working without a connection.',
  },
];

export default function ServicesPage() {
  return (
    <>
      <Nav />

      <main className="mx-auto max-w-[720px] px-5 py-14">
        <h1 className="font-display text-mk-h1 text-ink">What a plan includes</h1>
        <p className="mt-3 text-mk-lead text-ink2">
          One plan, Rs {THE_PLAN.price.toLocaleString('en-PK')} a month, and everything below is in it. There is no
          free tier and nothing costs extra once you have paid.
        </p>

        <div className="mt-10 flex flex-col gap-9">
          {SERVICES.map((s) => (
            <section key={s.name}>
              <h2 className="font-display text-[22px] text-ink">{s.name}</h2>
              <p className="mt-2 text-mk-body leading-[1.75] text-ink2">{s.what}</p>
            </section>
          ))}

          <section>
            <h2 className="font-display text-[22px] text-ink">How the service is delivered</h2>
            <p className="mt-2 text-mk-body leading-[1.75] text-ink2">
              MatricMate is a digital service. Nothing is posted or shipped. Access opens on the account you paid
              with, normally within a few seconds of the payment being confirmed, and is used on this website or in
              the Android app by signing in. A plan runs for one month from the day it is paid, and the end date is
              shown on your account.
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
