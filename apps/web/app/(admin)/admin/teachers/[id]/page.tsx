import { notFound } from 'next/navigation';
import { affiliateByUserId, payouts, referredStudents, totalsFor } from '@/lib/affiliates';
import { requireAdmin } from '@/lib/roles';
import { SITE_URL } from '@/lib/site';
import { BackLink, Panel, Row, Stat, StatGrid, Table, Tag, Td, rupees } from '@/components/admin/bits';
import { RecordPayout, ToggleActive } from '@/components/admin/TeacherControls';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default async function TeacherPage({ params }: { params: Promise<{ id: string }> }) {
  // Before any read: these readers use the service key, and a student who had
  // a teacher's id was sent their code, earnings and students.
  await requireAdmin();
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
      <BackLink href="/admin/teachers">Teachers</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* min-w-0 and wrap-anywhere: an email is one long word, and a long
            one pushed this block past the edge of a phone screen. */}
        <div className="min-w-0">
          <h1 className="font-display text-[26px] text-ink wrap-anywhere">{row.fullName}</h1>
          <p className="mt-0.5 text-[13.5px] text-ink2 wrap-anywhere">
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
          {/* "Have paid", not "Paying": the count is everyone who has ever paid,
              which is what commission is earned on, and a lapsed plan does not
              take them off it. */}
          <Stat value={String(totals.paidStudents)} label="Have paid" tone="green" />
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
                  <span className="block text-[11.5px] text-ink3 wrap-anywhere">{s.email}</span>
                </Td>
                <Td num>{s.grade ? `Class ${s.grade}` : ''}</Td>
                <Td num>{when(s.joinedAt)}</Td>
                <Td>{s.paid ? <Tag tone="green">has paid</Tag> : <Tag tone="grey">not yet</Tag>}</Td>
                <Td num>{s.spend ? rupees(s.spend) : ''}</Td>
                <Td num>{s.spend ? rupees(Math.round((s.spend * row.commissionPct) / 100)) : ''}</Td>
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
                <Td num>{when(p.at)}</Td>
                <Td num className="font-extrabold">
                  {rupees(p.amount)}
                </Td>
                <Td className="wrap-anywhere">{p.note ?? ''}</Td>
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
      {/* wrap-anywhere: an account number or a long note is otherwise cut off by the panel. */}
      <dd className="text-[13.5px] text-ink wrap-anywhere">{value?.trim() || <span className="text-ink3">not recorded</span>}</dd>
    </div>
  );
}
