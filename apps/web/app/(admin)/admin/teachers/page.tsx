import { allAffiliates } from '@/lib/affiliates';
import { requireAdmin } from '@/lib/roles';
import { CellLink, Panel, Row, Table, Tag, Td, rupees } from '@/components/admin/bits';
import { LinkBtn } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

/**
 * Every teacher, with the numbers that decide what to pay them.
 *
 * The outstanding column is the one Adnan is actually here for, so it is last,
 * where the eye lands, and it is the only one that changes colour.
 */
export default async function TeachersPage() {
  // Before any read: see requireAdmin for why the layout's check is not enough.
  await requireAdmin();
  const rows = await allAffiliates();

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] text-ink">Teachers</h1>
          <p className="mt-0.5 text-[13.5px] text-ink2">
            {rows.length ? `${rows.length} on the programme.` : 'Nobody on the programme yet.'}
          </p>
        </div>
        <LinkBtn title="Add a teacher" href="/admin/teachers/new" sm className="shrink-0" />
      </div>

      {rows.length === 0 ? (
        <Panel title="Nothing here yet">
          <p className="px-4 py-5 text-[13.5px] text-ink2">
            Add a teacher and the system mints their referral code and link. Students who sign up through it are tied to
            them permanently, and their share of whatever those students pay appears here.
          </p>
        </Panel>
      ) : (
        <Panel title="On the programme">
          {/* "Have paid" counts everyone who has ever paid, which is what the
              commission is earned on, so it does not say "Paying". */}
          <Table head={['Teacher', 'Code', 'Share', 'Students', 'Have paid', 'Not yet', 'Earned', 'Paid out', 'Outstanding']}>
            {rows.map(({ row, totals }) => (
              <Row key={row.userId}>
                <Td>
                  <CellLink href={`/admin/teachers/${row.userId}`}>{row.fullName}</CellLink>
                  <span className="block text-[11.5px] font-normal text-ink3 wrap-anywhere">{row.email}</span>
                </Td>
                <Td num>
                  <span className="font-mono text-[12.5px]">{row.code}</span>
                  {row.active ? null : (
                    <span className="ms-2">
                      <Tag tone="grey">off</Tag>
                    </span>
                  )}
                </Td>
                <Td num>{row.commissionPct}%</Td>
                <Td num>{totals.students}</Td>
                <Td num>{totals.paidStudents}</Td>
                <Td num>{totals.students - totals.paidStudents}</Td>
                <Td num>{rupees(totals.earned)}</Td>
                <Td num>{rupees(totals.paidOut)}</Td>
                <Td num className="font-extrabold">
                  {totals.outstanding > 0 ? (
                    <span className="text-orangedark">{rupees(totals.outstanding)}</span>
                  ) : totals.outstanding < 0 ? (
                    <span className="text-ink2">{rupees(totals.outstanding)} ahead</span>
                  ) : (
                    <span className="text-ink3">settled</span>
                  )}
                </Td>
              </Row>
            ))}
          </Table>
        </Panel>
      )}
    </>
  );
}
