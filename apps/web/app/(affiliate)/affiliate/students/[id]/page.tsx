import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { BOARD_LABEL, karachiDay } from '@matricmate/core';
import { referredStudentDay } from '@/lib/affiliates';
import { currentAffiliate } from '@/lib/affiliate-session';
import { BackLink } from '@/components/admin/bits';
import { StudentReport, StudentReportSkeleton } from '@/components/staff/StudentReport';
import { Skeleton } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

/** A week, today and the six days before it. */
const WEEK = 7;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One student's day, as their teacher sees it: the same daily report the
 * student has of themselves, and their week at a glance.
 *
 * Only a student this teacher referred: referredStudentDay scopes by the
 * teacher's own id, so any other id in the URL is a 404.
 */
async function StudentDayView({ id, day, week }: { id: string; day: string; week: string[] }) {
  const row = await currentAffiliate();
  const data = await referredStudentDay(row.userId, id, day, week);
  if (!data) notFound();
  const { student } = data;

  return (
    <>
      <h1 className="font-display text-[26px] text-ink wrap-anywhere">{student.name}</h1>
      <p className="mt-0.5 mb-4 text-[13.5px] text-ink2">
        {[student.grade ? `Class ${student.grade}` : '', BOARD_LABEL[student.board], student.school ?? ''].filter(Boolean).join(' · ')}
      </p>
      <StudentReport data={data} day={day} week={week} href={(d) => `/affiliate/students/${student.id}?day=${d}`} />
    </>
  );
}

/** Shaped like the loaded page: the name, then the report. */
function DaySkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 mb-4 h-4 w-40" />
      <StudentReportSkeleton />
    </>
  );
}

export default async function AffiliateStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const [{ id }, { day: raw }] = await Promise.all([params, searchParams]);
  const week = Array.from({ length: WEEK }, (_, back) => karachiDay(back));
  // Only a day inside the week on show; anything else is today.
  const day = raw && DAY_RE.test(raw) && week.includes(raw) ? raw : week[0];

  return (
    <>
      <BackLink href="/affiliate/students">Your students</BackLink>
      <Suspense key={`${id}-${day}`} fallback={<DaySkeleton />}>
        <StudentDayView id={id} day={day} week={week} />
      </Suspense>
    </>
  );
}
