import Link from 'next/link';
import { notFound } from 'next/navigation';
import { affiliateByUserId, payouts, referredStudents, totalsFor } from '@/lib/affiliates';
import { SITE_URL } from '@/lib/site';
import { Panel, Row, Stat, StatGrid, Table, Tag, Td, rupees } from '@/components/admin/bits';
import { RecordPayout, ToggleActive } from '@/components/admin/TeacherControls';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default async function TeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const row = await affiliateByUserId(id);
  if (!row) notFound();

  const [totals, students, history] = await Promise.all([
    totalsFor(row.userId, row.commissionPct),
    referredStudents(row.userId),
    payouts(row.userId),
  ]);

  return (
    <>
      <Link
        href="/admin/teachers"
        className="mb-1 inline-block text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
      >
        Teachers
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] text-ink">{row.fullName}</h1>
          <p className="mt-0.5 text-[13.5px] text-ink2">
            {row.email} · {row.commissionPct}% of everything their students pay
            {row.active ? null : (
              <span className="ms-2">
                <Tag tone="grey">link switched off</Tag>
              </span>
            )}
          </p>
        </div>
        <ToggleActive affiliateId={row.userId} active={row.active} />
      </div>

      <div className="mt-5 rounded-[16px] border border-line bg-card px-4 py-3.5">
        <p className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink3">Their link</p>
        <p className="mt-1 break-all font-mono text-[13.5px] text-ink">{`${SITE_URL}/r/${row.code}`}</p>
      </div>

      <div className="mt-3">
        <StatGrid>
          <Stat value={String(totals.students)} label="Students joined" />
          <Stat value={String(totals.paidStudents)} label="Paying" tone="green" />
          <Stat value={String(totals.students - totals.paidStudents)} label="Not paid yet" tone="orange" />
          <Stat value={rupees(totals.earned)} label={`Earned · ${row.commissionPct}% of ${rupees(totals.gross)}`} tone="teal" />
          <Stat
            value={rupees(totals.outstanding)}
            label={totals.outstanding > 0 ? 'Outstanding' : totals.outstanding < 0 ? 'Paid ahead' : 'Settled'}
            tone="orange"
          />
        </StatGrid>
      </div>

      <div className="mt-5">
        <RecordPayout affiliateId={row.userId} outstanding={totals.outstanding} />
      </div>

      <Panel title={`Students (${students.length})`}>
        {students.length === 0 ? (
          <p className="px-4 py-5 text-[13.5px] text-ink2">Nobody has signed up through their link yet.</p>
        ) : (
          <Table head={['Student', 'Class', 'Joined', 'Status', 'Paid us', 'Their share']}>
            {students.map((s) => (
              <Row key={s.id}>
                <Td>
                  {s.name}
                  <span className="block text-[11.5px] text-ink3">{s.email}</span>
                </Td>
                <Td>{s.grade ? `Class ${s.grade}` : ''}</Td>
                <Td>{when(s.joinedAt)}</Td>
                <Td>{s.paid ? <Tag tone="green">paying</Tag> : <Tag tone="grey">not yet</Tag>}</Td>
                <Td>{s.spend ? rupees(s.spend) : ''}</Td>
                <Td>{s.spend ? rupees(Math.round((s.spend * row.commissionPct) / 100)) : ''}</Td>
              </Row>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Payouts">
        {history.length === 0 ? (
          <p className="px-4 py-5 text-[13.5px] text-ink2">Nothing paid out yet.</p>
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

      <Panel title="Details">
        <dl className="grid gap-x-6 gap-y-2.5 px-4 py-4 sm:grid-cols-2">
          <Detail label="Phone" value={row.phone} />
          <Detail label="City" value={row.city} />
          <Detail label="School or academy" value={row.institution} />
          <Detail label="Added" value={when(row.createdAt)} />
          <Detail label="Payout method" value={row.payoutMethod} />
          <Detail label="Account" value={row.payoutAccount} />
          <Detail label="Account title" value={row.payoutName} />
          <Detail label="Note" value={row.note} />
        </dl>
      </Panel>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink3">{label}</dt>
      <dd className="text-[13.5px] text-ink">{value?.trim() || <span className="text-ink3">not recorded</span>}</dd>
    </div>
  );
}
