import { Suspense } from 'react';
import Link from 'next/link';
import { JOBS, adminStats, dailyStats, jobHealth, newReportCount, serviceAlerts, type JobState, type ServiceAlert } from '@/lib/admin-stats';
import { requireAdmin } from '@/lib/roles';
import { TrendChart } from '@/components/admin/TrendChart';
import { Panel, Stat, StatGrid, Tag, rupees } from '@/components/admin/bits';
import { Icon, Skeleton } from '@/components/ui/primitives';

/** An instant in Karachi, as Adnan reads a time: "15 Sep, 11:47 pm". */
const at = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' });

/**
 * The admin overview. Five questions, answered, and anything that has broken.
 *
 * Not cached. Adnan opens this to find out what is true right now, and a
 * dashboard that quietly shows him this morning's numbers is worse than one
 * that takes an extra second. Streamed, so the heading is there at once and
 * the figures, the charts and the jobs each arrive as they are counted.
 */
export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  // Before any read: see requireAdmin for why the layout's check is not enough.
  await requireAdmin();

  return (
    <>
      <h1 className="font-display text-[26px] text-ink">Overview</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink2">Everything on this page is live.</p>

      {/* Nothing while it loads: most days there is nothing to say. */}
      <Suspense fallback={null}>
        <Alerts />
      </Suspense>

      <Suspense fallback={<ReportsSkeleton />}>
        <Reports />
      </Suspense>

      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>

      {/* These two panels were a heading, a button and a sentence that
          repeated the sidebar. Nobody navigates from a paragraph when the same
          link sits two inches to the left, so the space now carries the one
          thing the overview could not say: which way the numbers are going. */}
      <Suspense fallback={<ChartSkeleton />}>
        <Charts />
      </Suspense>

      <Suspense fallback={<JobsSkeleton />}>
        <Jobs />
      </Suspense>
    </>
  );
}

/** What an outside-service problem means, and the one thing to do about it. */
function alertWords(a: ServiceAlert): { title: string; body: React.ReactNode } {
  const seen = `Seen ${a.count === 1 ? 'once' : `${a.count} times`} since ${at(a.firstAt)}, last at ${at(a.lastAt)}.`;
  if (a.kind === 'anthropic_billing') {
    return {
      title: 'The AI stopped working',
      body: (
        <>
          The Anthropic account is out of credit or its billing failed, so students’ AI questions are failing. Top it up
          at{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="font-extrabold text-red underline">
            console.anthropic.com
          </a>
          . {seen}
        </>
      ),
    };
  }
  return { title: `A service needs a look: ${a.kind.replace(/_/g, ' ')}`, body: `${a.detail ? `${a.detail}. ` : ''}${seen}` };
}

/**
 * A red banner for anything an outside service is refusing that only the
 * admin can fix (service_alerts, migration 0066). When the Anthropic credit
 * ran out on 11 Sep every AI screen said "try again" and this page said
 * nothing; now it says what broke and where to fix it.
 */
async function Alerts() {
  const alerts = await serviceAlerts();
  if (!alerts.length) return null;
  return (
    <div className="mb-6 flex flex-col gap-3">
      {alerts.map((a) => {
        const w = alertWords(a);
        return (
          <div key={a.kind} role="alert" className="flex items-start gap-3 rounded-[16px] border border-red bg-redtint px-4 py-3.5">
            <Icon name="alert" size={20} className="mt-0.5 shrink-0 text-red" />
            <div className="min-w-0">
              <p className="text-[14px] font-extrabold text-red">{w.title}</p>
              <p className="mt-0.5 text-[13px] leading-[1.6] text-ink wrap-anywhere">{w.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The way in to reported AI answers: the one list on this page that asks
 * Adnan to do something. It was a tab, and a sixth tab squeezed every label
 * in a phone's bottom bar. The whole card is the button; it turns orange
 * while anything is waiting to be read.
 */
async function Reports() {
  const n = await newReportCount();
  const waiting = !!n;
  return (
    <Link
      href="/admin/reports"
      className={`mb-6 flex min-h-[68px] items-center gap-3 rounded-[16px] border px-4 py-3 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
        waiting ? 'border-orange bg-orangetint hover:bg-card' : 'border-line bg-card hover:border-teal'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${waiting ? 'bg-orange text-white' : 'bg-grey text-ink2'}`}
      >
        <Icon name="alert" size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-extrabold text-ink">Reported AI answers</span>
        <span className={`block text-[13px] ${waiting ? 'font-extrabold text-orangedark' : 'text-ink2'}`}>
          {n === null
            ? 'Answers students flagged as wrong or unsuitable'
            : n === 0
              ? 'Nothing new to read'
              : `${n} new ${n === 1 ? 'report' : 'reports'} to read`}
        </span>
      </span>
      <Icon name="chevron" size={18} className="shrink-0 text-ink3" />
    </Link>
  );
}

function ReportsSkeleton() {
  return <div className="mb-6 h-[68px] animate-pulse rounded-[16px] border border-line bg-card" />;
}

/** How each automation's state reads: a word and a colour Adnan can take in at a glance. */
const JOB_TAG: Record<JobState, { tone: 'green' | 'grey' | 'orange' | 'red'; label: string }> = {
  working: { tone: 'green', label: 'Working' },
  waiting: { tone: 'grey', label: 'Starting' },
  retrying: { tone: 'orange', label: 'Trying again' },
  down: { tone: 'red', label: 'Not working' },
  unknown: { tone: 'grey', label: 'Checking' },
};

/**
 * The automations: the daily tip, the evening reminder, the plan reminders,
 * the welcome and the coach, each with its last run and what it did. A job
 * that sends nothing looks exactly like a quiet day from inside the app; this
 * is where the difference shows, in words that do not alarm anyone over a
 * phone that was switched off.
 */
async function Jobs() {
  const jobs = await jobHealth();
  const down = jobs.some((j) => j.state === 'down');
  return (
    <Panel title="Automations">
      <p className="border-b border-line px-4 py-3 text-[13px] leading-[1.6] text-ink2">
        Messages and reports the app sends by itself.{' '}
        {down
          ? 'One of them is not working: please tell your developer.'
          : 'Green means the last run worked. Nothing here needs you.'}
      </p>
      <ul>
        {jobs.map((j) => (
          <li key={j.job} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 border-b border-line px-4 py-3 last:border-b-0">
            <div className="min-w-0">
              <p className="text-[13.5px] font-extrabold text-ink">{j.name}</p>
              <p className="text-[12px] text-ink2">
                Runs {j.when}
                {j.at ? ` · last ${at(j.at)}` : ''}
              </p>
            </div>
            <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
              <Tag tone={JOB_TAG[j.state].tone}>{JOB_TAG[j.state].label}</Tag>
              <p className="text-[12.5px] text-ink2 sm:text-end">{j.said}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function JobsSkeleton() {
  return (
    <div className="mt-7">
      <Skeleton className="mb-2.5 h-[25px] w-36" />
      <div className="animate-pulse rounded-[16px] border border-line bg-card" style={{ height: JOBS.length * 64 }} />
    </div>
  );
}

async function Stats() {
  const s = await adminStats();
  const conversion = s.students ? Math.round((s.paidStudents / s.students) * 100) : 0;
  const referredConversion = s.referredStudents ? Math.round((s.referredPaid / s.referredStudents) * 100) : 0;

  return (
    <>
      <StatGrid>
        <Stat value={s.students.toLocaleString('en-PK')} label="Students" />
        <Stat value={s.paidStudents.toLocaleString('en-PK')} label={`Paying · ${conversion}% of students`} tone="green" />
        <Stat value={rupees(s.revenue)} label="Collected, all time" tone="teal" />
        <Stat value={rupees(s.revenueThisMonth)} label="Collected this month" tone="teal" />
      </StatGrid>

      <div className="mt-3">
        <StatGrid>
          <Stat value={s.activeToday.toLocaleString('en-PK')} label="Studied today" tone="orange" />
          <Stat value={s.activeThisWeek.toLocaleString('en-PK')} label="Studied this week" tone="orange" />
          <Stat value={s.teachers.toLocaleString('en-PK')} label="Teachers on the programme" />
          <Stat
            value={s.referredStudents.toLocaleString('en-PK')}
            label={
              s.referredStudents
                ? `Joined through a teacher · ${s.referredPaid} paying, ${referredConversion}%`
                : 'Joined through a teacher'
            }
          />
          {/* Students can delete their own account (Settings, in either app).
              Who is gone is not kept; that it happens is. */}
          <Stat value={s.deletedThisMonth.toLocaleString('en-PK')} label="Accounts deleted this month" />
        </StatGrid>
      </div>
    </>
  );
}

async function Charts() {
  const days = await dailyStats(14);

  return (
    // Three across from lg. At md the sidebar is showing, and a third of what
    // is left gave each chart about 148px.
    <div className="mt-7 grid gap-3 lg:grid-cols-3">
      <TrendChart title="Signups · 14 days" points={days.map((d) => ({ day: d.day, value: d.signups }))} />
      <TrendChart
        title="Collected · 14 days"
        points={days.map((d) => ({ day: d.day, value: d.revenue }))}
        tone="green"
        money
      />
      <TrendChart
        title="Studied · 14 days"
        points={days.map((d) => ({ day: d.day, value: d.studied }))}
        tone="orange"
      />
    </div>
  );
}

/** Two rows of stats, four and five, the height of a Stat card. */
function StatsSkeleton() {
  const card = (k: string) => <div key={k} className="h-[80px] animate-pulse rounded-[16px] border border-line bg-card" />;
  return (
    <>
      <StatGrid>{['a', 'b', 'c', 'd'].map(card)}</StatGrid>
      <div className="mt-3">
        <StatGrid>{['e', 'f', 'g', 'h', 'i'].map(card)}</StatGrid>
      </div>
    </>
  );
}

/** The height of a TrendChart with its best-day line, so nothing moves when the numbers land. */
function ChartSkeleton() {
  return (
    <div className="mt-7 grid gap-3 lg:grid-cols-3">
      {['a', 'b', 'c'].map((k) => (
        <div key={k} className="h-[212px] animate-pulse rounded-[16px] border border-line bg-card" />
      ))}
    </div>
  );
}
