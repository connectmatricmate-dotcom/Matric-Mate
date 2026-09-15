import { Suspense } from 'react';
import { RowName, Panel, Row, Stat, StatGrid, Table, Tag, Td, ViewLink, rupees } from '@/components/admin/bits';
import { Skeleton } from '@/components/ui/primitives';
import { tierOf } from '@matricmate/core';
import { PlanToggle } from '@/components/admin/PlanToggle';
import { SearchBox } from '@/components/staff/SearchBox';
import { TapRow } from '@/components/staff/TapRow';
import { allStudents, schoolCounts, type StudentRow } from '@/lib/students';
import { requireAdmin } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }) : '';

/** Whether a date is still to come. Read per request, on the server. */
const ahead = (iso: string | null) => !!iso && Date.parse(iso) > Date.now();

/** The plan, and the date that goes with it: until when, or since when not. */
function PlanCell({ r }: { r: StudentRow }) {
  const tier = r.active ? tierOf(r.plan) : null;
  // A date still ahead with the plan not running is a plan switched off by
  // hand (admin_student_list reports expiry, not the switch).
  const revoked = !r.active && !!r.plan && ahead(r.validTill);
  const tag =
    tier === 'premium' ? (
      <Tag tone="green">Premium</Tag>
    ) : tier === 'basic' ? (
      <Tag tone="teal">Basic</Tag>
    ) : tier === 'trial' ? (
      <Tag tone="orange">Free trial</Tag>
    ) : (
      <Tag tone="grey">No plan</Tag>
    );
  const line = tier
    ? `until ${when(r.validTill ?? '')}`
    : revoked
      ? 'Switched off by you'
      : r.plan && r.validTill
        ? `${tierOf(r.plan) === 'trial' ? 'Trial ended' : 'Ended'} ${when(r.validTill)}`
        : '';
  return (
    <>
      {tag}
      {line ? <span className="mt-1 block whitespace-nowrap text-[12px] text-ink2">{line}</span> : null}
    </>
  );
}

/** Everything a search box can find a student by. */
const matches = (r: StudentRow, q: string) =>
  [r.name, r.email, r.phone ?? '', r.school ?? '', r.teacher ?? ''].some((v) => v.toLowerCase().includes(q));

/**
 * Everybody who signed up, and the buttons for their plan.
 *
 * The buttons are the page. Until the gateway can take a payment, this is how
 * a student actually gets a plan: they pay Adnan by transfer or in the office,
 * he finds them here (the search box: a name, a number, a school) and
 * switches it on. On a phone every student is a card with the buttons on it;
 * tapping the card opens the student's own page.
 */
async function StudentTable({ q }: { q: string }) {
  const all = await allStudents();
  const needle = q.trim().toLowerCase();
  const rows = needle ? all.filter((r) => matches(r, needle)) : all;
  const tierOfRow = (r: StudentRow) => (r.active ? tierOf(r.plan) : null);
  // Paid plans only: a free trial is not a paying student.
  const paying = all.filter((r) => r.active && tierOf(r.plan) !== 'trial').length;
  const trials = all.filter((r) => r.active && tierOf(r.plan) === 'trial').length;
  const collected = all.reduce((n, r) => n + r.paidTotal, 0);

  return (
    <>
      <StatGrid>
        <Stat value={all.length.toLocaleString('en-PK')} label="Students signed up" />
        <Stat value={paying.toLocaleString('en-PK')} label="On a paid plan right now" tone="green" />
        <Stat value={trials.toLocaleString('en-PK')} label="On a free trial" tone="orange" />
        <Stat value={rupees(collected)} label="Collected from them" tone="teal" />
      </StatGrid>

      <Panel title={needle ? `Students matching “${q.trim()}” (${rows.length} of ${all.length})` : 'Students'}>
        {rows.length ? (
          <Table stack head={['Student', 'Class', 'Joined', 'Teacher', 'Paid', 'Plan', '', '']}>
            {rows.map((r) => (
              <TapRow key={r.id} href={`/admin/students/${r.id}`}>
                <Td span>
                  <RowName href={`/admin/students/${r.id}`}>{r.name}</RowName>
                  <span className="block text-[12px] text-ink2 wrap-anywhere">{r.email}</span>
                  {r.phone ? <span className="block text-[12px] text-ink2">{r.phone}</span> : null}
                  {r.school ? <span className="block text-[12px] text-ink2">{r.school}</span> : null}
                </Td>
                <Td num label="Class" className="text-ink2">
                  {r.grade} · {r.board === 'punjab' ? 'Punjab' : 'FBISE'}
                </Td>
                <Td num label="Joined" className="text-ink2">
                  {when(r.joined)}
                </Td>
                <Td label="Teacher" className="text-ink2">
                  {r.teacher ?? '·'}
                </Td>
                <Td num label="Paid" className="text-ink2">
                  {r.paidTotal ? rupees(r.paidTotal) : '·'}
                </Td>
                <Td label="Plan" span>
                  <PlanCell r={r} />
                </Td>
                <Td span className="text-end">
                  <PlanToggle userId={r.id} tier={tierOfRow(r)} name={r.name} validTill={r.validTill} />
                </Td>
                <Td span className="text-end">
                  <ViewLink href={`/admin/students/${r.id}`}>View student</ViewLink>
                </Td>
              </TapRow>
            ))}
          </Table>
        ) : needle ? (
          <p className="px-4 py-6 text-[13px] text-ink2">
            Nobody matches “{q.trim()}”. Try part of their name, their email, their mobile number or their school.
          </p>
        ) : (
          <p className="px-4 py-6 text-[13px] text-ink2">
            Nobody has signed up yet. Students appear here the moment they create an account.
          </p>
        )}
      </Panel>
    </>
  );
}

/**
 * Which schools students come from, typed by them at signup or in their
 * account. The client's inventory for now; school batches come later.
 */
async function SchoolsPanel() {
  const schools = await schoolCounts();
  return (
    <Panel title={schools.length ? `Schools (${schools.length})` : 'Schools'}>
      {schools.length ? (
        <Table stack head={['School', 'Students', 'Paying', 'On a trial']}>
          {schools.map((s) => (
            <Row key={s.school}>
              <Td span className="font-extrabold text-ink wrap-anywhere">
                {s.school}
              </Td>
              <Td num label="Students">
                {s.students.toLocaleString('en-PK')}
              </Td>
              <Td num label="Paying" className="text-green">
                {s.paying ? s.paying.toLocaleString('en-PK') : '·'}
              </Td>
              <Td num label="On a trial" className="text-orangedark">
                {s.trials ? s.trials.toLocaleString('en-PK') : '·'}
              </Td>
            </Row>
          ))}
        </Table>
      ) : (
        <p className="px-4 py-6 text-[13px] text-ink2">
          No student has named a school yet. They can add it when they sign up, or later in their account.
        </p>
      )}
    </Panel>
  );
}

/** Shaped like StudentTable: four stats, then the Panel's heading and its box. */
function TableSkeleton() {
  return (
    <>
      <StatGrid>
        {['a', 'b', 'c', 'd'].map((k) => (
          <div key={k} className="h-[80px] animate-pulse rounded-[16px] border border-line bg-card" />
        ))}
      </StatGrid>
      <div className="mt-7">
        <Skeleton className="mb-2.5 h-[25px] w-24" />
        <div className="h-[320px] animate-pulse rounded-[16px] border border-line bg-card" />
      </div>
    </>
  );
}

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; deleted?: string }> }) {
  // Before any read: see requireAdmin for why the layout's check is not enough.
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? '').slice(0, 80);
  return (
    <>
      {/* Back from deleting an account (deleteStudentAction), said out loud. */}
      {params.deleted === '1' ? (
        <p role="status" className="mb-4 rounded-[12px] border border-line bg-greentint px-4 py-3 text-[13.5px] font-extrabold text-green">
          The account was deleted.
        </p>
      ) : null}
      <h1 className="font-display text-[26px] text-ink">Students</h1>
      <p className="mt-0.5 mb-4 text-[13.5px] text-ink2">
        Find the student, then press Give Premium or Give Basic once they have paid you. It is recorded as a payment,
        so it counts towards revenue and towards their teacher’s commission. Add a month renews a plan that is running.
      </p>
      <div className="mb-6">
        <SearchBox action="/admin/students" initial={q} placeholder="Name, email, mobile or school" />
      </div>

      {/* Streamed: the heading paints immediately and the query fills in under
          it, rather than the whole route waiting on one round trip. */}
      <Suspense key={q} fallback={<TableSkeleton />}>
        <StudentTable q={q} />
      </Suspense>
      {q ? null : (
        <div className="mt-7">
          <Suspense fallback={<div className="h-[160px] animate-pulse rounded-[16px] border border-line bg-card" />}>
            <SchoolsPanel />
          </Suspense>
        </div>
      )}
    </>
  );
}
