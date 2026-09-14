import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BOARD_LABEL, karachiDay, studyTimeLabel, subjectById } from '@matricmate/core';
import { referredStudentDay } from '@/lib/affiliates';
import { currentAffiliate } from '@/lib/affiliate-session';
import { BackLink, Panel, Row, Stat, StatGrid, Table, Tag, Td } from '@/components/admin/bits';
import { Skeleton } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

/** A week, today and the six days before it. */
const WEEK = 7;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD day in words, read at noon in Karachi so it cannot slip a day. */
const dayWords = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00+05:00`).toLocaleDateString('en-GB', { ...opts, timeZone: 'Asia/Karachi' });

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
  const { student, report, chapterTitles } = data;
  const accuracy = report.questions ? Math.round((report.correct / report.questions) * 100) : 0;

  return (
    <>
      <h1 className="font-display text-[26px] text-ink">{student.name}</h1>
      <p className="mt-0.5 text-[13.5px] text-ink2">
        {[student.grade ? `Class ${student.grade}` : '', BOARD_LABEL[student.board], student.school ?? ''].filter(Boolean).join(' · ')}
      </p>

      <nav aria-label="Day" className="-mx-1 mt-4 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
        {week.map((d, i) => (
          <Link
            key={d}
            href={`/affiliate/students/${student.id}?day=${d}`}
            aria-current={d === day ? 'page' : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-extrabold transition-colors duration-200 ${
              d === day ? 'bg-teal text-onbrand' : 'border border-line bg-card text-ink2 hover:border-teal hover:text-ink'
            }`}
          >
            {i === 0 ? 'Today' : i === 1 ? 'Yesterday' : dayWords(d, { weekday: 'short', day: 'numeric' })}
          </Link>
        ))}
      </nav>

      <StatGrid>
        <Stat value={report.opened ? studyTimeLabel(report.seconds, 'en') : 'Not opened'} label="Time in MatricMate" tone="teal" />
        <Stat value={`${report.correct}/${report.questions}`} label={report.questions ? `Questions right · ${accuracy}%` : 'Questions right'} tone="green" />
        <Stat value={report.sections.toLocaleString('en-PK')} label="Note sections read" />
        <Stat value={report.cards.toLocaleString('en-PK')} label="Flashcards learned" />
      </StatGrid>

      {!report.opened && !report.questions && !report.sections ? (
        <p className="mt-6 rounded-[12px] border border-line bg-card px-4 py-3 text-[13.5px] text-ink2">
          {student.name} did not open MatricMate on {dayWords(day, { weekday: 'long', day: 'numeric', month: 'long' })}.
        </p>
      ) : null}

      {report.subjects.length ? (
        <Panel title="By subject">
          <Table head={['Subject', 'Questions', 'Right', 'Score']}>
            {report.subjects.map((s) => (
              <Row key={s.subject}>
                <Td className="font-extrabold">{subjectById(s.subject)?.name ?? s.subject}</Td>
                <Td num>{s.questions}</Td>
                <Td num>{s.correct}</Td>
                <Td num>{s.questions ? `${Math.round((s.correct / s.questions) * 100)}%` : '·'}</Td>
              </Row>
            ))}
          </Table>
        </Panel>
      ) : null}

      {report.tests.length ? (
        <Panel title="Tests finished">
          <Table head={['Test', 'Score']}>
            {report.tests.map((x, i) => (
              <Row key={`${x.label}-${i}`}>
                <Td>{x.label}</Td>
                <Td num className="font-extrabold">
                  {x.score}/{x.total}
                </Td>
              </Row>
            ))}
          </Table>
        </Panel>
      ) : null}

      {report.chapters.length ? (
        <Panel title="Chapters worked in">
          <ul>
            {report.chapters.map((cid) => (
              <li key={cid} className="border-b border-line px-4 py-3 text-[13px] text-ink last:border-b-0">
                {chapterTitles.get(cid) ?? cid}
                <span className="ms-2 text-[12px] text-ink3">{subjectById(cid.split('-')[0])?.name ?? ''}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="The week">
        <Table head={['Day', 'Opened', 'Time', 'Questions']}>
          {data.week.map(({ day: d, activity: a }) => (
            <Row key={d}>
              <Td num>{dayWords(d, { weekday: 'short', day: 'numeric', month: 'short' })}</Td>
              <Td>{!a ? '·' : a.studied ? <Tag tone="green">Studied</Tag> : a.opened ? <Tag tone="teal">Opened</Tag> : <Tag tone="grey">Not opened</Tag>}</Td>
              <Td num>{a?.opened ? studyTimeLabel(a.seconds, 'en') : '·'}</Td>
              <Td num>{a?.questions ?? 0}</Td>
            </Row>
          ))}
        </Table>
      </Panel>
    </>
  );
}

/** Shaped like the loaded page: the name, the day strip, four stats, a panel. */
function DaySkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-40" />
      <Skeleton className="mt-4 mb-6 h-11 w-full max-w-[560px] rounded-full" />
      <StatGrid>
        {['a', 'b', 'c', 'd'].map((k) => (
          <div key={k} className="h-[80px] animate-pulse rounded-[16px] border border-line bg-card" />
        ))}
      </StatGrid>
      <div className="mt-7 h-[220px] animate-pulse rounded-[16px] border border-line bg-card" />
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
