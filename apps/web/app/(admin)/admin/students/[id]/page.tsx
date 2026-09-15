import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BOARD_LABEL, karachiDay, tierOf } from '@matricmate/core';
import { adminStudent, type AdminStudent } from '@/lib/admin-student';
import { adminStudentDay } from '@/lib/affiliates';
import { planById } from '@/lib/plans';
import { requireAdmin } from '@/lib/roles';
import { BackLink, Panel, Row, Table, Tag, Td, rupees } from '@/components/admin/bits';
import { DeleteStudent } from '@/components/admin/DeleteStudent';
import { PlanToggle } from '@/components/admin/PlanToggle';
import { StudentReport, StudentReportSkeleton } from '@/components/staff/StudentReport';
import { Skeleton } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

const WEEK = 7;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' }) : '';

const STATUS: Record<string, { label: string; tone: 'green' | 'grey' | 'red' | 'orange' }> = {
  paid: { label: 'Paid', tone: 'green' },
  refunded: { label: 'Refunded', tone: 'grey' },
  pending: { label: 'Not completed', tone: 'orange' },
  failed: { label: 'Failed', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
};

/** Where the plan stands, in one sentence Adnan can read out on the phone. */
function planLine(s: AdminStudent): { tag: React.ReactNode; line: string; tier: ReturnType<typeof tierOf> | null } {
  const end = s.validTill ? Date.parse(s.validTill) : NaN;
  const running = s.active && Number.isFinite(end) && end > Date.now();
  const tier = running ? tierOf(s.plan) : null;
  if (tier === 'premium') return { tier, tag: <Tag tone="green">Premium</Tag>, line: `Runs until ${when(s.validTill)}.` };
  if (tier === 'basic') return { tier, tag: <Tag tone="teal">Basic</Tag>, line: `Runs until ${when(s.validTill)}.` };
  if (tier === 'trial') return { tier, tag: <Tag tone="orange">Free trial</Tag>, line: `The free trial runs until ${when(s.validTill)}.` };
  const revoked = !s.active && !!s.plan && Number.isFinite(end) && end > Date.now();
  const line = revoked
    ? 'Switched off by you. Give a plan to switch it back on.'
    : s.plan && s.validTill
      ? `${tierOf(s.plan) === 'trial' ? 'Their free trial ended' : 'Their plan ended'} on ${when(s.validTill)}.`
      : s.trialUsed
        ? 'No plan.'
        : 'No plan yet.';
  return { tier: null, tag: <Tag tone="grey">No plan</Tag>, line };
}

/**
 * One student, for the administrator: who they are, their plan with the
 * buttons for it, what they have paid, and their study report.
 *
 * This is where every student row in the admin area leads. The same buttons
 * as on the list, with room to read what they will do.
 */
async function StudentHeader({ id }: { id: string }) {
  const s = await adminStudent(id);
  if (!s) notFound();
  const plan = planLine(s);

  return (
    <>
      <h1 className="font-display text-[26px] text-ink wrap-anywhere">{s.name}</h1>
      <p className="mt-0.5 text-[13.5px] text-ink2">
        {[s.grade ? `Class ${s.grade}` : '', BOARD_LABEL[s.board], s.school ?? ''].filter(Boolean).join(' · ')}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <section className="rounded-[16px] border border-line bg-card px-4 py-4">
          <h2 className="font-display text-[17px] text-ink">Plan</h2>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[13.5px] text-ink2">
            {plan.tag}
            <span>{plan.line}</span>
          </p>
          <div className="mt-4">
            <PlanToggle userId={s.id} tier={plan.tier} name={s.name} validTill={s.validTill} inline />
          </div>
        </section>

        <section className="rounded-[16px] border border-line bg-card px-4 py-4">
          <h2 className="font-display text-[17px] text-ink">Contact</h2>
          <dl className="mt-2 grid gap-y-1 text-[13.5px]">
            <Detail label="Email">
              <a href={`mailto:${s.email}`} className="inline-flex min-h-11 items-center font-extrabold text-teal wrap-anywhere hover:underline md:min-h-10">
                {s.email}
              </a>
            </Detail>
            <Detail label="Mobile">
              {s.phone ? (
                <a href={`tel:${s.phone.replace(/[^+\d]/g, '')}`} className="inline-flex min-h-11 items-center font-extrabold text-teal hover:underline md:min-h-10">
                  {s.phone}
                </a>
              ) : (
                <span className="text-ink3">not given</span>
              )}
            </Detail>
            <Detail label="Joined">{when(s.joined)}</Detail>
            <Detail label="Teacher">
              {s.teacher ? (
                <Link href={`/admin/teachers/${s.teacher.id}`} className="inline-flex min-h-11 items-center font-extrabold text-teal hover:underline md:min-h-10">
                  {s.teacher.name}
                </Link>
              ) : (
                <span className="text-ink3">none, signed up on their own</span>
              )}
            </Detail>
          </dl>
        </section>
      </div>

      <Panel title="Payments">
        {s.payments.length ? (
          <Table stack head={['Date', 'Plan', 'Amount', 'Status', 'How']}>
            {s.payments.map((p) => (
              <Row key={p.id}>
                <Td num span className="font-extrabold">
                  {when(p.at)}
                </Td>
                <Td label="Plan">{p.plan ? planById(p.plan).name : '·'}</Td>
                <Td num label="Amount">
                  {rupees(p.amount)}
                </Td>
                <Td label="Status">
                  <Tag tone={STATUS[p.status]?.tone ?? 'grey'}>{STATUS[p.status]?.label ?? p.status}</Tag>
                </Td>
                <Td label="How" className="text-ink2">
                  {p.manual ? 'Given by you' : 'Paid online'}
                </Td>
              </Row>
            ))}
          </Table>
        ) : (
          <p className="px-4 py-5 text-[13.5px] text-ink2">Nothing paid yet.</p>
        )}
      </Panel>
    </>
  );
}

/** At the foot of the page, after the report: the one thing here that cannot be undone. */
async function DeleteSection({ id }: { id: string }) {
  const s = await adminStudent(id);
  return s ? <DeleteStudent userId={s.id} name={s.name} /> : null;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_1fr] items-baseline gap-x-3">
      <dt className="text-[12.5px] font-extrabold text-ink3">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

async function Report({ id, day, week }: { id: string; day: string; week: string[] }) {
  const data = await adminStudentDay(id, day, week);
  if (!data) return null;
  return <StudentReport data={data} day={day} week={week} href={(d) => `/admin/students/${id}?day=${d}#report`} />;
}

function HeaderSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-40" />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="h-[190px] animate-pulse rounded-[16px] border border-line bg-card" />
        <div className="h-[190px] animate-pulse rounded-[16px] border border-line bg-card" />
      </div>
      <div className="mt-7 h-[140px] animate-pulse rounded-[16px] border border-line bg-card" />
    </>
  );
}

export default async function AdminStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  // Before any read: see requireAdmin for why the layout's check is not enough.
  await requireAdmin();
  const [{ id }, { day: raw }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const week = Array.from({ length: WEEK }, (_, back) => karachiDay(back));
  const day = raw && DAY_RE.test(raw) && week.includes(raw) ? raw : week[0];

  return (
    <>
      <BackLink href="/admin/students">Students</BackLink>
      <Suspense fallback={<HeaderSkeleton />}>
        <StudentHeader id={id} />
      </Suspense>

      <section id="report" className="mt-9 scroll-mt-20">
        <h2 className="mb-3 font-display text-[20px] text-ink">Study report</h2>
        <Suspense key={day} fallback={<StudentReportSkeleton />}>
          <Report id={id} day={day} week={week} />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <DeleteSection id={id} />
      </Suspense>
    </>
  );
}
