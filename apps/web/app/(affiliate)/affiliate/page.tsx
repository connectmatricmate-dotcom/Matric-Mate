import { Suspense } from 'react';
import { payouts, totalsFor } from '@/lib/affiliates';
import { currentAffiliate } from '@/lib/affiliate-session';
import { SITE_URL } from '@/lib/site';
import { Panel, Row, Stat, StatGrid, Table, Td, rupees } from '@/components/admin/bits';
import { ShareLink } from '@/components/affiliate/ShareLink';
import { Skeleton } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/**
 * What a teacher sees first: their link, and their money.
 *
 * The students themselves moved to their own tab when this area gained a
 * sidebar. What stays here is the pair of things they came to check, and the
 * link they came to copy.
 */
async function Money() {
  const row = await currentAffiliate();
  const [totals, history] = await Promise.all([totalsFor(row.userId, row.commissionPct), payouts(row.userId)]);

  return (
    <>
      {/* "Not paid yet" is the number a teacher can act on: those are the
          people worth a reminder, and leaving it to be worked out by
          subtraction hides the only lever they have. */}
      <StatGrid>
        <Stat value={String(totals.students)} label="Students joined" />
        {/* "Have paid": everyone who has ever paid, which is what your share
            is worked out from. A lapsed plan does not take them off it. */}
        <Stat value={String(totals.paidStudents)} label="Have paid" tone="green" />
        <Stat value={String(totals.students - totals.paidStudents)} label="Not paid yet" tone="orange" />
        <Stat value={rupees(totals.earned)} label="Earned in total" tone="teal" />
      </StatGrid>
      <div className="mt-3">
        <StatGrid>
          <Stat value={rupees(totals.paidOut)} label="Paid to you so far" />
          <Stat
            value={rupees(Math.max(0, totals.outstanding))}
            label={totals.outstanding > 0 ? 'Due to you' : 'All paid up'}
            tone="orange"
          />
        </StatGrid>
      </div>

      <Panel title="Payments to you">
        {history.length === 0 ? (
          <p className="px-4 py-5 text-[13.5px] text-ink2">
            Nothing paid out yet. Every transfer will be listed here with its date.
          </p>
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

      <p className="mt-6 text-[12px] text-ink3">
        Earnings are worked out from payments that actually went through, and a refunded payment comes back off. If a
        number here looks wrong, say so and it can be checked against the payment records.
      </p>
    </>
  );
}

/** Shaped like Money: two rows of stats, the Panel's heading and box, the footnote. */
function MoneySkeleton() {
  const stat = (k: string) => <div key={k} className="h-[80px] animate-pulse rounded-[16px] border border-line bg-card" />;
  return (
    <>
      <StatGrid>{['a', 'b', 'c', 'd'].map(stat)}</StatGrid>
      <div className="mt-3">
        <StatGrid>{['e', 'f'].map(stat)}</StatGrid>
      </div>
      <div className="mt-7">
        <Skeleton className="mb-2.5 h-[25px] w-40" />
        <div className="h-[140px] animate-pulse rounded-[16px] border border-line bg-card" />
      </div>
      <Skeleton className="mt-6 h-[36px] w-full max-w-[640px]" />
    </>
  );
}

export default async function AffiliateDashboard() {
  // Awaited rather than streamed: the greeting and the link are the page, and
  // both come from one row that is already cached for the panels below.
  const row = await currentAffiliate();

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
        <Suspense fallback={<MoneySkeleton />}>
          <Money />
        </Suspense>
      </div>
    </>
  );
}
