import Link from 'next/link';
import { adminStats } from '@/lib/admin-stats';
import { Panel, Stat, StatGrid, rupees } from '@/components/admin/bits';

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

      <Panel
        title="Teachers"
        action={
          <Link
            href="/admin/teachers/new"
            className="rounded-full bg-teal px-4 py-2 text-[13px] font-extrabold text-onbrand transition-[filter] duration-200 hover:brightness-110"
          >
            Add a teacher
          </Link>
        }
      >
        <p className="px-4 py-4 text-[13px] text-ink2">
          {s.teachers
            ? 'Open Teachers to see each one’s students, commission and what they are owed.'
            : 'No teachers yet. Add one and the system will mint their referral link.'}
        </p>
      </Panel>
    </>
  );
}
