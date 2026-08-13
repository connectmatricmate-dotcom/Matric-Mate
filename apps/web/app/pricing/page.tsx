import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/landing/Nav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { PayMark } from '@/components/commerce/PayMark';
import { PlanPicker } from '@/components/commerce/PlanPicker';
import { Card, Icon, Pill } from '@/components/ui/primitives';
import { PAYMENT_METHODS } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Rs 1,000 a month for everything in MatricMate: every chapter, unlimited practice, past papers and the AI tutor. Cancel any time.',
};

/** Row-by-row, so a parent can see exactly where the money goes. */
const COMPARE: { feature: string; premium: string }[] = [
  { feature: 'Chapters, notes and audio lessons', premium: 'All of them, English and Urdu' },
  { feature: 'MCQs, blanks and short questions', premium: 'Unlimited' },
  { feature: 'Timed tests and past papers', premium: 'Unlimited' },
  { feature: 'AI tutor questions a day', premium: '20' },
  { feature: 'Weak topics and monthly report card', premium: 'Included' },
  { feature: 'Offline downloads (Android app)', premium: 'Included' },
  { feature: 'Android app and website', premium: 'One account, both' },
];

const QUESTIONS = [
  {
    q: 'What happens when my plan runs out?',
    a: 'Nothing renews on its own. We message you two days before your plan runs out; if you want to carry on, you pay then. If you don’t, your progress stays on the account and it simply stops unlocking new chapters.',
  },
  {
    q: 'Can I pay from a mobile account?',
    a: 'Yes. JazzCash and Easypaisa both work, as does any debit or credit card. Payments are handled by Safepay, so your details never touch our servers.',
  },
  {
    q: 'Does one payment cover the phone and the website?',
    a: 'Yes. One account, both surfaces. Study on your laptop at home and on your phone on the bus, and the same progress follows you.',
  },
  {
    q: 'Can I cancel?',
    a: 'Any time, from Profile, then Subscription. You keep access until the date you’ve already paid for, and chapters downloaded in the Android app stay on your phone.',
  },
  {
    q: 'Is there a discount for a whole class or school?',
    a: 'Yes, for ten students or more. Message us on WhatsApp and we’ll set it up.',
  },
];

export default function PricingPage() {
  return (
    <>
      <Nav />

      <main>
        <section className="mx-auto max-w-[1100px] px-5 pb-4 pt-14 text-center">
          <Pill tone="orange">Cancel any time</Pill>
          <h1 className="mx-auto mt-3 max-w-[640px] font-display text-mk-h1 text-ink">
            One plan. Every subject, every chapter, both apps.
          </h1>
          <p className="mx-auto mt-3 max-w-[560px] text-mk-lead text-ink2">
            A month of MatricMate costs less than one hour of home tuition, and it doesn’t go home at nine.
          </p>
        </section>

        <PlanPicker />

        {/* ---------------------------------------------------- what's inside */}
        <section className="border-t border-tealtint2 bg-tealtint">
          <div className="mx-auto max-w-[860px] px-5 py-16">
            <h2 className="font-display text-mk-h2 text-ink">Everything opens with the plan</h2>
            <p className="mt-3 text-mk-lead text-ink2">
              There is one plan and it holds the whole product. No tiers to compare, no feature held back for a
              bigger one.
            </p>

            <div className="mt-7 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-line">
                    <th scope="col" className="py-3 text-[12px] font-extrabold uppercase tracking-[0.07em] text-ink3">
                      What you get
                    </th>
                    <th scope="col" className="w-[190px] py-3 text-[12px] font-extrabold uppercase tracking-[0.07em] text-orangedark">
                      With your plan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row) => (
                    <tr key={row.feature} className="border-b border-line">
                      <th scope="row" className="py-3 text-[15px] font-normal text-ink">
                        {row.feature}
                      </th>
                      <td className="py-3 text-[15px] font-extrabold text-ink">{row.premium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- payment */}
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
            Handled by Safepay. We never see or store your card or wallet details, and nothing renews on its own. We
            remind you two days before your plan ends and you decide.
          </p>
        </section>

        {/* -------------------------------------------------------------- faq */}
        <section className="border-t border-tealtint2 bg-tealtint">
          <div className="mx-auto max-w-[760px] px-5 py-16">
            <h2 className="font-display text-mk-h2 text-ink">Before you pay</h2>
            <div className="mt-7 flex flex-col gap-3">
              {QUESTIONS.map((f) => (
                <details key={f.q} className="group rounded-[16px] border border-line bg-card px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-extrabold text-ink">
                    {f.q}
                    <Icon name="plus" size={18} className="shrink-0 text-ink3 transition-transform duration-200 group-open:rotate-45" />
                  </summary>
                  <p className="faq-a mt-3 text-mk-body text-ink2">{f.a}</p>
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
