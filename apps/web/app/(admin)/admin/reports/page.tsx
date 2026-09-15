import { Suspense } from 'react';
import Link from 'next/link';
import { BOARD_LABEL, asBoard, subjectById } from '@matricmate/core';
import { BackLink, Panel, Row, Table, Tag, Td } from '@/components/admin/bits';
import { ReportSeenButton, SheetResetButton } from '@/components/admin/ReportSeenButton';
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

/** A page of reports. Fifty is a screenful on a phone and a light read. */
const PAGE = 50;
const UUID = /^[0-9a-f-]{36}$/i;

type Report = { id: string; user_id: string; surface: string; ref: string | null; reason: string; excerpt: string | null; note: string | null; status: string; created_at: string };

/** What a report is about, when the report says: the question asked, the chapter, the exercise. */
type About = { text: string; sheet?: { chapter: string; cached: boolean } };

type Admin = ReturnType<typeof createAdminClient>;

/**
 * For each report, the thing it was about, from the `ref` the apps file with
 * it: the tutor message (and so the question that was asked), the chapter of
 * a revision sheet, the question an answer check or a test was on. A report
 * that carries no ref (career, coach) is about the student's own report.
 * Read in batches for the page on show, not one query per row.
 */
async function aboutEach(admin: Admin, rows: Report[]): Promise<Map<string, About>> {
  const out = new Map<string, About>();
  const refs = (surface: string, uuid?: boolean) =>
    [...new Set(rows.filter((r) => r.surface === surface && r.ref && (!uuid || UUID.test(r.ref))).map((r) => r.ref as string))];

  const tutorRefs = refs('tutor', true);
  const sheetRefs = refs('sheet');
  const questionRefs = [...new Set([...refs('check'), ...refs('paper')])];
  const mcqRefs = refs('ai_test', true);

  const [messages, chapters, sheets, questions, mcqs] = await Promise.all([
    tutorRefs.length ? admin.from('chat_messages').select('id, thread_id, at').in('id', tutorRefs) : null,
    sheetRefs.length ? admin.from('chapters').select('id, title, grade, board, subject_id').in('id', sheetRefs) : null,
    sheetRefs.length ? admin.from('cheat_sheets').select('chapter_id, body').in('chapter_id', sheetRefs) : null,
    questionRefs.length ? admin.from('short_questions').select('id, q').in('id', questionRefs) : null,
    mcqRefs.length ? admin.from('generated_mcqs').select('id, q, subject_id').in('id', mcqRefs) : null,
  ]);

  // The tutor: the student's own message that came just before the reported answer.
  const msgs = ((messages?.data ?? []) as { id: string; thread_id: string; at: string }[]);
  if (msgs.length) {
    const threads = [...new Set(msgs.map((m) => m.thread_id))];
    const { data: asked } = await admin
      .from('chat_messages')
      .select('thread_id, content, at')
      .in('thread_id', threads)
      .eq('role', 'user')
      .order('at', { ascending: false })
      .range(0, 999);
    const users = (asked ?? []) as { thread_id: string; content: string; at: string }[];
    const byId = new Map(msgs.map((m) => [m.id, m]));
    for (const r of rows) {
      const m = r.surface === 'tutor' && r.ref ? byId.get(r.ref) : undefined;
      if (!m) continue;
      const q = users.find((u) => u.thread_id === m.thread_id && Date.parse(u.at) <= Date.parse(m.at));
      if (q) out.set(r.id, { text: `Asked: ${q.content.slice(0, 300)}${q.content.length > 300 ? '…' : ''}` });
    }
  }

  const chapterRows = (chapters?.data ?? []) as { id: string; title: string; grade: number; board: string; subject_id: string }[];
  const sheetRows = (sheets?.data ?? []) as { chapter_id: string; body: string }[];
  for (const r of rows) {
    if (r.surface !== 'sheet' || !r.ref) continue;
    const c = chapterRows.find((x) => x.id === r.ref);
    const name = c ? `${subjectById(c.subject_id)?.name ?? c.subject_id} ${c.grade}, ${c.title}` : r.ref;
    const start = (r.excerpt ?? '').trim().slice(0, 160);
    const cached = !!start && sheetRows.some((s) => s.chapter_id === r.ref && s.body.trim().startsWith(start));
    out.set(r.id, { text: `Chapter: ${name}${c ? ` (${BOARD_LABEL[asBoard(c.board)]})` : ''}`, sheet: { chapter: name, cached } });
  }

  const qRows = (questions?.data ?? []) as { id: string; q: string }[];
  const mRows = (mcqs?.data ?? []) as { id: string; q: string; subject_id: string }[];
  for (const r of rows) {
    if (!r.ref) continue;
    if (r.surface === 'check' || r.surface === 'paper') {
      const q = qRows.find((x) => x.id === r.ref);
      if (q) out.set(r.id, { text: `Question: ${q.q.slice(0, 300)}` });
    } else if (r.surface === 'ai_test') {
      const q = mRows.find((x) => x.id === r.ref);
      if (q) out.set(r.id, { text: `${subjectById(q.subject_id)?.name ?? 'Question'}: ${q.q.slice(0, 300)}` });
    }
  }
  for (const r of rows) {
    if (!out.has(r.id) && (r.surface === 'career' || r.surface === 'coach')) out.set(r.id, { text: 'About the student’s own report' });
  }
  return out;
}

/**
 * AI answers students reported from inside the apps. Google Play requires an
 * app that generates content with AI to take these reports; this is where they
 * are read. The answer is kept beside each report (cut short), because the
 * conversation it came from may be gone by the time it is read, and so is what
 * it was about, where the report says.
 *
 * Paged, fifty at a time, with the count of new ones taken on its own: the
 * list stopped at 200 and the "new" figure was counted from those 200.
 */
async function ReportTable({ page }: { page: number }) {
  const admin = createAdminClient();
  const from = (page - 1) * PAGE;
  const [{ data, error, count }, fresh] = await Promise.all([
    admin
      .from('ai_reports')
      .select('id, user_id, surface, ref, reason, excerpt, note, status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE - 1),
    admin.from('ai_reports').select('*', { count: 'exact', head: true }).eq('status', 'new'),
  ]);
  if (error || fresh.error) throw new Error('Could not load the reports.');
  const rows = (data ?? []) as Report[];
  const total = count ?? rows.length;
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: people }, about] = await Promise.all([
    ids.length ? admin.from('profiles').select('id, name, role').in('id', ids) : Promise.resolve({ data: [] }),
    aboutEach(admin, rows),
  ]);
  const person = new Map(((people ?? []) as { id: string; name: string | null; role: string | null }[]).map((p) => [p.id, p]));
  const newCount = fresh.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  if (!total) {
    return (
      <Panel title="Reported answers">
        <p className="px-4 py-6 text-[13px] text-ink2">No AI answer has been reported yet.</p>
      </Panel>
    );
  }
  return (
    <>
      <Panel title={newCount ? `Reported answers (${newCount} new)` : 'Reported answers'}>
        {rows.length ? (
          <Table stack head={['When', 'Where', 'Why', 'The answer', '']}>
            {rows.map((r) => {
              const p = person.get(r.user_id);
              const a = about.get(r.id);
              return (
                <Row key={r.id}>
                  <Td num span className="whitespace-nowrap text-ink2">
                    {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Karachi' })}
                    <span className="block text-[12px]">
                      {p && (!p.role || p.role === 'student') ? (
                        // Opens the student: who they are and what else they did.
                        // A thumb's height on a phone, where it is the row's only link.
                        <Link
                          href={`/admin/students/${r.user_id}`}
                          className="inline-flex min-h-11 items-center font-extrabold text-teal transition-colors duration-200 hover:brightness-90 md:min-h-0"
                        >
                          {p.name?.trim() || 'A student'}
                        </Link>
                      ) : (
                        <span className="text-ink2">{p?.name?.trim() || 'A deleted account'}</span>
                      )}
                    </span>
                  </Td>
                  <Td label="Where" className="text-ink2">
                    {SURFACE[r.surface] ?? r.surface}
                  </Td>
                  <Td label="Why">
                    <Tag tone={r.reason === 'offensive' || r.reason === 'unsafe' ? 'red' : 'orange'}>{REASON[r.reason] ?? r.reason}</Tag>
                    {r.note ? <span className="mt-1 block max-w-[220px] text-[12px] text-ink2 wrap-anywhere">“{r.note}”</span> : null}
                  </Td>
                  <Td span>
                    {a ? <span className="mb-1.5 block max-w-[420px] text-[12.5px] font-extrabold text-ink wrap-anywhere">{a.text}</span> : null}
                    <span className="block max-w-[420px] whitespace-pre-line text-[12.5px] leading-[1.6] text-ink2 wrap-anywhere">
                      {(r.excerpt ?? '').slice(0, 600)}
                      {(r.excerpt ?? '').length > 600 ? '…' : ''}
                    </span>
                  </Td>
                  <Td span className="text-end">
                    <span className="flex flex-wrap gap-2 md:flex-col md:items-end">
                      {r.status === 'new' ? <ReportSeenButton id={r.id} /> : <Tag tone="grey">Seen</Tag>}
                      {a?.sheet?.cached ? (
                        <SheetResetButton id={r.id} chapter={a.sheet.chapter} />
                      ) : a?.sheet ? (
                        <span className="text-[12px] text-ink2">A new sheet has replaced this one.</span>
                      ) : null}
                    </span>
                  </Td>
                </Row>
              );
            })}
          </Table>
        ) : (
          <p className="px-4 py-6 text-[13px] text-ink2">Nothing on this page. Go back to the first page.</p>
        )}
      </Panel>

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-ink2">
            Page {page} of {pages} · {total.toLocaleString('en-PK')} reports
          </span>
          <span className="flex gap-2">
            {page > 1 ? <PageLink href={page === 2 ? '/admin/reports' : `/admin/reports?page=${page - 1}`}>Newer</PageLink> : null}
            {page < pages ? <PageLink href={`/admin/reports?page=${page + 1}`}>Older</PageLink> : null}
          </span>
        </nav>
      ) : null}
    </>
  );
}

function PageLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center rounded-full border border-line bg-card px-4 text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:border-teal hover:text-teal"
    >
      {children}
    </Link>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const page = Math.max(1, Math.min(10_000, Number.parseInt((await searchParams).page ?? '1', 10) || 1));
  return (
    <>
      {/* Reached from a card on the overview, not a tab, so the way back is here. */}
      <BackLink href="/admin">Overview</BackLink>
      <h1 className="font-display text-[26px] text-ink">Reported answers</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink2">
        What students flagged with “Report this answer” in the AI tutor and the other AI features. A student can send
        twenty a day at most.
      </p>
      <Suspense key={page} fallback={<div className="h-[320px] animate-pulse rounded-[16px] border border-line bg-card" />}>
        <ReportTable page={page} />
      </Suspense>
    </>
  );
}
