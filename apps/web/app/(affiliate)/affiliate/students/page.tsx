import { Suspense } from 'react';
import Link from 'next/link';
import { karachiDay, studyTimeLabel } from '@matricmate/core';
import { referredStudents, type StudentActivity } from '@/lib/affiliates';
import { currentAffiliate } from '@/lib/affiliate-session';
import { CellLink, Panel, PillLink, Row, Stat, StatGrid, Table, Tag, Td, rupees } from '@/components/admin/bits';
import { CopyLink } from '@/components/admin/CopyLink';
import { SITE_URL } from '@/lib/site';
import { Skeleton } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** A YYYY-MM-DD day as "14 Sep", read at noon in Karachi so it cannot slip a day. */
const shortDay = (day: string) =>
  new Date(`${day}T12:00:00+05:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' });

type Day = 'today' | 'yesterday';

/** What the student did that day, in one tag: studied beats opened beats nothing. */
function DayTag({ a }: { a: StudentActivity | null }) {
  if (!a) return <span className="text-ink3">·</span>;
  if (a.studied) return <Tag tone="green">Studied</Tag>;
  if (a.opened) return <Tag tone="teal">Opened</Tag>;
  return <Tag tone="grey">Not opened</Tag>;
}

/**
 * The teacher's own students, and what each did today.
 *
 * Their names, whether they are paying and what that is worth to the teacher,
 * and since 14 Sep 2026 (the client's call) whether each opened MatricMate on
 * the day, studied, for how long and how many questions: a teacher who sends
 * a class the link wants to see who is actually using it. A student's name
 * opens their day in full. What they asked the AI tutor stays theirs.
 */
async function Students({ day }: { day: Day }) {
  const row = await currentAffiliate();
  const date = karachiDay(day === 'yesterday' ? 1 : 0);
  const students = await referredStudents(row.userId, { activity: date });

  const opened = students.filter((s) => s.activity?.opened).length;
  const studied = students.filter((s) => s.activity?.studied).length;
  const seconds = students.reduce((n, s) => n + (s.activity?.seconds ?? 0), 0);
  const label = day === 'yesterday' ? 'yesterday' : 'today';

  return (
    <>
      <StatGrid>
        <Stat value={`${opened} of ${students.length}`} label={`Opened MatricMate ${label}`} tone="teal" />
        <Stat value={studied.toLocaleString('en-PK')} label={`Studied ${label}`} tone="green" />
        <Stat value={studyTimeLabel(seconds, 'en')} label={`Time in the app ${label}, all students`} />
      </StatGrid>

      <Panel title={students.length ? `Your students (${students.length})` : 'Your students'}>
        {students.length === 0 ? (
          <div className="px-4 py-6">
            <p className="text-[14px] font-extrabold text-ink">Nobody has joined yet.</p>
            <p className="mt-1 max-w-[520px] text-[13px] text-ink2">
              Send your link to a class group. When somebody signs up through it their name appears here, and once they
              subscribe your share starts adding up.
            </p>
            {/* The one thing to do about an empty list, right here. The QR to
                print is on Overview. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CopyLink link={`${SITE_URL}/r/${row.code}`} />
              <PillLink href="/affiliate">Print your QR code</PillLink>
            </div>
          </div>
        ) : (
          <Table head={['Student', 'Class', day === 'yesterday' ? 'Yesterday' : 'Today', 'Time', 'Questions', 'Last active', 'Status', 'Your share']}>
            {students.map((s) => (
              <Row key={s.id}>
                <Td>
                  <CellLink href={`/affiliate/students/${s.id}?day=${date}`}>{s.name}</CellLink>
                  <span className="block text-[11.5px] text-ink3 wrap-anywhere">{s.email}</span>
                  <span className="block text-[11.5px] text-ink3">Joined {when(s.joinedAt)}</span>
                </Td>
                <Td num>{s.grade ? `Class ${s.grade}` : ''}</Td>
                <Td>
                  <DayTag a={s.activity} />
                </Td>
                <Td num>{s.activity?.opened ? studyTimeLabel(s.activity.seconds, 'en') : <span className="text-ink3">·</span>}</Td>
                <Td num>{s.activity?.questions ? s.activity.questions.toLocaleString('en-PK') : <span className="text-ink3">0</span>}</Td>
                <Td num className="text-ink2">
                  {s.activity?.lastActive ? (s.activity.lastActive === karachiDay(0) ? 'Today' : shortDay(s.activity.lastActive)) : 'Never'}
                </Td>
                {/* "has paid", not "paying": anyone on a paid plan now, which is
                    what your share is worked out from. */}
                <Td>{s.paid ? <Tag tone="green">has paid</Tag> : <Tag tone="grey">not yet</Tag>}</Td>
                <Td num className="font-extrabold">
                  {s.spend ? rupees(Math.round((s.spend * row.commissionPct) / 100)) : <span className="text-ink3">Rs 0</span>}
                </Td>
              </Row>
            ))}
          </Table>
        )}
      </Panel>
    </>
  );
}

/**
 * Three stats, then the Panel's heading and a box about the height of its
 * empty state, which is what a new teacher sees.
 */
function StudentsSkeleton() {
  return (
    <>
      <StatGrid>
        {['a', 'b', 'c'].map((k) => (
          <div key={k} className="h-[80px] animate-pulse rounded-[16px] border border-line bg-card" />
        ))}
      </StatGrid>
      <div className="mt-7">
        <Skeleton className="mb-2.5 h-[25px] w-36" />
        <div className="h-[140px] animate-pulse rounded-[16px] border border-line bg-card" />
      </div>
    </>
  );
}

export default async function AffiliateStudentsPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day: raw } = await searchParams;
  const day: Day = raw === 'yesterday' ? 'yesterday' : 'today';
  const tab = (d: Day, text: string) => (
    <Link
      href={d === 'today' ? '/affiliate/students' : '/affiliate/students?day=yesterday'}
      aria-current={day === d ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-[13px] font-extrabold transition-colors duration-200 ${
        day === d ? 'bg-teal text-onbrand' : 'border border-line bg-card text-ink2 hover:border-teal hover:text-ink'
      }`}
    >
      {text}
    </Link>
  );

  return (
    <>
      <h1 className="font-display text-[26px] text-ink">Your students</h1>
      <p className="mt-0.5 mb-4 text-[13.5px] text-ink2">
        Everybody who signed up through your link: who used MatricMate, for how long, and what each one is worth to
        you. Tap a name for their whole day.
      </p>
      <div className="mb-6 flex gap-2">
        {tab('today', 'Today')}
        {tab('yesterday', 'Yesterday')}
      </div>

      <Suspense key={day} fallback={<StudentsSkeleton />}>
        <Students day={day} />
      </Suspense>
    </>
  );
}
