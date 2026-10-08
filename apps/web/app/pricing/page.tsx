import type { Metadata } from 'next';
import { keepStaffOut } from '@/lib/roles';
import Link from 'next/link';
import { AI_QUOTA, BUSINESS, SUPPORT_EMAIL } from '@matricmate/core';
import { Nav } from '@/components/landing/Nav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { PayMark } from '@/components/commerce/PayMark';
import { PlanPicker } from '@/components/commerce/PlanPicker';
import { Card, Icon, Pill } from '@/components/ui/primitives';
import { onlinePayments } from '@/lib/gateway';
import { PAYMENT_METHODS } from '@/lib/plans';
import { canonicalUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Basic at Rs 500 a month opens every chapter, practice set and past paper. Premium at Rs 1,000 adds the AI tutor. Try one subject free for 3 days. Nothing renews on its own.',
  alternates: { canonical: canonicalUrl('/pricing') },
};

/** Row-by-row, so a parent can see exactly where the money goes and what the extra Rs 500 buys. */
const COMPARE: { feature: string; basic: string; premium: string }[] = [
  { feature: 'Chapters, notes and audio lessons', basic: 'All of them', premium: 'All of them' },
  { feature: 'MCQs, blanks and short questions', basic: 'Unlimited', premium: 'Unlimited' },
  { feature: 'Timed tests and past papers', basic: 'Unlimited', premium: 'Unlimited' },
  { feature: 'Weak topics and monthly report card', basic: 'Included', premium: 'Included' },
  // Straight from the limit the tutor route enforces, so the table cannot
  // quietly promise a different number from the one the API allows.
  { feature: 'AI tutor questions a day', basic: 'None', premium: String(AI_QUOTA.premium) },
  { feature: 'AI answer checking, AI tests and mock papers', basic: 'Not included', premium: 'Included' },
  { feature: 'Revision sheets, weekly coach and career guidance', basic: 'Not included', premium: 'Included' },
  { feature: 'Offline downloads', basic: 'With the Android app', premium: 'With the Android app' },
  { feature: 'Where it works', basic: 'Website and Android app', premium: 'Website and Android app' },
];

/**
 * How paying works, said the way it works today. Until a payment gateway is
 * live (onlinePayments in lib/gateway) the team switches plans on by hand, and
 * a page promising wallets and cards at checkout would send a parent looking
 * for a payment screen that is not there.
 */
function payAnswer(online: boolean): string {
  return online
    ? 'Yes. Mobile wallets and bank accounts both work, as does any debit or credit card. Payments are handled by a State Bank licensed payment gateway, so your details never touch our servers.'
    : `Get in touch with the plan you want, by email at ${SUPPORT_EMAIL} or on ${BUSINESS.phone}, and our team tells you how to pay and switches the plan on for your account.`;
}

const questions = (online: boolean) => [
  {
    q: 'What is the difference between Basic and Premium?',
    a: `The AI. Basic opens the whole syllabus: every chapter, note and audio lesson, unlimited practice, timed tests, past papers and the monthly report card. Premium adds the AI tutor (${AI_QUOTA.premium} questions a day), marking of written answers, AI tests, mock papers, revision sheets, a weekly coach and career guidance.`,
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. Make an account and pick one subject: its chapters, notes, audio and practice open for three days, with a few AI tutor questions a day. There is nothing to pay and nothing to cancel, and each account gets one trial.',
  },
  {
    q: 'Can I move from Basic to Premium?',
    a: 'Yes, at any time. The Basic days you have left carry over at their value, so every rupee you paid counts towards the new plan.',
  },
  {
    q: 'What happens when my plan runs out?',
    a: 'Nothing renews on its own. The end date sits on your account page from the day you pay, so you can see it coming; if you want to carry on, you pay then. If you don’t, the chapters, tests and tutor lock until you do, and your progress stays on the account for when you come back.',
  },
  {
    q: online ? 'Can I pay from a mobile account?' : 'How do I pay?',
    a: payAnswer(online),
  },
  {
    q: 'Does one payment cover the phone and the website?',
    a: 'Yes. One account, both surfaces. Study on your laptop at home and on your phone on the bus, and the same progress follows you.',
  },
  {
    q: 'What if I want to stop?',
    a: 'Then you stop, and there is nothing to cancel. A plan is a single payment that runs to its end date; we keep no card on file and never charge you again, so leaving it alone is enough. You keep access to the last day you paid for.',
  },
  {
    q: 'Is there a discount for a whole class or school?',
    a: `Yes, for ten students or more. Write to ${SUPPORT_EMAIL} and we’ll set it up.`,
  },
];

export default async function PricingPage() {
  // Public to a visitor, but a signed-in teacher or administrator has taken a
  // wrong turn: there is nothing here for them to buy.
  await keepStaffOut();
  const online = onlinePayments();

  return (
    <>
      <Nav />

      <main>
        <section className="mx-auto max-w-[1100px] px-5 pb-4 pt-14 text-center">
          <Pill tone="orange">Nothing auto-renews</Pill>
          <h1 className="mx-auto mt-3 max-w-[640px] font-display text-mk-h1 text-ink">
            Every subject and every chapter, on either plan.
          </h1>
          <p className="mx-auto mt-3 max-w-[560px] text-mk-lead text-ink2">
            Basic opens the whole syllabus. Premium adds the AI tutor. Either costs less than one hour of home
            tuition a month, and neither goes home at nine.
          </p>
        </section>

        <PlanPicker />

        {/* ---------------------------------------------------- what's inside */}
        <section className="border-t border-tealtint2 bg-tealtint">
          <div className="mx-auto max-w-[860px] px-5 py-16">
            <h2 className="font-display text-mk-h2 text-ink">What each plan opens</h2>
            <p className="mt-3 text-mk-lead text-ink2">
              Both plans open the whole syllabus. The difference is the AI, and nothing else costs extra.
            </p>

            {/* No minimum width: two short columns fit a phone, and a table
                that scrolled sideways put "With your plan" half off-screen
                with nothing to say it moved. */}
            <div className="mt-7 overflow-x-auto">
              <table className="w-full border-collapse text-start">
                <thead>
                  <tr className="border-b-2 border-line">
                    <th scope="col" className="py-3 pe-4 text-start text-[12px] font-extrabold uppercase tracking-[0.07em] text-ink3">
                      What you get
                    </th>
                    <th scope="col" className="w-[26%] py-3 pe-3 text-start text-[12px] font-extrabold uppercase tracking-[0.07em] text-ink2 sm:w-[170px]">
                      Basic
                    </th>
                    <th scope="col" className="w-[26%] py-3 text-start text-[12px] font-extrabold uppercase tracking-[0.07em] text-orangedark sm:w-[170px]">
                      Premium
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row) => (
                    <tr key={row.feature} className="border-b border-line">
                      <th scope="row" className="py-3 pe-4 text-start text-[15px] font-normal text-ink">
                        {row.feature}
                      </th>
                      <td className={`py-3 pe-3 text-[15px] font-extrabold ${row.basic === row.premium ? 'text-ink' : 'text-ink3'}`}>{row.basic}</td>
                      <td className="py-3 text-[15px] font-extrabold text-ink">{row.premium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- payment */}
        {online ? (
        <section className="mx-auto max-w-[860px] px-5 py-16">
          <h2 className="font-display text-mk-h2 text-ink">Pay the way you already pay</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {PAYMENT_METHODS.map((m) => (
              <Card key={m.id} flat className="flex items-center gap-3">
                <PayMark logo={m.logo} label={m.label} size={30} />
                <span>
                  <span className="block text-[15px] font-extrabold text-ink">{m.label}</span>
                  <span className="block text-[13.5px] text-ink2">{m.hint}</span>
                </span>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-mk-small text-ink2">
            Handled by a licensed Pakistani payment gateway. We never see or store your card or wallet details, and nothing renews on its own. Your
            plan runs to the end date shown on your account, and paying again is always your move.
          </p>
        </section>
        ) : (
        <section className="mx-auto max-w-[860px] px-5 py-16">
          <h2 className="font-display text-mk-h2 text-ink">How to get a plan</h2>
          <ol className="mt-6 flex flex-col gap-3">
            {[
              'Make your account and pick your board, class and subjects.',
              `Email ${SUPPORT_EMAIL} or call ${BUSINESS.phone} with your account email and the plan you want.`,
              'Our team tells you how to pay and switches the plan on. It shows on the website and in the app straight away.',
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal font-display text-[14px] text-onbrand">
                  {i + 1}
                </span>
                <span className="text-mk-body text-ink">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-mk-small text-ink2">
            We answer {BUSINESS.hours}. Nothing renews on its own: your plan runs to the end date shown on your account,
            and paying again is always your move.
          </p>
        </section>
        )}

        {/* -------------------------------------------------------------- faq */}
        <section className="border-t border-tealtint2 bg-tealtint">
          <div className="mx-auto max-w-[760px] px-5 py-16">
            <h2 className="font-display text-mk-h2 text-ink">Before you pay</h2>
            <div className="mt-7 flex flex-col gap-3">
              {questions(online).map((f) => (
                // The padding lives on the summary, so the whole row is the tap
                // target rather than the words in the middle of it.
                <details key={f.q} className="group rounded-[16px] border border-line bg-card">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[16px] font-extrabold text-ink [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Icon name="plus" size={18} className="shrink-0 text-ink3 transition-transform duration-200 group-open:rotate-45" />
                  </summary>
                  <p className="faq-a px-5 pb-4 text-mk-body text-ink2">{f.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-6 text-[14.5px] text-ink2">
              Ready?{' '}
              <Link href="/signup" className="font-extrabold text-teal hover:underline">
                Make the account
              </Link>{' '}
              and you are two minutes from the first chapter.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
