import Image from 'next/image';
import Link from 'next/link';
import { PAPER_CONTENT, contentFor } from '@matricmate/core';
import { AudioSample } from '@/components/landing/AudioSample';
import { HeroDemo } from '@/components/landing/HeroDemo';
import { Nav } from '@/components/landing/Nav';
import { Btn, Card, Icon, Pill, Ur } from '@/components/ui';
import type { IconName } from '@matricmate/core';

/** Everything on this page is real product content, not marketing mock-ups. */
const dynamics = contentFor('phy-3');
const heroMcq = dynamics.mcqs.find((m) => m.topic === 'Circular motion') ?? dynamics.mcqs[0];
const physicsPaper = PAPER_CONTENT.pp1;

const PAINS = [
  {
    emoji: '📖',
    title: 'Parh liya, phir bhool gaya',
    body: 'Reading a chapter twice feels like studying. Then the test asks something slightly different and it’s gone.',
  },
  {
    emoji: '❓',
    title: 'Raat ko koi poochne wala nahi',
    body: 'You get stuck at 11pm on one step of a numerical. The tutor comes on Thursday. The test is Monday.',
  },
  {
    emoji: '🎯',
    title: 'Pata hi nahi kya kamzor hai',
    body: 'You revise what already feels comfortable, because nothing tells you which topics are quietly costing you marks.',
  },
];

const STEPS = [
  { n: 1, title: 'Pick your subjects', body: 'Class 9, FBISE, English or Urdu medium. Your syllabus loads — nothing else.' },
  { n: 2, title: 'Study the chapter', body: 'Notes, worked examples and an audio lesson you can play while travelling.' },
  { n: 3, title: 'Practise honestly', body: 'MCQs, flashcards, blanks and past papers — each answer records how sure you were.' },
  { n: 4, title: 'Fix what’s weak', body: 'The app names the topics costing you marks and builds a test out of exactly those.' },
];

const INSIDE: { icon: IconName; title: string; body: string }[] = [
  { icon: 'book', title: 'Chapter-wise notes', body: 'Every chapter split into short sections with definitions, formulas and worked examples — in your medium.' },
  { icon: 'headphones', title: 'Audio lessons', body: 'Listen to the whole chapter in English or Urdu. Works offline, so it costs no data on the second listen.' },
  { icon: 'cards', title: 'Flashcards', body: 'Active recall for the definitions that show up in Section A. Cards you miss come back first.' },
  { icon: 'target', title: 'MCQs with explanations', body: 'Every question tells you why the right answer is right — that’s the part that actually teaches.' },
  { icon: 'edit', title: 'Blanks and short questions', body: 'Model answers with the marking points, so you know what earns each mark.' },
  { icon: 'clock', title: 'Timed tests', body: 'Full paper conditions with a question palette and flagging, so exam day isn’t the first time.' },
];

const FAQ = [
  {
    q: 'Which board and class does this cover?',
    a: 'FBISE Class 9 at launch, in both English and Urdu medium. Class 10 and Punjab Board follow after.',
  },
  {
    q: 'Does it work without internet?',
    a: 'Download a chapter and its notes, audio and MCQs work offline. Answers you give offline sync when you reconnect. The AI tutor and timed tests need a connection.',
  },
  {
    q: 'My child studies in Urdu medium. Is the content really in Urdu?',
    a: 'Yes — notes, questions and the audio lesson come in the medium you choose. The app’s own buttons can be set to English or Roman Urdu separately.',
  },
  {
    q: 'How do I pay from Pakistan?',
    a: 'JazzCash, EasyPaisa or any debit/credit card, through Safepay. You can also renew from a link we send on WhatsApp.',
  },
  {
    q: 'Can I use it on both phone and computer?',
    a: 'Yes. The Android app and this website share one account, so your progress follows you.',
  },
  {
    q: 'What if it doesn’t suit us?',
    a: 'The first three days are free, and there’s no lock-in — you pay month to month and can stop whenever you like.',
  },
];

export default function LandingPage() {
  return (
    <>
      <Nav />

      <main>
        {/* ---------------------------------------------------------- hero */}
        <section className="mx-auto max-w-[1100px] px-5 pt-12 pb-14 md:pt-20">
          <div className="grid items-center gap-12 md:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Pill tone="orange">FBISE Class 9 · English &amp; Urdu medium</Pill>

              <h1 className="mt-4 font-display text-[40px] leading-[1.05] text-ink md:text-[54px]">
                Know what you know
                <br />
                <span className="text-teal">before the board does.</span>
              </h1>

              <p className="mt-3 max-w-[520px] text-[16.5px] leading-[1.65] text-ink2">
                Chapter notes, audio lessons, past papers and a tutor that answers at midnight. Every question you
                practise also records how sure you were — so MatricMate can show you the topics you only{' '}
                <em>think</em> you know.
              </p>

              <p className="mt-3">
                <Ur className="text-[17px] text-ink2">پوری تیاری، ایک ہی جگہ</Ur>
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Btn title="Start 3 days free" href="/signup" variant="orange" lg />
                <Btn title="See pricing" href="#pricing" variant="line" lg />
              </div>

              <p className="mt-4 text-[13px] text-ink3">
                Rs 1,000/month after the trial · cancel any time · JazzCash, EasyPaisa or card
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <p className="self-start text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink3 md:self-center">
                Try a real question ↓
              </p>
              <HeroDemo mcq={heroMcq} />
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- trust strip */}
        <section className="border-y border-line bg-card">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-4 text-[13px] font-extrabold text-ink2">
            <span className="flex items-center gap-2">
              <Icon name="book2" size={16} className="text-teal" /> FBISE syllabus, chapter by chapter
            </span>
            <span className="flex items-center gap-2">
              <Icon name="globe" size={16} className="text-teal" /> English &amp; <Ur className="text-[13px]">اردو</Ur> medium
            </span>
            <span className="flex items-center gap-2">
              <Icon name="download" size={16} className="text-teal" /> Works offline
            </span>
            <span className="flex items-center gap-2">
              <Icon name="star" size={16} className="text-teal" /> Built in Pakistan
            </span>
          </div>
        </section>

        {/* -------------------------------------------------------- problem */}
        <section className="mx-auto max-w-[1100px] px-5 py-16">
          <h2 className="max-w-[620px] font-display text-[30px] leading-[1.15] text-ink md:text-[36px]">
            Studying harder isn’t the problem. Studying blind is.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PAINS.map((p) => (
              <Card key={p.title} flat className="h-full">
                <span className="text-[28px]">{p.emoji}</span>
                <h3 className="mt-2 font-display text-[18px] text-ink">{p.title}</h3>
                <p className="mt-1.5 text-[14px] leading-[1.6] text-ink2">{p.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section className="border-y border-line bg-card">
          <div className="mx-auto max-w-[1100px] px-5 py-16">
            <h2 className="font-display text-[30px] text-ink md:text-[36px]">How a week with MatricMate goes</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tealtint font-display text-[16px] text-teal">
                    {s.n}
                  </span>
                  <h3 className="mt-3 font-display text-[17px] text-ink">{s.title}</h3>
                  <p className="mt-1 text-[13.5px] leading-[1.6] text-ink2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* --------------------------------------------------------- inside */}
        <section id="inside" className="mx-auto max-w-[1100px] scroll-mt-20 px-5 py-16">
          <h2 className="font-display text-[30px] text-ink md:text-[36px]">What’s inside every chapter</h2>
          <p className="mt-2 max-w-[560px] text-[15px] text-ink2">
            Not a video library you never open. Each chapter is one place with everything the exam asks of it.
          </p>

          <div className="mt-8 grid gap-8 md:grid-cols-[1fr_380px]">
            <div className="grid gap-4 sm:grid-cols-2">
              {INSIDE.map((f) => (
                <Card key={f.title} flat className="h-full">
                  <Icon name={f.icon} size={22} className="text-teal" />
                  <h3 className="mt-2 font-display text-[16.5px] text-ink">{f.title}</h3>
                  <p className="mt-1 text-[13.5px] leading-[1.6] text-ink2">{f.body}</p>
                </Card>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <AudioSample />

              {/* a real slice of the chapter, not lorem */}
              <Card className="flex-1">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-teal">
                  From Chapter 3 · Dynamics
                </p>
                <h3 className="mt-1.5 font-display text-[18px] text-ink">Newton’s second law of motion</h3>
                <p className="mt-2 text-[14px] leading-[1.7] text-ink">
                  When a net force acts on a body it produces acceleration in the direction of the force. The
                  acceleration is directly proportional to the force and inversely proportional to the mass.
                </p>
                <div className="mt-3 rounded-[14px] bg-tealtint px-4 py-3 text-center">
                  <span className="font-display text-[22px] tracking-wide text-ink">F = m a</span>
                  <p className="text-[12px] text-ink2">force = mass × acceleration</p>
                </div>
                <p className="mt-3">
                  <Ur className="text-[15px] text-ink2">
                    جب کسی جسم پر خالص قوت عمل کرتی ہے تو وہ قوت کی سمت میں اسراع پیدا کرتی ہے۔
                  </Ur>
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ confidence */}
        <section className="border-y border-line bg-card">
          <div className="mx-auto grid max-w-[1100px] items-center gap-12 px-5 py-16 md:grid-cols-2">
            <div>
              <Pill tone="orange">The part other apps skip</Pill>
              <h2 className="mt-3 font-display text-[30px] leading-[1.15] text-ink md:text-[36px]">
                It tracks how sure you were, not just what you got right.
              </h2>
              <p className="mt-3 text-[15.5px] leading-[1.7] text-ink2">
                Every answer carries a confidence tag. Over a few hundred questions that turns into something a score
                can’t tell you: the difference between a topic you’ve genuinely learned, one you’re guessing well at,
                and one you’re confidently wrong about — which is the kind that ruins a paper.
              </p>
              <p className="mt-3 text-[15.5px] leading-[1.7] text-ink2">
                Confidently wrong answers get flagged first, because they’re the ones you’d never revise on your own.
              </p>
            </div>

            <Card>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-orangedark">
                How sure you were vs how right you were
              </p>
              <div className="mt-4 flex flex-col gap-4">
                {[
                  { label: 'Certain', pct: 91, bar: 'bg-green', said: '96×' },
                  { label: 'Fairly sure', pct: 68, bar: 'bg-orange', said: '74×' },
                  { label: 'Guess', pct: 39, bar: 'bg-red', said: '41×' },
                ].map((r) => (
                  <div key={r.label}>
                    <div className="flex justify-between text-[12.5px] font-extrabold text-ink">
                      <span>{r.label}</span>
                      <span className="text-ink2">
                        {r.pct}% right · said {r.said}
                      </span>
                    </div>
                    <div className="mt-1.5 h-[7px] overflow-hidden rounded-full bg-[#EAF0EC]">
                      <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[13px] leading-[1.6] text-ink2">
                “When you say you’re certain, you’re right 91% of the time — trust that. The guessing is where the
                marks are leaking.”
              </p>
            </Card>
          </div>
        </section>

        {/* ---------------------------------------------------------- papers */}
        <section id="papers" className="mx-auto max-w-[1100px] scroll-mt-20 px-5 py-16">
          <div className="grid gap-10 md:grid-cols-[1fr_1fr]">
            <div>
              <h2 className="font-display text-[30px] leading-[1.15] text-ink md:text-[36px]">
                Real board papers, in the board’s own shape.
              </h2>
              <p className="mt-3 text-[15.5px] leading-[1.7] text-ink2">
                Section A objective, Section B short answers, Section C detailed — with the marks distribution the
                examiner actually uses. Read a paper, or sit it under a timer with a question palette and flagging.
              </p>
              <ul className="mt-5 flex flex-col gap-2.5">
                {['FBISE papers from 2019 onwards', 'Attempt as a timed test with double XP', 'Answers reviewed question by question', 'Download to read offline'].map((li) => (
                  <li key={li} className="flex items-center gap-2.5 text-[14.5px] text-ink">
                    <Icon name="check" size={17} className="text-green" strokeWidth={2.6} />
                    {li}
                  </li>
                ))}
              </ul>
            </div>

            {/* a genuine excerpt, typeset the way the board prints it */}
            <Card>
              <p className="text-center font-display text-[15px] text-ink">FEDERAL BOARD SSC-I EXAMINATION</p>
              <p className="text-center text-[13px] font-extrabold text-ink">PHYSICS — 2025</p>
              <p className="mt-1 text-center text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2">
                65 marks · 2h 30m
              </p>
              <div className="my-4 border-t border-line" />
              {physicsPaper.slice(0, 2).map((sec) => (
                <div key={sec.heading} className="mb-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-extrabold text-ink">{sec.heading}</p>
                    {sec.marks ? <span className="text-[11px] font-extrabold text-ink3">{sec.marks}</span> : null}
                  </div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {sec.lines.slice(0, 4).map((line, i) => (
                      <p key={line} className={`text-[12.5px] leading-[1.65] ${i === 0 ? 'text-ink' : 'text-ink2'}`}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[12px] text-ink3">…continues to Section C</p>
            </Card>
          </div>
        </section>

        {/* --------------------------------------------------------- parents */}
        <section id="parents" className="scroll-mt-20 border-y border-line bg-tealtint">
          <div className="mx-auto grid max-w-[1100px] items-center gap-10 px-5 py-16 md:grid-cols-[1fr_360px]">
            <div>
              <Pill tone="teal">For parents</Pill>
              <h2 className="mt-3 font-display text-[30px] leading-[1.15] text-ink md:text-[36px]">
                You’ll actually know whether it’s working.
              </h2>
              <p className="mt-3 text-[15.5px] leading-[1.7] text-ink2">
                At the end of every month your child can share a report card: a grade per subject, how it moved,
                how many days they actually studied, and which topics still need work. No login needed to view it —
                it arrives on WhatsApp like any other message.
              </p>
              <p className="mt-3 text-[15.5px] leading-[1.7] text-ink2">
                One price, no upsells inside the app, and nothing your child can buy on their own.
              </p>
            </div>

            <Card className="border-2 border-teal">
              <div className="flex items-start justify-between">
                <div>
                  <Image src="/brand/wordmark.png" alt="" width={110} height={22} />
                  <p className="mt-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2">
                    Monthly report · June
                  </p>
                </div>
                <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-orangetint font-display text-[22px] text-orangedark">
                  A−
                </span>
              </div>
              <div className="mt-4">
                {[
                  ['Physics', 'A', '↑'],
                  ['Chemistry', 'B+', '↑'],
                  ['Biology', 'B', '→'],
                  ['Mathematics', 'A−', '↑'],
                ].map(([subject, grade, trend]) => (
                  <div key={subject} className="flex items-center justify-between border-b border-line py-2 last:border-0">
                    <span className="text-[13.5px] text-ink">{subject}</span>
                    <span className="font-display text-[15px] text-ink">{grade}</span>
                    <span className={`w-6 text-right text-[14px] font-extrabold ${trend === '↑' ? 'text-green' : 'text-ink3'}`}>
                      {trend}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill tone="teal">22 active days</Pill>
                <Pill tone="orange">9 tests</Pill>
              </div>
            </Card>
          </div>
        </section>

        {/* --------------------------------------------------------- pricing */}
        <section id="pricing" className="mx-auto max-w-[1100px] scroll-mt-20 px-5 py-16">
          <div className="text-center">
            <h2 className="font-display text-[30px] text-ink md:text-[36px]">One plan. Everything in it.</h2>
            <p className="mx-auto mt-2 max-w-[520px] text-[15px] text-ink2">
              No tiers, no per-subject charges, no surprise upgrades. Less than one hour of tuition a month.
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-[860px] gap-5 md:grid-cols-[1fr_1fr]">
            <Card flat className="flex h-full flex-col">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2">Free</p>
              <p className="mt-1 font-display text-[30px] text-ink">Rs 0</p>
              <p className="text-[13px] text-ink2">Keep it as long as you like</p>
              <ul className="mt-4 flex flex-1 flex-col gap-2.5">
                {['Browse every subject and chapter', 'One full chapter per subject', '5 MCQs a day', '5 AI tutor questions a day'].map((li) => (
                  <li key={li} className="flex items-start gap-2.5 text-[14px] text-ink2">
                    <Icon name="check" size={16} className="mt-0.5 shrink-0 text-ink3" strokeWidth={2.6} />
                    {li}
                  </li>
                ))}
              </ul>
              <Btn title="Start free" href="/signup" variant="line" className="mt-5 w-full" />
            </Card>

            <Card className="relative flex h-full flex-col border-2 border-orange">
              <span className="absolute -top-3 right-5">
                <Pill tone="orange">Most students pick this</Pill>
              </span>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-orangedark">Premium</p>
              <p className="mt-1 font-display text-[38px] leading-none text-ink">
                Rs 1,000
                <span className="ml-1 text-[15px] font-normal text-ink2">/ month</span>
              </p>
              <p className="text-[13px] text-ink2">First 3 days free · cancel any time</p>
              <ul className="mt-4 flex flex-1 flex-col gap-2.5">
                {[
                  'Every chapter, note and audio lesson',
                  'Unlimited MCQs, tests and past papers',
                  'AI tutor — 20 questions a day',
                  'Weak topics and monthly report card',
                  'Offline downloads',
                  'Android app and website, one account',
                ].map((li) => (
                  <li key={li} className="flex items-start gap-2.5 text-[14px] text-ink">
                    <Icon name="check" size={16} className="mt-0.5 shrink-0 text-green" strokeWidth={2.6} />
                    {li}
                  </li>
                ))}
              </ul>
              <Btn title="Start 3 days free" href="/signup" variant="orange" className="mt-5 w-full" />
              <p className="mt-3 text-center text-[12px] text-ink3">JazzCash · EasyPaisa · Debit or credit card</p>
            </Card>
          </div>
        </section>

        {/* ------------------------------------------------------------- faq */}
        <section id="faq" className="border-t border-line bg-card">
          <div className="mx-auto max-w-[760px] scroll-mt-20 px-5 py-16">
            <h2 className="font-display text-[30px] text-ink md:text-[36px]">Questions parents and students ask</h2>
            <div className="mt-8 flex flex-col gap-3">
              {FAQ.map((f) => (
                <details key={f.q} className="group rounded-[16px] border border-line bg-paper px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-extrabold text-ink">
                    {f.q}
                    <Icon name="plus" size={18} className="shrink-0 text-ink3 transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="mt-2.5 text-[14px] leading-[1.7] text-ink2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- final CTA */}
        <section className="mx-auto max-w-[1100px] px-5 py-20">
          <div className="rounded-[24px] bg-teal px-6 py-14 text-center">
            <h2 className="mx-auto max-w-[620px] font-display text-[32px] leading-[1.15] text-white md:text-[40px]">
              The exam is a date. Start before it’s a deadline.
            </h2>
            <p className="mx-auto mt-3 max-w-[480px] text-[15.5px] leading-[1.7] text-white/85">
              Three days free, then Rs 1,000 a month. Set up in two minutes and study your first chapter tonight.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Btn title="Start 3 days free" href="/signup" variant="orange" lg />
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-[16px] border-[1.5px] border-white/40 px-7 py-4 font-display text-[17px] text-white transition-colors hover:bg-white/10"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-5 py-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[300px]">
            <Image src="/brand/wordmark.png" alt="MatricMate" width={140} height={28} />
            <p className="mt-3 text-[13px] leading-[1.6] text-ink2">
              Exam preparation for FBISE Class 9, in English and Urdu medium. Built in Pakistan.
            </p>
          </div>
          <div className="flex gap-12">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink3">Product</p>
              <ul className="mt-2.5 flex flex-col gap-2 text-[13.5px] text-ink2">
                <li><a className="hover:text-teal" href="#inside">What’s inside</a></li>
                <li><a className="hover:text-teal" href="#papers">Past papers</a></li>
                <li><a className="hover:text-teal" href="#pricing">Pricing</a></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink3">Support</p>
              <ul className="mt-2.5 flex flex-col gap-2 text-[13.5px] text-ink2">
                <li><a className="hover:text-teal" href="#faq">FAQ</a></li>
                <li><span>WhatsApp · 10am–10pm</span></li>
                <li><span>help@matricmate.pk</span></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-[1100px] px-5 py-4 text-[12px] text-ink3">
            © {new Date().getFullYear()} MatricMate · Prototype build with sample content
          </p>
        </div>
      </footer>
    </>
  );
}
