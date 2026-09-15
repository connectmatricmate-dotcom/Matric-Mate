import Link from 'next/link';
import { studyTimeLabel, subjectById } from '@matricmate/core';
import type { StudentDay } from '@/lib/affiliates';
import { Panel, Row, Stat, StatGrid, Table, Tag, Td } from '@/components/admin/bits';
import { Skeleton } from '@/components/ui/primitives';

/** A YYYY-MM-DD day in words, read at noon in Karachi so it cannot slip a day. */
export const dayWords = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00+05:00`).toLocaleDateString('en-GB', { ...opts, timeZone: 'Asia/Karachi' });

/**
 * One student's day, as staff see it: the same daily report the student has
 * of themselves, the week at a glance, and a strip of days to step through.
 *
 * Shared by the teacher's page for one of their students and the
 * administrator's student page, so the two read the same numbers the same
 * way. `href` builds the link for another day of the week.
 *
 * A day with answers, sections or cards counts as opened even when no study
 * time arrived for it: "Not opened" beside twenty answered questions was a
 * teacher's first question about this page.
 */
export function StudentReport({ data, day, week, href }: { data: StudentDay; day: string; week: string[]; href: (day: string) => string }) {
  const { student, report, chapterTitles } = data;
  const accuracy = report.questions ? Math.round((report.correct / report.questions) * 100) : 0;
  const opened = report.opened || report.questions > 0 || report.sections > 0 || report.cards > 0;

  return (
    <>
      <nav aria-label="Day" className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
        {week.map((d, i) => (
          <Link
            key={d}
            href={href(d)}
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
        <Stat
          value={opened ? (report.seconds ? studyTimeLabel(report.seconds, 'en') : 'Opened') : 'Not opened'}
          label="Time in MatricMate"
          tone="teal"
        />
        <Stat value={`${report.correct}/${report.questions}`} label={report.questions ? `Questions right · ${accuracy}%` : 'Questions right'} tone="green" />
        <Stat value={report.sections.toLocaleString('en-PK')} label="Note sections read" />
        <Stat value={report.cards.toLocaleString('en-PK')} label="Flashcards learned" />
      </StatGrid>

      {!opened ? (
        <p className="mt-6 rounded-[12px] border border-line bg-card px-4 py-3 text-[13.5px] text-ink2">
          {student.name} did not open MatricMate on {dayWords(day, { weekday: 'long', day: 'numeric', month: 'long' })}.
        </p>
      ) : null}

      {report.subjects.length ? (
        <Panel title="By subject">
          <Table stack head={['Subject', 'Questions', 'Right', 'Score']}>
            {report.subjects.map((s) => (
              <Row key={s.subject}>
                <Td span className="font-extrabold">
                  {subjectById(s.subject)?.name ?? s.subject}
                </Td>
                <Td num label="Questions">
                  {s.questions}
                </Td>
                <Td num label="Right">
                  {s.correct}
                </Td>
                <Td num label="Score">
                  {s.questions ? `${Math.round((s.correct / s.questions) * 100)}%` : '·'}
                </Td>
              </Row>
            ))}
          </Table>
        </Panel>
      ) : null}

      {report.tests.length ? (
        <Panel title="Tests finished">
          <Table stack head={['Test', 'Score']}>
            {report.tests.map((x, i) => (
              <Row key={`${x.label}-${i}`}>
                <Td span>{x.label}</Td>
                <Td num label="Score" className="font-extrabold">
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
        <Table stack head={['Day', 'Opened', 'Time', 'Questions']}>
          {data.week.map(({ day: d, activity: a }) => (
            <Row key={d}>
              <Td num span className="font-extrabold">
                {dayWords(d, { weekday: 'short', day: 'numeric', month: 'short' })}
              </Td>
              <Td label="Opened">
                {!a ? '·' : a.studied ? <Tag tone="green">Studied</Tag> : a.opened ? <Tag tone="teal">Opened</Tag> : <Tag tone="grey">Not opened</Tag>}
              </Td>
              <Td num label="Time">
                {a?.opened ? (a.seconds ? studyTimeLabel(a.seconds, 'en') : '·') : '·'}
              </Td>
              <Td num label="Questions">
                {a?.questions ?? 0}
              </Td>
            </Row>
          ))}
        </Table>
      </Panel>
    </>
  );
}

/** Shaped like the loaded report: the day strip, four stats, a panel. */
export function StudentReportSkeleton() {
  return (
    <>
      <Skeleton className="mb-6 h-11 w-full max-w-[560px] rounded-full" />
      <StatGrid>
        {['a', 'b', 'c', 'd'].map((k) => (
          <div key={k} className="h-[80px] animate-pulse rounded-[16px] border border-line bg-card" />
        ))}
      </StatGrid>
      <div className="mt-7 h-[220px] animate-pulse rounded-[16px] border border-line bg-card" />
    </>
  );
}
