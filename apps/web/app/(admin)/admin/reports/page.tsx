import { Suspense } from 'react';
import { Panel, Row, Table, Tag, Td } from '@/components/admin/bits';
import { ReportSeenButton } from '@/components/admin/ReportSeenButton';
import { requireAdmin } from '@/lib/roles';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const SURFACE: Record<string, string> = {
  tutor: 'AI tutor',
  ai_test: 'AI test',
  paper: 'Mock paper',
  sheet: 'Revision sheet',
  career: 'Career guidance',
  coach: 'AI coach',
  check: 'Answer check',
};
const REASON: Record<string, string> = {
  wrong: 'Wrong',
  offensive: 'Offensive or rude',
  unsafe: 'Harmful or unsafe',
  other: 'Something else',
};

type Report = { id: string; user_id: string; surface: string; reason: string; excerpt: string | null; note: string | null; status: string; created_at: string };

/**
 * AI answers students reported from inside the apps. Google Play requires an
 * app that generates content with AI to take these reports; this is where they
 * are read. The answer is kept beside each report (cut short), because the
 * conversation it came from may be gone by the time it is read.
 */
async function ReportTable() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('ai_reports')
    .select('id, user_id, surface, reason, excerpt, note, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error('Could not load the reports.');
  const rows = (data ?? []) as Report[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: people } = ids.length ? await admin.from('profiles').select('id, name').in('id', ids) : { data: [] };
  const name = new Map(((people ?? []) as { id: string; name: string | null }[]).map((p) => [p.id, p.name ?? '']));
  const fresh = rows.filter((r) => r.status === 'new').length;

  if (!rows.length) {
    return (
      <Panel title="Reported answers">
        <p className="px-4 py-6 text-[13px] text-ink2">No AI answer has been reported yet.</p>
      </Panel>
    );
  }
  return (
    <Panel title={fresh ? `Reported answers (${fresh} new)` : 'Reported answers'}>
      <Table head={['When', 'Where', 'Why', 'The answer', '']}>
        {rows.map((r) => (
          <Row key={r.id}>
            <Td num className="whitespace-nowrap text-ink2">
              {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' })}
              <span className="block text-[12px] text-ink3">{name.get(r.user_id) || 'A student'}</span>
            </Td>
            <Td className="text-ink2">{SURFACE[r.surface] ?? r.surface}</Td>
            <Td>
              <Tag tone={r.reason === 'offensive' || r.reason === 'unsafe' ? 'red' : 'orange'}>{REASON[r.reason] ?? r.reason}</Tag>
              {r.note ? <span className="mt-1 block max-w-[220px] text-[12px] text-ink2 wrap-anywhere">“{r.note}”</span> : null}
            </Td>
            <Td>
              <span className="block max-w-[420px] whitespace-pre-line text-[12.5px] leading-[1.6] text-ink2 wrap-anywhere">
                {(r.excerpt ?? '').slice(0, 600)}
                {(r.excerpt ?? '').length > 600 ? '…' : ''}
              </span>
            </Td>
            <Td className="text-end">{r.status === 'new' ? <ReportSeenButton id={r.id} /> : <Tag tone="grey">Seen</Tag>}</Td>
          </Row>
        ))}
      </Table>
    </Panel>
  );
}

export default async function ReportsPage() {
  await requireAdmin();
  return (
    <>
      <h1 className="font-display text-[26px] text-ink">Reported answers</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink2">
        What students flagged with “Report this answer” in the AI tutor and the other AI features.
      </p>
      <Suspense fallback={<div className="h-[320px] animate-pulse rounded-[16px] border border-line bg-card" />}>
        <ReportTable />
      </Suspense>
    </>
  );
}
