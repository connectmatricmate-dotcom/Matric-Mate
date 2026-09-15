import { Suspense } from 'react';
import { Panel, Row, Stat, StatGrid, Table, Tag, Td, rupees } from '@/components/admin/bits';
import { Skeleton } from '@/components/ui/primitives';
import { tierOf } from '@matricmate/core';
import { PlanToggle } from '@/components/admin/PlanToggle';
import { allStudents, schoolCounts } from '@/lib/students';
import { requireAdmin } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }) : '';

/**
 * Everybody who signed up, and one button each.
 *
 * The button is the page. Until the gateway can take a payment, this is how a
 * student actually gets Premium: they pay Adnan by transfer or in the office,
 * he finds them here and switches it on. The label carries the state, so the
 * right-hand edge of the table reads as the paying list.
 */
async function StudentTable() {
  const rows = await allStudents();
  const tierOfRow = (r: (typeof rows)[number]) => (r.active ? tierOf(r.plan) : null);
  // Paid plans only: a free trial is not a paying student.
  const paying = rows.filter((r) => r.active && tierOf(r.plan) !== 'trial').length;
  const trials = rows.filter((r) => r.active && tierOf(r.plan) === 'trial').length;
  const collected = rows.reduce((n, r) => n + r.paidTotal, 0);

  return (
    <>
      <StatGrid>
        <Stat value={rows.length.toLocaleString('en-PK')} label="Students signed up" />
        <Stat value={paying.toLocaleString('en-PK')} label="On a paid plan right now" tone="green" />
        <Stat value={trials.toLocaleString('en-PK')} label="On a free trial" tone="orange" />
        <Stat value={rupees(collected)} label="Collected from them" tone="teal" />
      </StatGrid>

      <Panel title="Students">
        {rows.length ? (
          <Table head={['Student', 'Class', 'Joined', 'Teacher', 'Paid', 'Plan', '']}>
            {rows.map((r) => (
              <Row key={r.id}>
                <Td>
                  <span className="block font-extrabold text-ink">{r.name}</span>
                  <span className="block text-[12px] text-ink2 wrap-anywhere">{r.email}</span>
                  {r.phone ? <span className="block text-[12px] text-ink3">{r.phone}</span> : null}
                  {r.school ? <span className="block text-[12px] text-ink3">{r.school}</span> : null}
                </Td>
                <Td num className="text-ink2">
                  {r.grade} · {r.board === 'punjab' ? 'Punjab' : 'FBISE'}
                </Td>
                <Td num className="text-ink2">{when(r.joined)}</Td>
                <Td className="text-ink2">{r.teacher ?? '·'}</Td>
                <Td num className="text-ink2">{r.paidTotal ? rupees(r.paidTotal) : '·'}</Td>
                <Td>
                  {tierOfRow(r) === 'premium' ? (
                    <Tag tone="green">Premium</Tag>
                  ) : tierOfRow(r) === 'basic' ? (
                    <Tag tone="teal">Basic</Tag>
                  ) : tierOfRow(r) === 'trial' ? (
                    <Tag tone="orange">Free trial</Tag>
                  ) : (
                    <Tag tone="grey">No plan</Tag>
                  )}
                </Td>
                <Td className="text-end">
                  <PlanToggle userId={r.id} tier={tierOfRow(r)} name={r.name} />
                </Td>
              </Row>
            ))}
          </Table>
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
        <Table head={['School', 'Students', 'Paying', 'On a trial']}>
          {schools.map((s) => (
            <Row key={s.school}>
              <Td className="font-extrabold text-ink wrap-anywhere">{s.school}</Td>
              <Td num>{s.students.toLocaleString('en-PK')}</Td>
              <Td num className="text-green">{s.paying ? s.paying.toLocaleString('en-PK') : '·'}</Td>
              <Td num className="text-orangedark">{s.trials ? s.trials.toLocaleString('en-PK') : '·'}</Td>
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

export default async function StudentsPage() {
  // Before any read: see requireAdmin for why the layout's check is not enough.
  await requireAdmin();
  return (
    <>
      <h1 className="font-display text-[26px] text-ink">Students</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink2">
        Give Premium or Basic to anybody who has paid outside the app. It is recorded as a payment, so it counts
        towards revenue and towards their teacher’s commission.
      </p>

      {/* Streamed: the heading paints immediately and the query fills in under
          it, rather than the whole route waiting on one round trip. */}
      <Suspense fallback={<TableSkeleton />}>
        <StudentTable />
      </Suspense>
      <div className="mt-7">
        <Suspense fallback={<div className="h-[160px] animate-pulse rounded-[16px] border border-line bg-card" />}>
          <SchoolsPanel />
        </Suspense>
      </div>
    </>
  );
}
