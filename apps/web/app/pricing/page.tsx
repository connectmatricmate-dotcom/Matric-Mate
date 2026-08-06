import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/landing/Nav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { PayMark } from '@/components/commerce/PayMark';
import { PlanPicker } from '@/components/commerce/PlanPicker';
import { Card, Icon, Pill } from '@/components/ui/primitives';
import { FREE_INCLUDED, PAYMENT_METHODS } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Rs 1,000 a month for everything in MatricMate: every chapter, unlimited practice, past papers and the AI tutor. Three days free, cancel any time.',
};

/** Row-by-row, so a parent can see exactly where the money goes. */
const COMPARE: { feature: string; free: string; premium: string }[] = [
  { feature: 'Chapters and notes', free: 'One per subject', premium: 'All of them' },
  { feature: 'Audio lessons', free: 'Sample chapter', premium: 'Every chapter' },
  { feature: 'MCQs a day', free: '5', premium: 'Unlimited' },
  { feature: 'Timed tests and past papers', free: 'No', premium: 'Unlimited' },
  { feature: 'AI tutor questions a day', free: '5', premium: '20' },
  { feature: 'Weak topics', free: 'No', premium: 'Yes' },
  { feature: 'Monthly report card', free: 'No', premium: 'Yes' },
  { feature: 'Offline downloads', free: 'No', premium: 'Yes' },
  { feature: 'Android app and website', free: 'Yes', premium: 'Yes, one account' },
];

const QUESTIONS = [
  {
    q: 'What happens after the three free days?',
    a: 'Nothing is charged automatically. We message you two days before the trial ends; if you want to carry on, you pay then. If you don’t, the account drops back to the free plan and your progress stays.',
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
    a: 'Any time, from Profile, then Subscription. You keep access until the date you’ve already paid for, and downloads stay on your device.',
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
          <Pill tone="orange">First 3 days free</Pill>
          <h1 className="mx-auto mt-3 max-w-[640px] font-display text-mk-h1 text-ink">
            One plan. Every subject, every chapter, both apps.
          </h1>
          <p className="mx-auto mt-3 max-w-[560px] text-mk-lead text-ink2">
            A month of MatricMate costs less than one hour of home tuition, and it doesn’t go home at nine.
          </p>
        </section>

        <PlanPicker />

        {/* ------------------------------------------------------- comparison */}
        <section className="border-t border-tealtint2 bg-tealtint">
          <div className="mx-auto max-w-[860px] px-5 py-16">
            <h2 className="font-display text-mk-h2 text-ink">Free and Premium, side by side</h2>
            <p className="mt-3 text-mk-lead text-ink2">
              The free plan is a real plan, not a countdown. It stays free for as long as you want it.
            </p>

            <div className="mt-7 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-line">
                    <th scope="col" className="py-3 text-[12px] font-extrabold uppercase tracking-[0.07em] text-ink3">
                      What you get
                    </th>
                    <th scope="col" className="w-[130px] py-3 text-[12px] font-extrabold uppercase tracking-[0.07em] text-ink3">
                      Free
                    </th>
                    <th scope="col" className="w-[150px] py-3 text-[12px] font-extrabold uppercase tracking-[0.07em] text-orangedark">
                      Premium
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row) => (
                    <tr key={row.feature} className="border-b border-line">
                      <th scope="row" className="py-3 text-[15px] font-normal text-ink">
                        {row.feature}
                      </th>
                      <td className="py-3 text-[15px] text-ink2">{row.free}</td>
                      <td className="py-3 text-[15px] font-extrabold text-ink">{row.premium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Card flat className="mt-7">
              <p className="text-mk-label font-extrabold uppercase tracking-[0.08em] text-ink2">Staying on free</p>
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {FREE_INCLUDED.map((li) => (
                  <li key={li} className="flex items-start gap-2.5 text-mk-body text-ink2">
                    <Icon name="check" size={16} strokeWidth={2.6} className="mt-0.5 shrink-0 text-ink3" />
                    {li}
                  </li>
                ))}
              </ul>
            </Card>
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
              Still unsure?{' '}
              <Link href="/signup" className="font-extrabold text-teal hover:underline">
                Start on the free plan
              </Link>{' '}
              and upgrade when it earns it.
            </p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
