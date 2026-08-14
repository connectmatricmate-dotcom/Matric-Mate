'use client';

import type { Chapter, ChapterContent, PlayableTrack } from '@matricmate/core';
import { chapterPct, hasStudyMaterial, pickAudioTrack } from '@matricmate/core';
import { Actions, Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { Card, Empty, Item, Label, LinkBtn, Ring, Ur } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

export function ChapterHub({
  chapter,
  content,
  subjectName,
  tracks,
}: {
  chapter: Chapter;
  content: ChapterContent;
  subjectName: string;
  /** Empty until this chapter has really been recorded, and then the row hides. */
  tracks: PlayableTrack[];
}) {
  const { state } = useApp();
  const t = useT();

  const id = chapter.id;

  // Guards a direct link or an old bookmark to a chapter the board doesn't
  // examine: no notes, audio, flashcards, MCQs, short questions or blanks
  // exist for it, so there is nothing the usual grid could open.
  if (!hasStudyMaterial(chapter)) {
    return (
      <Page width="focus">
        <PageHead
          back={`/learn/subject/${chapter.subjectId}`}
          backLabel={subjectName}
          eyebrow={`${subjectName} · Chapter ${chapter.number}`}
          title={chapter.title}
          urduTitle={
            chapter.urduTitle ? (
              <p className="mt-1">
                <Ur className="text-[15px] text-ink2">{chapter.urduTitle}</Ur>
              </p>
            ) : undefined
          }
          sub={chapter.blurb}
        />
        <Empty title={t('study.emptyChapterTitle')} sub={t('study.emptyChapterBody')} />
      </Page>
    );
  }
  const track = pickAudioTrack(tracks, state.settings.contentMedium);
  const pct = chapterPct(id, state.readSections, state.attempts);
  const readCount = content.sections.filter((s) => state.readSections.includes(s.id)).length;
  const knownCards = content.flashcards.filter((f) => state.cardsKnown.includes(f.id)).length;
  const best = state.results
    .filter((r) => r.chapterId === id)
    .sort((a, b) => b.score / b.total - a.score / a.total)[0];

  return (
    <Page>
      <PageHead
        back={`/learn/subject/${chapter.subjectId}`}
        backLabel={subjectName}
        eyebrow={`${subjectName} · Chapter ${chapter.number}`}
        title={chapter.title}
        urduTitle={chapter.urduTitle ? <p className="mt-1"><Ur className="text-[15px] text-ink2">{chapter.urduTitle}</Ur></p> : undefined}
        sub={chapter.blurb}
        actions={
          <>
            <LinkBtn
              title={readCount ? t('study.continueReading') : t('study.startReading')}
              href={`/learn/reader/${id}`}
              sm
            />
          </>
        }
      />
      {/* The board's own weighting, front and centre: the single most useful
          planning number a student can have. Hidden when the table of
          specification gave none, never shown as a zero. */}
      {chapter.examShare ? (
        <p className="-mt-4 mb-5 text-[13px] font-extrabold text-orangedark">
          {chapter.examMarks
            ? t('study.examShareLong', { n: chapter.examShare, m: chapter.examMarks })
            : t('study.examShare', { n: chapter.examShare })}
        </p>
      ) : null}

      <Split>
        <Work>
      <div className="mb-2">
        <Label>{t('study.sections')}</Label>
      </div>

      <Card flat className="py-0">
        <Item
          href={`/learn/reader/${id}`}
          title={t('study.notes')}
          sub={t('study.notesSub', { n: content.sections.length, read: readCount })}
          icon="book"
          pct={content.sections.length ? (readCount / content.sections.length) * 100 : 0}
        />
        {track ? (
          <Item
            href={`/learn/audio/${id}`}
            title={t('study.audio')}
            sub={t('study.audioSub', { n: Math.max(1, Math.round(track.durationSecs / 60)) })}
            icon="headphones"
          />
        ) : null}
        <Item
          href={`/learn/sheet/${id}`}
          title={t('tutor.sheetMake')}
          sub={t('tutor.aiMade')}
          icon="spark"
        />
        <Item
          href={`/session/flashcards?chapter=${id}`}
          title={t('study.flashcards')}
          sub={t('study.flashcardsSub', { n: content.flashcards.length, known: knownCards })}
          icon="cards"
        />
        <Item
          href={`/session/setup?chapter=${id}`}
          title={t('study.mcqs')}
          sub={
            best
              ? t('study.mcqsBest', { n: content.mcqs.length, score: `${best.score}/${best.total}` })
              : t('study.mcqsSub', { n: content.mcqs.length })
          }
          icon="target"
        />
        <Item
          href={`/session/shortq?chapter=${id}`}
          title={t('study.shortQ')}
          sub={t('study.shortQSub', { n: content.shortQs.length })}
          icon="quill"
        />
        <Item
          href={`/session/blanks?chapter=${id}`}
          title={t('study.blanks')}
          sub={t('study.blanksSub', { n: content.blanks.length })}
          icon="edit"
          last
        />
      </Card>

          <Actions>
            <LinkBtn
              title={readCount ? t('study.continueReading') : t('study.startReading')}
              href={`/learn/reader/${id}`}
              className="md:hidden"
            />
          </Actions>
        </Work>

        <Rail>
          <Card flat className="flex items-center gap-4">
            <Ring pct={pct} size={68} stroke={8}>
              <span className="font-display text-[16px] text-ink tabular">{pct}%</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold text-ink">{t('study.thisChapter')}</p>
              <p className="text-[12.5px] text-ink2">
                {t('study.sectionsRead', { read: readCount, total: content.sections.length })}
              </p>
            </div>
          </Card>

          <Card flat>
            <Label>{t('study.upNext')}</Label>
            <p className="mt-2 text-[13px] leading-[1.6] text-ink2">
              {readCount === 0
                ? t('study.coachStart')
                : readCount < content.sections.length
                  ? t('study.coachKeepGoing')
                  : t('study.coachDone')}
            </p>
            <LinkBtn
              title={readCount >= content.sections.length ? t('study.chapterTest') : t('study.mcqs')}
              href={
                readCount >= content.sections.length
                  ? `/session/exam-intro?chapter=${id}`
                  : `/session/setup?chapter=${id}`
              }
              variant="line"
              sm
              className="mt-3"
            />
          </Card>
        </Rail>
      </Split>
    </Page>
  );
}
