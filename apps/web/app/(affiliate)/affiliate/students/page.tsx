import { Suspense } from 'react';
import { referredStudents } from '@/lib/affiliates';
import { currentAffiliate } from '@/lib/affiliate-session';
import { Panel, Row, Table, Tag, Td, rupees } from '@/components/admin/bits';
import { Skeleton } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * The teacher's own students.
 *
 * Their names, whether they are paying, and what that is worth to the teacher.
 * Not their progress, chapters, results or streaks: those belong to the
 * student, and a teacher is not a parent.
 */
async function Students() {
  const row = await currentAffiliate();
  const students = await referredStudents(row.userId);

  return (
    <Panel title={students.length ? `Your students (${students.length})` : 'Your students'}>
      {students.length === 0 ? (
        <div className="px-4 py-6">
          <p className="text-[14px] font-extrabold text-ink">Nobody has joined yet.</p>
          <p className="mt-1 max-w-[520px] text-[13px] text-ink2">
            Send your link to a class group. When somebody signs up through it their name appears here, and once they
            subscribe your share starts adding up.
          </p>
        </div>
      ) : (
        <Table head={['Student', 'Class', 'Joined', 'Status', 'Your share']}>
          {students.map((s) => (
            <Row key={s.id}>
              <Td>
                {s.name}
                <span className="block text-[11.5px] text-ink3 wrap-anywhere">{s.email}</span>
              </Td>
              <Td num>{s.grade ? `Class ${s.grade}` : ''}</Td>
              <Td num>{when(s.joinedAt)}</Td>
              {/* "has paid", not "paying": anyone who has ever paid, which is
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
  );
}

/**
 * The Panel's heading and a box about the height of its empty state, which is
 * what a new teacher sees. A 320px block collapsed to half that when the
 * answer arrived.
 */
function StudentsSkeleton() {
  return (
    <div className="mt-7">
      <Skeleton className="mb-2.5 h-[25px] w-36" />
      <div className="h-[140px] animate-pulse rounded-[16px] border border-line bg-card" />
    </div>
  );
}

export default function AffiliateStudentsPage() {
  return (
    <>
      <h1 className="font-display text-[26px] text-ink">Your students</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink2">
        Everybody who signed up through your link, and what each one is worth to you.
      </p>

      <Suspense fallback={<StudentsSkeleton />}>
        <Students />
      </Suspense>
    </>
  );
}
