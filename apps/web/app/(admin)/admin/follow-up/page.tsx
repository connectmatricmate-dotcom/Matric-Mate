import { Suspense } from 'react';
import { Panel, Row, Table, Tag, Td } from '@/components/admin/bits';
import { followUps } from '@/lib/follow-up';
import { requireAdmin } from '@/lib/roles';

export const dynamic = 'force-dynamic';

/**
 * Students to follow up with: a free trial or a plan that has just ended or is
 * about to. The app itself may not tell them how to keep going (Google Play,
 * core/billing.ts), so the telling happens out here: the plans job emails
 * each of them once, and this list is for the personal message, which in
 * Pakistan is WhatsApp. Each row opens WhatsApp with the message written and a
 * link that signs the student in on the plans page (good for seven days).
 */
async function FollowUpTable() {
  const rows = await followUps();
  if (!rows.length) {
    return (
      <Panel title="Follow up">
        <p className="px-4 py-6 text-[13px] text-ink2">
          Nobody’s trial or plan has ended in the last two weeks or ends in the next three days.
        </p>
      </Panel>
    );
  }
  return (
    <Panel title={`Follow up (${rows.length})`}>
      <Table head={['Student', 'What', 'Reminder', '']}>
        {rows.map((r) => (
          <Row key={r.id}>
            <Td>
              <span className="block font-extrabold text-ink">{r.name}</span>
              <span className="block text-[12px] text-ink2 wrap-anywhere">{r.email}</span>
              {r.phone ? <span className="block text-[12px] text-ink3">{r.phone}</span> : null}
            </Td>
            <Td>
              <Tag tone={r.ended ? 'red' : 'orange'}>{r.status}</Tag>
            </Td>
            <Td className="text-ink2">{r.reminded ? 'Sent' : '·'}</Td>
            <Td className="text-end">
              {r.whatsapp ? (
                <a
                  href={r.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-line bg-card px-3 text-[12.5px] font-extrabold text-ink2 transition-colors duration-200 hover:border-teal hover:text-teal md:h-10"
                >
                  WhatsApp
                </a>
              ) : (
                <span className="text-[12px] text-ink3">No mobile number</span>
              )}
            </Td>
          </Row>
        ))}
      </Table>
    </Panel>
  );
}

export default async function FollowUpPage() {
  // Before any read: see requireAdmin for why the layout's check is not enough.
  await requireAdmin();
  return (
    <>
      <h1 className="font-display text-[26px] text-ink">Follow up</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink2">
        Students whose free trial or plan has ended in the last two weeks, or ends in the next three days. Each gets
        one automatic reminder by email and in the app; the WhatsApp button writes a personal one for you, with a
        link that signs them in on the plans page.
      </p>
      <Suspense fallback={<div className="h-[320px] animate-pulse rounded-[16px] border border-line bg-card" />}>
        <FollowUpTable />
      </Suspense>
    </>
  );
}
