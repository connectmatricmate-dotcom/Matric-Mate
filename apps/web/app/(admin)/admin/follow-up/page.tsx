import { Suspense } from 'react';
import { RowName, Panel, Table, Tag, Td, ViewLink } from '@/components/admin/bits';
import { TapRow } from '@/components/staff/TapRow';
import { Icon } from '@/components/ui/primitives';
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
      {/* A card per student on a phone, the WhatsApp button on it in plain
          view: it was the last column, off the right edge of the screen. */}
      <Table stack head={['Student', 'What', 'Reminder', '', '']}>
        {rows.map((r) => (
          <TapRow key={r.id} href={`/admin/students/${r.id}`}>
            <Td span>
              <RowName href={`/admin/students/${r.id}`}>{r.name}</RowName>
              <span className="block text-[12px] text-ink2 wrap-anywhere">{r.email}</span>
              {r.phone ? <span className="block text-[12px] text-ink2">{r.phone}</span> : null}
            </Td>
            <Td label="What">
              <Tag tone={r.ended ? 'red' : 'orange'}>{r.status}</Tag>
            </Td>
            <Td label="Reminder" className="text-ink2">
              {r.reminded ? 'Sent' : 'Not yet'}
            </Td>
            <Td span className="text-end">
              {r.whatsapp ? (
                <a
                  href={r.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-teal px-4 text-[12.5px] font-extrabold text-onbrand transition-[filter] duration-200 hover:brightness-110 max-md:w-full md:h-10"
                >
                  <Icon name="whatsapp" size={16} />
                  Message on WhatsApp
                </a>
              ) : (
                <span className="text-[12px] text-ink2">No mobile number</span>
              )}
            </Td>
            <Td span className="text-end">
              <ViewLink href={`/admin/students/${r.id}`}>View student</ViewLink>
            </Td>
          </TapRow>
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
