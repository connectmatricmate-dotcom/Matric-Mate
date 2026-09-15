import type { Metadata } from 'next';
import { AI_QUOTA } from '@matricmate/core';
import { Nav } from '@/components/landing/Nav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { BUSINESS, SUPPORT_EMAIL } from '@matricmate/core';
import { onlinePayments } from '@/lib/gateway';
import { canonicalUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms and conditions',
  description: 'How MatricMate works, what a plan is, and the rules both sides agree to.',
  alternates: { canonical: canonicalUrl('/terms') },
};

type Section = { heading: string; paragraphs: string[] };

/**
 * The terms, said three ways where money comes into it.
 *
 * The Android app opens this page (?from=app), and Google Play treats an app
 * that names a price, a plan to buy or a website to pay on as steering its
 * users to pay outside Play. So in the app's version the plans section is
 * status only: what a plan opens, that it ends, what happens then. On the
 * website it says how a plan is actually got today, and that follows the
 * payment switch (onlinePayments): the team switches plans on by hand until a
 * gateway is live, and a page describing a checkout that is not there sent
 * parents looking for one.
 */
function sections(mode: 'app' | 'online' | 'manual'): Section[] {
  const paying: Section =
    mode === 'app'
      ? {
          heading: 'Plans, and what happens when one ends',
          paragraphs: [
            'Chapters, practice and the AI features open with a plan on your account, and the app shows whether a plan is on and the date it ends. A new account may try one subject free for three days, once.',
            'A plan runs for a fixed stretch of time and ends on its last day. Nothing renews automatically and nothing is charged again.',
            'When a plan ends, chapters, tests and the AI features lock. Your progress stays on the account.',
          ],
        }
      : {
          heading: 'Paying, and what happens when a plan ends',
          paragraphs: [
            mode === 'online'
              ? 'Plans are bought on this website. There are two: Basic, which opens every chapter, note, audio lesson and practice question, and Premium, which adds the AI tutor and the other AI features. A new account may also try one subject free for three days, once.'
              : `There are two plans: Basic, which opens every chapter, note, audio lesson and practice question, and Premium, which adds the AI tutor and the other AI features. To get one, write to ${SUPPORT_EMAIL} or call ${BUSINESS.phone} with your account email and the plan you want; our team tells you how to pay and switches the plan on for your account. A new account may also try one subject free for three days, once.`,
            'A plan is a single payment for a fixed stretch of time. Nothing renews automatically, no card is kept for a later charge, and the end date is shown on your account from the day the plan starts.',
            'There is no cancel button because there is no recurring charge to stop. If you do nothing, the plan ends on its last paid day. Access continues to that date, and your progress stays on the account whether or not you pay again.',
            mode === 'online'
              ? 'When you pay through the payment gateway, card, wallet and account details are typed on the gateway’s own page. They go to the gateway, never to us, and we store only the reference number shown on your receipt. When our team switches a plan on for you by hand, we record the payment against your account and keep no card or wallet details.'
              : 'When our team switches a plan on for you, we record the payment against your account: the amount, the date and a reference. We never ask for or keep card numbers, wallet PINs or bank passwords.',
          ],
        };

  return [
    {
      heading: 'What MatricMate is',
      paragraphs: [
        'MatricMate is exam-preparation software for FBISE and Punjab Board Class 9 and Class 10. It gives you notes, audio lessons, practice questions, past papers and an AI tutor. It is a study aid. It does not set, mark or influence any board examination, and it is not affiliated with the Federal Board of Intermediate and Secondary Education, any Board of Intermediate and Secondary Education in Punjab, or the Punjab textbook authority.',
        `Study content follows each board’s own syllabus: the FBISE syllabus and model papers, and for Punjab the official Punjab textbooks and the learning outcomes printed in them.${
          mode === 'online' ? ' Payments are handled by a State Bank licensed Pakistani payment gateway, which processes cards, wallets and bank transfers on our behalf.' : ''
        }`,
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'One account, one student. You are responsible for keeping your password to yourself; if you think someone else has it, set a new one with “Forgot password?” on the log in page.',
        'Students under 18 should have a parent or guardian read this page. The monthly report card is a PDF your child downloads and can hand to you, so a parent does not need an account of their own.',
      ],
    },
    paying,
    {
      heading: 'What we store, and why',
      paragraphs: [
        'Your name and contact, your class, board, medium and subject list, and your study activity: which sections you have read, which questions you answered, how sure you were, and your test results. That last part is what makes weak topics and the report card work. Without it the app cannot tell you anything useful.',
        'We do not sell your data, and we do not use it to advertise to you. Questions you ask the AI tutor are sent to the model that answers them and kept so you can see your own history.',
      ],
    },
    {
      heading: 'The AI tutor',
      paragraphs: [
        `The tutor is generated by a language model. It is good at explaining and stepping through work, and it can still be wrong, so check anything surprising against your textbook, and use “Report” on any answer that is wrong or not right for a student. A daily limit of ${AI_QUOTA.premium} questions applies so the feature stays affordable for everyone.`,
      ],
    },
    {
      heading: 'Deleting your account',
      paragraphs: [
        `You can delete your account yourself: open your account settings in the app or on the website and choose “Delete my account”. It is deleted straight away, with everything attached to it. If you cannot sign in, write to ${SUPPORT_EMAIL} and we will delete it within seven days. Payment records are kept as long as tax rules require.`,
      ],
    },
    {
      heading: 'Getting in touch',
      paragraphs: [
        `${BUSINESS.name}, ${BUSINESS.address}, ${BUSINESS.city}, ${BUSINESS.country}.`,
        `${BUSINESS.phone} · ${SUPPORT_EMAIL} · ${BUSINESS.hours}.`,
      ],
    },
  ];
}

export default async function TermsPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  // The Android app opens this with ?from=app: no navigation on to pricing,
  // and nothing in the words about buying (see sections).
  const bare = (await searchParams).from === 'app';
  const mode = bare ? 'app' : onlinePayments() ? 'online' : 'manual';
  return (
    <>
      <Nav bare={bare} />

      <main className="mx-auto max-w-[720px] px-5 py-14">
        <h1 className="font-display text-mk-h1 text-ink">Terms and conditions</h1>
        <p className="mt-3 text-mk-lead text-ink2">
          Written to be read. If anything here is unclear, ask us and we will explain it, and fix the wording.
        </p>

        <div className="mt-10 flex flex-col gap-9">
          {sections(mode).map((s) => (
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
      </main>

      <SiteFooter bare={bare} />
    </>
  );
}
