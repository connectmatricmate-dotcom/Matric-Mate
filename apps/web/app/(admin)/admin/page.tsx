import { Suspense } from 'react';
import { adminStats, dailyStats } from '@/lib/admin-stats';
import { TrendChart } from '@/components/admin/TrendChart';
import { Stat, StatGrid, rupees } from '@/components/admin/bits';

/**
 * The admin overview. Five questions, answered.
 *
 * Not cached. Adnan opens this to find out what is true right now, and a
 * dashboard that quietly shows him this morning's numbers is worse than one
 * that takes an extra second.
 */
export const dynamic = 'force-dynamic';

export default async function AdminOverview() {
  const s = await adminStats();
  const conversion = s.students ? Math.round((s.paidStudents / s.students) * 100) : 0;
  const referredConversion = s.referredStudents ? Math.round((s.referredPaid / s.referredStudents) * 100) : 0;

  return (
    <>
      <h1 className="font-display text-[26px] text-ink">Overview</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink2">Everything on this page is live.</p>

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
        </StatGrid>
      </div>

      {/* These two panels were a heading, a button and a sentence that
          repeated the sidebar. Nobody navigates from a paragraph when the same
          link sits two inches to the left, so the space now carries the one
          thing the overview could not say: which way the numbers are going. */}
      <Suspense fallback={<ChartSkeleton />}>
        <Charts />
      </Suspense>

    </>
  );
}

async function Charts() {
  const days = await dailyStats(14);

  return (
    <div className="mt-7 grid gap-3 md:grid-cols-3">
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

function ChartSkeleton() {
  return (
    <div className="mt-7 grid gap-3 md:grid-cols-3">
      {['a', 'b', 'c'].map((k) => (
        <div key={k} className="h-[176px] animate-pulse rounded-[16px] border border-line bg-card" />
      ))}
    </div>
  );
}
