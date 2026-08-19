import Link from 'next/link';
import { allAffiliates } from '@/lib/affiliates';
import { CellLink, Panel, Row, Table, Tag, Td, rupees } from '@/components/admin/bits';

export const dynamic = 'force-dynamic';

/**
 * Every teacher, with the numbers that decide what to pay them.
 *
 * The outstanding column is the one Adnan is actually here for, so it is last,
 * where the eye lands, and it is the only one that changes colour.
 */
export default async function TeachersPage() {
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
        <Link
          href="/admin/teachers/new"
          className="shrink-0 rounded-full bg-teal px-4 py-2.5 text-[13px] font-extrabold text-onbrand transition-[filter] duration-200 hover:brightness-110"
        >
          Add a teacher
        </Link>
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
          <Table head={['Teacher', 'Code', 'Share', 'Students', 'Paying', 'Earned', 'Paid out', 'Outstanding']}>
            {rows.map(({ row, totals }) => (
              <Row key={row.userId}>
                <Td>
                  <CellLink href={`/admin/teachers/${row.userId}`}>{row.fullName}</CellLink>
                  <span className="block text-[11.5px] font-normal text-ink3">{row.email}</span>
                </Td>
                <Td>
                  <span className="font-mono text-[12.5px]">{row.code}</span>
                  {row.active ? null : (
                    <span className="ms-2">
                      <Tag tone="grey">off</Tag>
                    </span>
                  )}
                </Td>
                <Td>{row.commissionPct}%</Td>
                <Td>{totals.students}</Td>
                <Td>{totals.paidStudents}</Td>
                <Td>{rupees(totals.earned)}</Td>
                <Td>{rupees(totals.paidOut)}</Td>
                <Td className="font-extrabold">
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
