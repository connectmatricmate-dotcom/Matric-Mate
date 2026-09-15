import { Suspense } from 'react';
import { allAffiliates } from '@/lib/affiliates';
import { requireAdmin } from '@/lib/roles';
import { SITE_URL } from '@/lib/site';
import { RowName, Panel, PillLink, Table, Tag, Td, ViewLink, rupees } from '@/components/admin/bits';
import { CopyLink } from '@/components/admin/CopyLink';
import { TapRow } from '@/components/staff/TapRow';
import { LinkBtn, Skeleton } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

/**
 * Every teacher, with the numbers that decide what to pay them.
 *
 * The outstanding column is the one Adnan is actually here for, so it is last
 * among the numbers, where the eye lands, and it is the only one that changes
 * colour. On a phone each teacher is a card with it in plain view; tapping
 * the card opens the teacher.
 */
async function TeacherList() {
  const rows = await allAffiliates();

  if (rows.length === 0) {
    return (
      <Panel title="Nothing here yet">
        <p className="px-4 py-5 text-[13.5px] text-ink2">
          Add a teacher and the system mints their referral code and link. Students who sign up through it are tied to
          them permanently, and their share of whatever those students pay appears here.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title={`On the programme (${rows.length})`}>
      {/* "Have paid" counts everyone who has ever paid, which is what the
          commission is earned on, so it does not say "Paying". */}
      {/* No View column on a wide screen: the table already scrolls to reach
          Outstanding, and a button past it would be off the edge. There the
          name is the link and the row is the target; a phone card gets the
          button at its foot. */}
      <Table stack head={['Teacher', 'Referral link', 'Share', 'Students', 'Have paid', 'Not yet', 'Earned', 'Paid out', 'Outstanding']}>
        {rows.map(({ row, totals }) => {
          const link = `${SITE_URL}/r/${row.code}`;
          const href = `/admin/teachers/${row.userId}`;
          return (
            <TapRow key={row.userId} href={href}>
              <Td span>
                <RowName href={href}>{row.fullName}</RowName>
                <span className="block text-[11.5px] font-normal text-ink2 wrap-anywhere">{row.email}</span>
              </Td>
              {/* The link the teacher shares, not only its code: it is what
                  gets pasted into WhatsApp, so it is what gets copied. Shown
                  without https://www. to keep the column narrow; the copy has it.
                  Plain text, not a link to follow: opening it here would drop
                  the referral cookie into the admin's own browser. */}
              <Td span>
                <span className="block whitespace-nowrap text-[13px] font-extrabold text-teal">{link.replace(/^https?:\/\/(www\.)?/, '')}</span>
                <span className="mt-1.5 flex items-center gap-2">
                  <CopyLink link={link} />
                  {/* The QR lives on the teacher's page, big enough to scan. */}
                  {row.active ? <PillLink href={`${href}#qr`}>QR code</PillLink> : <Tag tone="grey">off</Tag>}
                </span>
              </Td>
              <Td num label="Share">
                {row.commissionPct}%
              </Td>
              <Td num label="Students">
                {totals.students}
              </Td>
              <Td num label="Have paid">
                {totals.paidStudents}
              </Td>
              <Td num label="Not yet">
                {totals.students - totals.paidStudents}
              </Td>
              <Td num label="Earned">
                {rupees(totals.earned)}
              </Td>
              <Td num label="Paid out">
                {rupees(totals.paidOut)}
              </Td>
              <Td num label="Outstanding" className="font-extrabold">
                {totals.outstanding > 0 ? (
                  <span className="text-orangedark">{rupees(totals.outstanding)}</span>
                ) : totals.outstanding < 0 ? (
                  <span className="text-ink2">{rupees(totals.outstanding)} ahead</span>
                ) : (
                  <span className="text-ink2">settled</span>
                )}
              </Td>
              <Td span className="md:hidden">
                <ViewLink href={href}>View teacher</ViewLink>
              </Td>
            </TapRow>
          );
        })}
      </Table>
    </Panel>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-7">
      <Skeleton className="mb-2.5 h-[25px] w-44" />
      <div className="h-[260px] animate-pulse rounded-[16px] border border-line bg-card" />
    </div>
  );
}

export default async function TeachersPage() {
  // Before any read: see requireAdmin for why the layout's check is not enough.
  await requireAdmin();

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] text-ink">Teachers</h1>
          <p className="mt-0.5 text-[13.5px] text-ink2">Tap a teacher to see their students, pay them, or print their QR.</p>
        </div>
        <LinkBtn title="Add a teacher" href="/admin/teachers/new" sm className="shrink-0" />
      </div>

      {/* Streamed: every teacher's totals are a read of their own, and the
          heading and the button to add one should not wait on all of them. */}
      <Suspense fallback={<ListSkeleton />}>
        <TeacherList />
      </Suspense>
    </>
  );
}
