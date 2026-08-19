import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { affiliateByUserId, payouts, referredStudents, totalsFor } from '@/lib/affiliates';
import { SITE_URL } from '@/lib/site';
import { Panel, Row, Stat, StatGrid, Table, Tag, Td, rupees } from '@/components/admin/bits';
import { ShareLink } from '@/components/affiliate/ShareLink';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * What a teacher sees.
 *
 * Their own students, by name, and their own money. This is the whole point of
 * the programme: somebody who cannot see what they earned will not believe
 * they earned it, and will not send the next student.
 *
 * They see what their students paid us and their share of it. Not the
 * students' progress, chapters, results or streaks: those belong to the
 * student, and a teacher is not a parent.
 */
export default async function AffiliateDashboard() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const row = await affiliateByUserId(auth.user.id);
  // An administrator reaching this page has no affiliate row of their own.
  if (!row) notFound();

  const [totals, students, history] = await Promise.all([
    totalsFor(row.userId, row.commissionPct),
    referredStudents(row.userId),
    payouts(row.userId),
  ]);

  return (
    <>
      <h1 className="font-display text-[26px] text-ink">Hello, {row.fullName.split(' ')[0]}</h1>
      <p className="mt-0.5 mb-5 text-[13.5px] text-ink2">
        You earn {row.commissionPct}% of everything your students pay, for as long as they keep paying.
      </p>

      {row.active ? null : (
        <div className="mb-5 rounded-[14px] border border-orange bg-orangetint px-4 py-3">
          <p className="text-[13px] font-extrabold text-orangedark">Your link is switched off at the moment.</p>
          <p className="mt-0.5 text-[12.5px] text-ink2">
            Students who already joined still count, and anything you have earned is unaffected. Get in touch to turn it
            back on.
          </p>
        </div>
      )}

      <ShareLink link={`${SITE_URL}/r/${row.code}`} code={row.code} name={row.fullName} />

      <div className="mt-4">
        <StatGrid>
          <Stat value={String(totals.students)} label="Students joined" />
          <Stat value={String(totals.paidStudents)} label="Of those, paying" tone="green" />
          <Stat value={rupees(totals.earned)} label="Earned in total" tone="teal" />
          <Stat
            value={rupees(Math.max(0, totals.outstanding))}
            label={totals.outstanding > 0 ? 'Due to you' : 'All paid up'}
            tone="orange"
          />
        </StatGrid>
      </div>

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
                  <span className="block text-[11.5px] text-ink3">{s.email}</span>
                </Td>
                <Td>{s.grade ? `Class ${s.grade}` : ''}</Td>
                <Td>{when(s.joinedAt)}</Td>
                <Td>{s.paid ? <Tag tone="green">paying</Tag> : <Tag tone="grey">not yet</Tag>}</Td>
                <Td className="font-extrabold">
                  {s.spend ? rupees(Math.round((s.spend * row.commissionPct) / 100)) : <span className="text-ink3">Rs 0</span>}
                </Td>
              </Row>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Payments to you">
        {history.length === 0 ? (
          <p className="px-4 py-5 text-[13.5px] text-ink2">
            Nothing paid out yet. Every transfer will be listed here with its date.
          </p>
        ) : (
          <Table head={['Date', 'Amount', 'Note']}>
            {history.map((p) => (
              <Row key={p.id}>
                <Td>{when(p.at)}</Td>
                <Td className="font-extrabold">{rupees(p.amount)}</Td>
                <Td>{p.note ?? ''}</Td>
              </Row>
            ))}
          </Table>
        )}
      </Panel>

      <p className="mt-6 text-[12px] text-ink3">
        Earnings are worked out from payments that actually went through, and a refunded payment comes back off. If a
        number here looks wrong, say so and it can be checked against the payment records.
      </p>
    </>
  );
}
