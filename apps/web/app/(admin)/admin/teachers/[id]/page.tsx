import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { affiliateByUserId, payouts, referredStudents, totalsFor, type AffiliateRow } from '@/lib/affiliates';
import { requireAdmin } from '@/lib/roles';
import { SITE_URL } from '@/lib/site';
import { BackLink, Panel, RowName, Row, Stat, StatGrid, Table, Tag, Td, ViewLink, rupees } from '@/components/admin/bits';
import { ShareCard } from '@/components/affiliate/ShareCard';
import { DeletePayout, RecordPayout, ToggleActive } from '@/components/admin/TeacherControls';
import { TapRow } from '@/components/staff/TapRow';
import { Skeleton } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }) : '';

/** How long after recording a payout it can still be deleted (the action checks again). */
const UNDO_MS = 24 * 3600 * 1000;
const undoable = (at: string) => Date.now() - Date.parse(at) < UNDO_MS;

/** The numbers and the payout form: what the teacher is owed, and recording it paid. */
async function Money({ row }: { row: AffiliateRow }) {
  const totals = await totalsFor(row.userId, row.commissionPct);
  return (
    <>
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
        <RecordPayout affiliateId={row.userId} outstanding={totals.outstanding} teacherName={row.fullName} />
      </div>
    </>
  );
}

/** Their students: every row opens the student's page, report and plan. */
async function Students({ row }: { row: AffiliateRow }) {
  const { students, deleted } = await referredStudents(row.userId, row.commissionPct);
  return (
    <Panel title={`Students (${students.length})`}>
      {students.length === 0 && !deleted.spend ? (
        <p className="px-4 py-5 text-[13.5px] text-ink2">Nobody has signed up through their link yet.</p>
      ) : (
        <Table stack head={['Student', 'Class', 'Joined', 'Status', 'Paid us', 'Their share', '']}>
          {students.map((s) => {
            const href = `/admin/students/${s.id}`;
            return (
              <TapRow key={s.id} href={href}>
                <Td span>
                  <RowName href={href}>{s.name}</RowName>
                  <span className="block text-[11.5px] text-ink2 wrap-anywhere">{s.email}</span>
                </Td>
                <Td num label="Class">
                  {s.grade ? `Class ${s.grade}` : ''}
                </Td>
                <Td num label="Joined">
                  {when(s.joinedAt)}
                </Td>
                <Td label="Status">{s.paid ? <Tag tone="green">has paid</Tag> : <Tag tone="grey">not yet</Tag>}</Td>
                <Td num label="Paid us">
                  {s.spend ? rupees(s.spend) : '·'}
                </Td>
                <Td num label="Their share">
                  {s.spend ? rupees(s.share) : '·'}
                </Td>
                <Td span className="text-end">
                  <ViewLink href={`${href}#report`}>View report</ViewLink>
                </Td>
              </TapRow>
            );
          })}
          {/* What students who deleted their account paid: still theirs to earn on. */}
          {deleted.spend ? (
            <Row>
              <Td span>
                <span className="font-extrabold text-ink2">Deleted accounts</span>
                <span className="block text-[11.5px] text-ink2">
                  {deleted.payments === 1 ? 'A payment from a student who has' : `${deleted.payments} payments from students who have`} since deleted their account
                </span>
              </Td>
              <Td>{null}</Td>
              <Td>{null}</Td>
              <Td>{null}</Td>
              <Td num label="Paid us">
                {rupees(deleted.spend)}
              </Td>
              <Td num label="Their share">
                {rupees(deleted.share)}
              </Td>
              <Td>{null}</Td>
            </Row>
          ) : null}
        </Table>
      )}
    </Panel>
  );
}

/** What has been handed over, newest first. A payout from today can be deleted. */
async function Payouts({ row }: { row: AffiliateRow }) {
  const history = await payouts(row.userId);
  return (
    <Panel title="Payouts">
      {history.length === 0 ? (
        <p className="px-4 py-5 text-[13.5px] text-ink2">Nothing paid out yet.</p>
      ) : (
        <Table stack head={['Date', 'Amount', 'Note', '']}>
          {history.map((p) => (
            <Row key={p.id}>
              <Td num label="Date">
                {when(p.at)}
              </Td>
              <Td num label="Amount" className="font-extrabold">
                {rupees(p.amount)}
              </Td>
              <Td span className="wrap-anywhere">
                {p.note ?? ''}
              </Td>
              <Td span className="text-end">
                {undoable(p.at) ? (
                  <DeletePayout payoutId={p.id} affiliateId={row.userId} amount={p.amount} day={when(p.at)} teacherName={row.fullName} />
                ) : null}
              </Td>
            </Row>
          ))}
        </Table>
      )}
    </Panel>
  );
}

const box = (h: string) => <div className={`animate-pulse rounded-[16px] border border-line bg-card ${h}`} />;

export default async function TeacherPage({ params }: { params: Promise<{ id: string }> }) {
  // Before any read: these readers use the service key, and a student who had
  // a teacher's id was sent their code, earnings and students.
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  // The one read the heading needs. The money, the students and the payouts
  // each stream in under it.
  const row = await affiliateByUserId(id);
  if (!row) notFound();

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

      {/* The teacher's invite, the same card they see on their own page, so
          Adnan can send the link or print the QR card for their classes. A
          switched-off link shows only the address: there is nothing to sign
          up through until it is turned back on. */}
      <div id="qr" className="mt-5 scroll-mt-20">
        {row.active ? (
          <ShareCard
            link={`${SITE_URL}/r/${row.code}`}
            code={row.code}
            name={row.fullName}
            heading={`${row.fullName.split(' ')[0]}’s invite`}
            note="Send the link to the teacher, or download the QR card and print it for their classes. Students who sign up through either are counted as theirs."
            printNote={`Download QR saves a card ready to print, with the QR, the link written out and ${row.fullName}’s name.`}
          />
        ) : (
          <div className="rounded-[16px] border border-line bg-card px-4 py-3.5">
            <p className="text-[13px] font-extrabold text-ink2">Their link, switched off</p>
            <p className="mt-1 break-all text-[13.5px] text-ink3">{`${SITE_URL}/r/${row.code}`}</p>
          </div>
        )}
      </div>

      <Suspense
        fallback={
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">{['a', 'b', 'c', 'd', 'e'].map((k) => <div key={k}>{box('h-[80px]')}</div>)}</div>
            <div className="mt-5">{box('h-[190px]')}</div>
          </>
        }
      >
        <Money row={row} />
      </Suspense>

      <Suspense
        fallback={
          <div className="mt-7">
            <Skeleton className="mb-2.5 h-[25px] w-32" />
            {box('h-[220px]')}
          </div>
        }
      >
        <Students row={row} />
      </Suspense>

      <Suspense
        fallback={
          <div className="mt-7">
            <Skeleton className="mb-2.5 h-[25px] w-24" />
            {box('h-[120px]')}
          </div>
        }
      >
        <Payouts row={row} />
      </Suspense>

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
