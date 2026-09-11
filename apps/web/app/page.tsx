import Image from 'next/image';
import Link from 'next/link';
import { AI_QUOTA, PAPER_CONTENT, contentFor } from '@matricmate/core';
import { AudioSample } from '@/components/landing/AudioSample';
import { CursorGlow } from '@/components/landing/CursorGlow';
import { HeroDemo } from '@/components/landing/HeroDemo';
import { Nav } from '@/components/landing/Nav';
import { Reveal } from '@/components/landing/Reveal';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SubjectMarquee } from '@/components/landing/SubjectMarquee';
import { Tilt } from '@/components/landing/Tilt';
import { Card, Icon, LinkBtn, Pill, Ur } from '@/components/ui';
import type { IconName } from '@matricmate/core';

/** The chapter and questions here are the ones the app ships, not marketing filler. */
const dynamics = contentFor('phy-3');
/** Four questions for the self-playing hero, so the loop does not repeat fast. */
const heroMcqs = dynamics.mcqs.slice(0, 4);
/** Written by us to the board's pattern, so the card that renders it says so. */
const physicsPaper = PAPER_CONTENT.pp1;

const PAINS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'book',
    title: 'Parh liya, phir bhool gaya',
    body: 'Reading a chapter twice feels like studying. Then the test asks something slightly different and it’s gone.',
  },
  {
    icon: 'help',
    title: 'Raat ko koi poochne wala nahi',
    body: 'You get stuck at 11pm on one step of a numerical. The tutor comes on Thursday. The test is Monday.',
  },
  {
    icon: 'target',
    title: 'Pata hi nahi kya kamzor hai',
    body: 'You revise what already feels comfortable, because nothing tells you which topics are quietly costing you marks.',
  },
];

const STEPS = [
  { n: 1, title: 'Pick your subjects', body: 'Class 9 or Class 10, FBISE or Punjab Board, English or Urdu medium. Your syllabus loads, nothing else.' },
  { n: 2, title: 'Study the chapter', body: 'Notes, worked examples and an audio lesson you can play while travelling.' },
  { n: 3, title: 'Practise honestly', body: 'MCQs, flashcards, blanks and past papers. Each answer records how sure you were.' },
  { n: 4, title: 'Fix what’s weak', body: 'The app names the topics costing you marks and builds a test out of exactly those.' },
];

/** Chip tones rotate so the feature grid carries colour, not just copy. */
const INSIDE: { icon: IconName; tone: string; title: string; body: string }[] = [
  { icon: 'book', tone: 'bg-tealtint text-teal', title: 'Chapter-wise notes', body: 'Every chapter split into short sections with definitions, formulas and worked examples, in your medium.' },
  { icon: 'headphones', tone: 'bg-orangetint text-orangedark', title: 'Audio lessons', body: 'Listen to the whole chapter in English or Urdu, in the browser today. The Android app adds a download, so the second listen costs no data.' },
  { icon: 'cards', tone: 'bg-greentint text-green', title: 'Flashcards', body: 'Active recall for the definitions that show up in Section A. Cards you miss come back first.' },
  { icon: 'target', tone: 'bg-greentint text-green', title: 'MCQs with explanations', body: 'Every question tells you why the right answer is right, which is the part that actually teaches.' },
  { icon: 'edit', tone: 'bg-tealtint text-teal', title: 'Blanks and short questions', body: 'Model answers with the marking points, so you know what earns each mark.' },
  { icon: 'clock', tone: 'bg-orangetint text-orangedark', title: 'Timed tests', body: 'Full paper conditions with a question palette and flagging, so exam day isn’t the first time.' },
];

/**
 * The three buttons a student actually taps after every question, with the XP
 * the app really awards for them (XP.forAnswer in core). This panel used to
 * show accuracy percentages instead. Nobody has answered a question in
 * MatricMate yet, so those numbers could only ever have been invented.
 */
const CONFIDENCE_TAGS: { label: string; tone: 'green' | 'orange' | 'red'; body: string }[] = [
  { label: 'Certain', tone: 'green', body: 'Pakka. 12 XP when you are right, and first in the revision queue when you are not.' },
  { label: 'Fairly sure', tone: 'orange', body: 'Thora pakka. 10 XP, and the topic stays on the watch list.' },
  { label: 'Guess', tone: 'red', body: 'Tukka. 5 XP even when it lands, because a lucky answer is not knowledge.' },
];

const FAQ = [
  {
    q: 'Which board and class does this cover?',
    a: 'FBISE and Punjab Board, Class 9 and Class 10, in English and Urdu medium. Punjab covers all nine BISE boards, which set their papers from the same Punjab textbooks.',
  },
  {
    q: 'Does it work without internet?',
    a: 'The website needs a connection, and it is what MatricMate runs on today: any phone or laptop browser, nothing to install. Offline study belongs to the Android app, which is not on Play yet. Once it is, a saved chapter keeps its notes, audio and MCQs with no signal, and answers sync when you reconnect. The AI tutor and timed tests need a connection either way.',
  },
  {
    q: 'My child studies in Urdu medium. Is the content really in Urdu?',
    a: 'Yes. Notes, questions and the audio lesson come in the medium you choose. The app’s own buttons can be set to English or Roman Urdu separately.',
  },
  {
    q: 'How do I pay from Pakistan?',
    a: 'Mobile wallets, bank accounts or any debit and credit card, through a State Bank licensed payment gateway. You can also renew from a link we send on WhatsApp.',
  },
  {
    q: 'Can I use it on both phone and computer?',
    a: 'Yes. The website runs the same on a phone browser and a laptop, and your progress lives on the account rather than the device. The Android app signs in to that same account when it reaches Play.',
  },
  {
    q: 'Can I stop whenever I want?',
    a: 'Yes, and there is nothing to cancel. A plan is one payment that runs to its end date; no card is kept and nothing charges you again. If you want to carry on you pay for another stretch, and if you don’t, the plan just ends.',
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Fills across the top as the page scrolls. Pure CSS where the browser
          supports scroll-driven animation, invisible where it does not. */}
      <div className="read-bar" aria-hidden />
      <CursorGlow />

      <Nav />

      <main>
        {/* ---------------------------------------------------------- hero */}
        {/* The one dark screen, and the page's whole first impression. Light
            drifts behind it, a ring turns as you scroll, and the demo card
            answers itself. Everything below returns to paper. */}
        <section className="relative isolate overflow-hidden bg-night">
          <div className="aurora">
            <span />
            <span />
            <span />
          </div>
          <div className="scroll-arc arc-dark absolute -right-[22rem] -top-[26rem] h-[52rem] w-[52rem]" aria-hidden />
          <div className="scroll-arc arc-dark absolute -bottom-[34rem] -left-[20rem] h-[46rem] w-[46rem]" aria-hidden />

          <div className="relative mx-auto max-w-[1100px] px-5 pt-14 pb-10 md:pt-20">
            <div className="grid items-center gap-12 md:grid-cols-[1.05fr_0.95fr]">
              <div>
                {/* One inline run for the two scripts, so vertical-align lines
                    them up. Split across flex items they each centre on their
                    own box and the Nastaliq drops half a line. */}
                <span className="fx-rise fx-d1 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-1.5 text-[12.5px] font-extrabold text-tealtint">
                  <Icon name="gradCap" size={14} className="shrink-0 text-cyan" />
                  <span>
                    FBISE &amp; Punjab Board · Class 9 &amp; 10 · English &amp; <Ur>اردو</Ur>
                  </span>
                </span>

                <h1 className="fx-rise fx-d2 mt-5 font-display text-mk-hero text-balance text-white">
                  Know what you know{' '}
                  <span className="bg-gradient-to-r from-cyan via-cyan to-orange bg-clip-text text-transparent">
                    before the board does.
                  </span>
                </h1>

                <p className="fx-rise fx-d3 mt-4 max-w-[560px] text-mk-lead text-tealtint">
                  Chapter notes, audio lessons, past papers and a tutor that answers at midnight. Every question you
                  practise also records how sure you were, so MatricMate can show you the topics you only{' '}
                  <em>think</em> you know.
                </p>

                <p className="fx-rise fx-d4 mt-3 text-[16px] font-extrabold text-cyan">Poori tayyari, aik hi jagah.</p>

                <div className="fx-rise fx-d5 mt-7 flex flex-wrap gap-3">
                  <span className="pulse-glow rounded-[16px]">
                    <LinkBtn title="Get started" href="/signup" variant="orange" lg />
                  </span>
                  <Link
                    href="#pricing"
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[16px] border-[1.5px] border-white/25 px-7 py-4 font-display text-[18px] text-white transition-[background-color,border-color,transform] duration-200 ease-out hover:border-white/60 hover:bg-white/10 active:scale-[0.98]"
                  >
                    See pricing
                  </Link>
                </div>

                <p className="fx-rise fx-d6 mt-4 text-mk-small text-[color-mix(in_oklab,var(--color-tealtint)_80%,transparent)]">
                  Rs 1,000/month · nothing renews on its own · JazzCash, Easypaisa or card
                </p>
              </div>

              <div className="fx-card flex justify-center md:justify-end">
                <HeroDemo mcqs={heroMcqs} />
              </div>
            </div>
          </div>

          {/* The syllabus, moving. Sits on the seam between the dark hero and
              the page, so the eye is already following something. */}
          <div className="relative border-t border-white/10 py-5">
            <SubjectMarquee />
          </div>
        </section>

        {/* -------------------------------------------------------- problem */}
        <section className="relative mx-auto max-w-[1100px] overflow-hidden px-5 py-16 md:py-20">
          <div className="scroll-arc absolute -right-[30rem] top-[6rem] hidden h-[44rem] w-[44rem] md:block" aria-hidden />
          <Reveal>
            <h2 className="max-w-[680px] font-display text-mk-h2 text-ink">
              Studying harder isn’t the problem. Studying blind is.
            </h2>
          </Reveal>
          <Reveal stagger className="relative mt-9 grid gap-4 md:grid-cols-3">
            {PAINS.map((p) => (
              <Tilt key={p.title}>
                <Card className="lift h-full">
                  <span className="flex h-[44px] w-[44px] items-center justify-center rounded-[13px] bg-tealtint text-teal">
                    <Icon name={p.icon} size={22} />
                  </span>
                  <h3 className="mt-2.5 font-display text-mk-h3 text-ink">{p.title}</h3>
                  <p className="mt-1.5 text-mk-body text-ink2">{p.body}</p>
                </Card>
              </Tilt>
            ))}
          </Reveal>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section className="border-y border-tealtint2 bg-tealtint">
          <div className="mx-auto max-w-[1100px] px-5 py-16 md:py-20">
            <Reveal>
              <h2 className="font-display text-mk-h2 text-ink">How a week with MatricMate goes</h2>
            </Reveal>
            <Reveal as="ol" stagger className="mt-9 grid gap-6 md:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal to-cyan font-display text-[18px] text-white shadow-[0_6px_18px_rgba(10,126,164,0.35)]">
                    {s.n}
                  </span>
                  <h3 className="mt-3 font-display text-mk-h3 text-ink">{s.title}</h3>
                  <p className="mt-1 text-mk-body text-ink2">{s.body}</p>
                </li>
              ))}
            </Reveal>
          </div>
        </section>

        {/* --------------------------------------------------------- inside */}
        <section id="inside" className="mx-auto max-w-[1100px] scroll-mt-20 px-5 py-16 md:py-20">
          <Reveal>
            <h2 className="font-display text-mk-h2 text-ink">What’s inside every chapter</h2>
            <p className="mt-3 max-w-[620px] text-mk-lead text-ink2">
              Not a video library you never open. Each chapter is one place with everything the exam asks of it.
            </p>
          </Reveal>

          <div className="mt-9 grid gap-8 md:grid-cols-[1fr_380px]">
            <Reveal stagger className="grid content-start gap-4 sm:grid-cols-2">
              {INSIDE.map((f) => (
                <Tilt key={f.title} max={5}>
                  <Card className="lift h-full">
                    <span className={`flex h-[44px] w-[44px] items-center justify-center rounded-[13px] ${f.tone}`}>
                      <Icon name={f.icon} size={22} />
                    </span>
                    <h3 className="mt-2.5 font-display text-mk-h3 text-ink">{f.title}</h3>
                    <p className="mt-1 text-mk-body text-ink2">{f.body}</p>
                  </Card>
                </Tilt>
              ))}
            </Reveal>

            <Reveal className="flex flex-col gap-4">
              <AudioSample />

              {/* a real slice of the chapter, not lorem */}
              <Card className="flex-1">
                <p className="text-mk-label font-extrabold uppercase tracking-[0.08em] text-teal">
                  From Chapter 3 · Dynamics
                </p>
                <h3 className="mt-1.5 font-display text-[20px] text-ink">Newton’s second law of motion</h3>
                <p className="mt-2 text-mk-body text-ink">
                  When a net force acts on a body it produces acceleration in the direction of the force. The
                  acceleration is directly proportional to the force and inversely proportional to the mass.
                </p>
                <div className="mt-3 rounded-[14px] bg-gradient-to-br from-tealtint to-tealtint2 px-4 py-3 text-center">
                  <span className="font-display text-[24px] tracking-wide text-ink">F = m a</span>
                  <p className="text-[13px] text-ink2">force = mass × acceleration</p>
                </div>
                {/* Roman Urdu, the way students actually write it in their notes. */}
                <p className="mt-3 text-mk-body text-ink2">
                  Jab kisi jism par net force lagti hai to us force ki simt mein acceleration paida hoti hai.
                </p>
              </Card>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------ confidence */}
        <section className="relative isolate overflow-hidden bg-night">
          <div className="aurora">
            <span />
            <span />
          </div>
          <div className="scroll-arc arc-dark absolute -left-[26rem] top-[-14rem] h-[48rem] w-[48rem]" aria-hidden />

          <Reveal stagger className="relative mx-auto grid max-w-[1100px] items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
            <div>
              <Pill tone="orange">The part other apps skip</Pill>
              <h2 className="mt-4 font-display text-mk-h2 text-white">
                It tracks how sure you were, not just what you got right.
              </h2>
              <p className="mt-4 text-mk-lead text-tealtint">
                Every answer carries a confidence tag. Over a few hundred questions that turns into something a score
                can’t tell you: the difference between a topic you’ve genuinely learned, one you’re guessing well at,
                and one you’re confidently wrong about, which is the kind that ruins a paper.
              </p>
              <p className="mt-3 text-mk-lead text-tealtint">
                Confidently wrong answers get flagged first, because they’re the ones you’d never revise on your own.
              </p>
            </div>

            <Tilt max={6}>
              <Card className="shadow-[0_24px_70px_rgba(4,34,47,0.5)]">
                <p className="text-mk-label font-extrabold uppercase tracking-[0.08em] text-orangedark">
                  How sure vs how right
                </p>
                <p className="mt-2 text-mk-body text-ink2">
                  Every question ends with the same three buttons, and you press one before you find out whether you
                  were right.
                </p>
                <div className="mt-4 flex flex-col gap-2.5">
                  {CONFIDENCE_TAGS.map((c) => (
                    <div key={c.label} className="flex items-start gap-3 rounded-[13px] border border-line px-3 py-2.5">
                      <span className="shrink-0">
                        <Pill tone={c.tone}>{c.label}</Pill>
                      </span>
                      <span className="min-w-0 flex-1 text-[13.5px] leading-[1.55] text-ink2">{c.body}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-mk-small text-ink2">
                  Practise for a couple of weeks and this panel fills with your own figures: how often “certain”
                  actually meant right, and which topics you keep getting confidently wrong. It stays empty until then,
                  because the only numbers worth showing you are yours.
                </p>
              </Card>
            </Tilt>
          </Reveal>
        </section>

        {/* ---------------------------------------------------------- papers */}
        <section id="papers" className="relative mx-auto max-w-[1100px] scroll-mt-20 overflow-hidden px-5 py-16 md:py-20">
          <div className="scroll-arc absolute -left-[32rem] bottom-[2rem] hidden h-[42rem] w-[42rem] md:block" aria-hidden />
          <div className="relative grid gap-10 md:grid-cols-[1fr_1fr]">
            <Reveal>
              <h2 className="font-display text-mk-h2 text-ink">
                Real board papers, in the board’s own shape.
              </h2>
              <p className="mt-4 text-mk-lead text-ink2">
                Section A objective, Section B short answers, Section C detailed, with the marks distribution the
                examiner actually uses. Read a paper, or sit it under a timer with a question palette and flagging.
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {['The board’s own SSC-I papers from 2023, 2024 and 2025', 'Attempt as a timed test with double XP', 'Answers reviewed question by question', 'Offline reading arrives with the Android app'].map((li) => (
                  <li key={li} className="flex items-center gap-2.5 text-[15.5px] text-ink">
                    <Icon name="check" size={18} className="text-green" strokeWidth={2.6} />
                    {li}
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* Ours, not the board's. The board publishes scans with no text
                layer, so a real paper can only be linked, never typeset inline.
                This one is written to the same pattern and says so, because a
                board masthead over our own questions would be a forgery. */}
            <Reveal>
              <Tilt max={5}>
                <Card>
                  <p className="text-center">
                    <Pill tone="teal">Sample paper</Pill>
                  </p>
                  <p className="mt-2 text-center font-display text-[16px] text-ink">Physics · SSC-I pattern</p>
                  <p className="mt-1 text-center text-mk-label font-extrabold uppercase tracking-[0.08em] text-ink2">
                    65 marks · three sections
                  </p>
                  <div className="my-4 border-t border-line" />
                  {physicsPaper.slice(0, 2).map((sec) => (
                    <div key={sec.heading} className="mb-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[14px] font-extrabold text-ink">{sec.heading}</p>
                        {sec.marks ? <span className="text-[12px] font-extrabold text-ink3">{sec.marks}</span> : null}
                      </div>
                      <div className="mt-1.5 flex flex-col gap-1">
                        {sec.lines.slice(0, 4).map((line, i) => (
                          <p key={line} className={`text-[13.5px] leading-[1.65] ${i === 0 ? 'text-ink' : 'text-ink2'}`}>
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[13px] text-ink3">…continues to Section C</p>
                  <p className="mt-2 text-[12.5px] leading-[1.55] text-ink3">
                    Written by us so you can see the shape of it. The board’s own papers open as the original FBISE
                    PDFs.
                  </p>
                </Card>
              </Tilt>
            </Reveal>
          </div>
        </section>

        {/* --------------------------------------------------------- parents */}
        <section id="parents" className="scroll-mt-20 border-y border-tealtint2 bg-tealtint">
          <Reveal stagger className="mx-auto grid max-w-[1100px] items-center gap-10 px-5 py-16 md:grid-cols-[1fr_380px] md:py-20">
            <div>
              {/* A label, not a badge, a pill's padding would indent it off the heading's edge. */}
              <p className="text-mk-label font-extrabold uppercase tracking-[0.09em] text-teal">For parents</p>
              <h2 className="mt-2 font-display text-mk-h2 text-ink">
                You’ll actually know whether it’s working.
              </h2>
              <p className="mt-4 text-mk-lead text-ink2">
                At the end of every month your child can share a report card: a grade per subject, how it moved,
                how many days they actually studied, and which topics still need work. No login needed to view it:
                it arrives on WhatsApp like any other message.
              </p>
              <p className="mt-3 text-mk-lead text-ink2">
                One price, no upsells inside the app, and nothing your child can buy on their own.
              </p>
            </div>

            {/* Said twice, in the header and under the rows: this is a layout,
                not a student. Nobody has finished a month on MatricMate yet, so
                any grade here is drawn, and it should never be mistaken for a
                report a parent has been sent. */}
            <Tilt max={6}>
              <Card className="border-2 border-teal">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Image src="/brand/wordmark.png" alt="" width={110} height={22} />
                    <p className="mt-1.5 text-mk-label font-extrabold uppercase tracking-[0.08em] text-ink2">
                      Monthly report · sample
                    </p>
                  </div>
                  <span className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-orangetint font-display text-[24px] text-orangedark">
                    A−
                  </span>
                </div>
                <div className="mt-4">
                  {(
                    [
                      ['Physics', 'A', 'up'],
                      ['Chemistry', 'B+', 'up'],
                      ['Biology', 'B', 'steady'],
                      ['Mathematics', 'A−', 'up'],
                    ] as const
                  ).map(([subject, grade, trend]) => (
                    // Fixed tracks, so grades sit in a column instead of drifting
                    // with the length of the subject name.
                    <div
                      key={subject}
                      className="grid grid-cols-[1fr_44px_20px] items-center border-b border-line py-2 last:border-0"
                    >
                      <span className="text-[15px] text-ink">{subject}</span>
                      <span className="text-right font-display text-[16px] text-ink tabular">{grade}</span>
                      <span className="flex justify-end">
                        <Icon
                          name={trend === 'up' ? 'chart' : 'arrowRight'}
                          size={15}
                          strokeWidth={2.4}
                          className={trend === 'up' ? 'text-green' : 'text-ink3'}
                        />
                        <span className="sr-only">{trend === 'up' ? 'improved' : 'steady'}</span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[12.5px] leading-[1.55] text-ink3">
                  <span className="font-extrabold text-ink2">A sample layout.</span> The real one carries your child’s
                  own subjects and grades, the days they studied, the tests they sat, and the topics still costing
                  marks.
                </p>
              </Card>
            </Tilt>
          </Reveal>
        </section>

        {/* --------------------------------------------------------- pricing */}
        <section id="pricing" className="mx-auto max-w-[1100px] scroll-mt-20 px-5 py-16 md:py-20">
          <Reveal className="text-center">
            <h2 className="font-display text-mk-h2 text-ink">One plan. Everything in it.</h2>
            <p className="mx-auto mt-3 max-w-[560px] text-mk-lead text-ink2">
              No tiers, no per-subject charges, no surprise upgrades. Less than one hour of tuition a month.
            </p>
          </Reveal>

          <Reveal className="mx-auto mt-10 max-w-[560px]">
            <Tilt max={4}>
              <Card className="relative flex h-full flex-col border-2 border-orange shadow-[0_18px_50px_rgba(255,138,0,0.16)]">
                <p className="text-mk-label font-extrabold uppercase tracking-[0.08em] text-orangedark">Premium</p>
                <p className="mt-1 font-display text-[52px] leading-none text-ink">
                  Rs 1,000
                  <span className="ml-1 text-[16px] font-normal text-ink2">/ month</span>
                </p>
                <p className="text-mk-small text-ink2">One payment · nothing renews on its own</p>
                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {[
                    'Every chapter, note and audio lesson',
                    'Unlimited MCQs, tests and past papers',
                    `AI tutor: ${AI_QUOTA.premium} questions a day`,
                    'Weak topics and monthly report card',
                    'Offline downloads in the Android app, coming to Play',
                    'Website now, Android app next, one account',
                  ].map((li) => (
                    <li key={li} className="flex items-start gap-2.5 text-mk-body text-ink">
                      <Icon name="check" size={17} className="mt-0.5 shrink-0 text-green" strokeWidth={2.6} />
                      {li}
                    </li>
                  ))}
                </ul>
                <span className="pulse-glow mt-6 rounded-[16px]">
                  <LinkBtn title="Subscribe now" href="/checkout" variant="orange" className="w-full" />
                </span>
                <p className="mt-3 text-center text-[13px] text-ink2">JazzCash · Easypaisa · Debit or credit card</p>
                <Link href="/pricing" className="mt-2 text-center text-[13.5px] font-extrabold text-teal hover:underline">
                  What the plan includes
                </Link>
              </Card>
            </Tilt>

            <p className="mt-6 text-center text-mk-small text-ink2">
              Making an account shows you the full syllabus and what every chapter contains. Studying needs the
              plan, which opens all of it at once.
            </p>
          </Reveal>
        </section>

        {/* ------------------------------------------------------------- faq */}
        <section id="faq" className="border-t border-tealtint2 bg-tealtint">
          <div className="mx-auto max-w-[760px] scroll-mt-20 px-5 py-16 md:py-20">
            <Reveal>
              <h2 className="font-display text-mk-h2 text-ink">Questions parents and students ask</h2>
            </Reveal>
            <Reveal stagger className="mt-9 flex flex-col gap-3">
              {FAQ.map((f) => (
                <details key={f.q} className="group rounded-[16px] border border-line bg-card px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-extrabold text-ink">
                    {f.q}
                    <Icon name="plus" size={18} className="shrink-0 text-ink3 transition-transform duration-200 group-open:rotate-45" />
                  </summary>
                  <p className="faq-a mt-3 text-mk-body text-ink2">{f.a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        {/* -------------------------------------------------------- final CTA */}
        <section className="mx-auto max-w-[1100px] px-5 py-20 md:py-24">
          <Reveal>
            <div className="relative isolate overflow-hidden rounded-[28px] bg-night px-6 py-16 text-center md:py-20">
              <div className="aurora">
                <span />
                <span />
                <span />
              </div>
              <div className="scroll-arc arc-dark absolute -right-[16rem] -top-[18rem] h-[36rem] w-[36rem]" aria-hidden />
              <h2 className="relative mx-auto max-w-[680px] font-display text-mk-h1 text-white">
                The exam is a date. Start before it’s a deadline.
              </h2>
              <p className="relative mx-auto mt-4 max-w-[520px] text-mk-lead text-tealtint">
                Rs 1,000 a month, and nothing renews on its own. Set up in two minutes and study your first chapter
                tonight.
              </p>
              <div className="relative mt-8 flex flex-wrap justify-center gap-3">
                <span className="pulse-glow rounded-[16px]">
                  <LinkBtn title="Get started" href="/signup" variant="orange" lg />
                </span>
                <Link
                  href="/login"
                  className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[16px] border-[1.5px] border-white/25 px-7 py-4 font-display text-[18px] text-white transition-[background-color,border-color,transform] duration-200 ease-out hover:border-white/60 hover:bg-white/10 active:scale-[0.98]"
                >
                  I already have an account
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter home />
    </>
  );
}
