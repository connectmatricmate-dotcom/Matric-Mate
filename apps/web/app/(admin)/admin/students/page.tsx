import { Suspense } from 'react';
import { Panel, Row, Stat, StatGrid, Table, Tag, Td, rupees } from '@/components/admin/bits';
import { PlanToggle } from '@/components/admin/PlanToggle';
import { allStudents } from '@/lib/students';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

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
  const paying = rows.filter((r) => r.active).length;
  const collected = rows.reduce((n, r) => n + r.paidTotal, 0);

  return (
    <>
      <StatGrid>
        <Stat value={rows.length.toLocaleString('en-PK')} label="Students signed up" />
        <Stat value={paying.toLocaleString('en-PK')} label="On Premium right now" tone="green" />
        <Stat value={rupees(collected)} label="Collected from them" tone="teal" />
      </StatGrid>

      <Panel title="Students">
        {rows.length ? (
          <Table head={['Student', 'Class', 'Joined', 'Teacher', 'Paid', 'Plan', '']}>
            {rows.map((r) => (
              <Row key={r.id}>
                <Td>
                  <span className="block font-extrabold text-ink">{r.name}</span>
                  <span className="block text-[12px] text-ink2">{r.email}</span>
                  {r.phone ? <span className="block text-[12px] text-ink3">{r.phone}</span> : null}
                </Td>
                <Td className="whitespace-nowrap text-ink2">
                  {r.grade} · {r.board === 'punjab' ? 'Punjab' : 'FBISE'}
                </Td>
                <Td className="whitespace-nowrap text-ink2">{when(r.joined)}</Td>
                <Td className="text-ink2">{r.teacher ?? '·'}</Td>
                <Td className="whitespace-nowrap text-ink2">{r.paidTotal ? rupees(r.paidTotal) : '·'}</Td>
                <Td>{r.active ? <Tag tone="green">Premium</Tag> : <Tag tone="grey">No plan</Tag>}</Td>
                <Td className="text-end">
                  <PlanToggle userId={r.id} active={r.active} />
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

function TableSkeleton() {
  return (
    <>
      <StatGrid>
        {['a', 'b', 'c'].map((k) => (
          <div key={k} className="h-[86px] animate-pulse rounded-[16px] border border-line bg-card" />
        ))}
      </StatGrid>
      <div className="mt-7 h-[320px] animate-pulse rounded-[16px] border border-line bg-card" />
    </>
  );
}

export default function StudentsPage() {
  return (
    <>
      <h1 className="font-display text-[26px] text-ink">Students</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink2">
        Give Premium to anybody who has paid outside the app. It is recorded as a payment, so it counts towards
        revenue and towards their teacher’s commission.
      </p>

      {/* Streamed: the heading paints immediately and the query fills in under
          it, rather than the whole route waiting on one round trip. */}
      <Suspense fallback={<TableSkeleton />}>
        <StudentTable />
      </Suspense>
    </>
  );
}
