'use client';

import type { Chapter, ChapterContent, PlayableTrack } from '@matricmate/core';
import { belongsToChapter, chapterBlurb, chapterName, hasStudyMaterial, isUrduScript, itemKey, offPaper, pickAudioTrack, subjectById, subjectMedium, subjectName } from '@matricmate/core';
import { LockedNotice } from '@/components/app/LockedNotice';
import { Actions, Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { Card, Empty, Item, Label, LinkBtn, Ring } from '@/components/ui/primitives';
import { useApp, useLang, useT } from '@/lib/store';

export function ChapterHub({
  chapter,
  content,
  tracks,
  paid,
}: {
  chapter: Chapter;
  content: ChapterContent;
  /** Empty until this chapter has really been recorded, and then the row hides. */
  tracks: PlayableTrack[];
  /** Whether the account has a plan, from the server. */
  paid: boolean;
}) {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  /* Both names in the student's language. The subject used to arrive from the
     server as an English prop and "Chapter 7" was built here in English, so an
     Urdu student read a Latin eyebrow above a Nastaliq title. */
  const subject = subjectName(subjectById(chapter.subjectId), lang);
  const eyebrow = `${subject} · ${t('study.chapterN', { n: chapter.number })}`;

  const id = chapter.id;
  /* The description in the student's language: the translated blurb where
     there is one. Where there is not, the Urdu interface shows none rather
     than the English one, which under an Urdu title read as the translation
     having been forgotten. */
  const rawBlurb = chapterBlurb(chapter, lang);
  const blurb = lang === 'ur' && !isUrduScript(rawBlurb) ? undefined : rawBlurb || undefined;

  /* No plan comes first. Row level security shows an account without one
     every chapter with no material at all, so the check below would call a
     full chapter "Nothing to revise here". The layout sends such an account
     to the plans page on a fresh load; this covers a plan that ran out while
     the app was open. */
  if (!paid) {
    return (
      <Page width="focus">
        <PageHead
          back={`/learn/subject/${chapter.subjectId}`}
          backLabel={subject}
          eyebrow={eyebrow}
          title={chapterName(chapter, lang)}
          titleUrdu={isUrduScript(chapterName(chapter, lang))}
          sub={blurb}
          subUrdu={!!blurb && isUrduScript(blurb)}
        />
        <LockedNotice body={t('billing.lockedBody')} cta={t('states.unlock')} />
      </Page>
    );
  }

  // Guards a direct link or an old bookmark to a chapter the board doesn't
  // examine: no notes, audio, flashcards, MCQs, short questions or blanks
  // exist for it, so there is nothing the usual grid could open.
  if (!hasStudyMaterial(chapter)) {
    return (
      <Page width="focus">
        <PageHead
          back={`/learn/subject/${chapter.subjectId}`}
          backLabel={subject}
          eyebrow={eyebrow}
          title={chapterName(chapter, lang)}
          titleUrdu={isUrduScript(chapterName(chapter, lang))}
          sub={blurb}
          subUrdu={!!blurb && isUrduScript(blurb)}
        />
        <Empty title={t('study.emptyChapterTitle')} sub={t('study.emptyChapterBody')} />
      </Page>
    );
  }
  /* The recording in the subject's own language. Urdu and English are
     recorded once, in their own language, so asking by the student's medium
     picked the wrong one, or none, for them. */
  const track = pickAudioTrack(tracks, subjectMedium(id, chapter.board, state.settings.contentMedium));
  /*
   * Read and known, whatever medium it was done in: ids carry the medium
   * (phy-1-en-s1, phy-1-ur-s1), and matched exactly a language switch reset
   * this page to "0 read" while the ring beside it said otherwise.
   */
  const readKeys = new Set(state.readSections.filter((s) => belongsToChapter(s, id)).map(itemKey));
  const readCount = content.sections.filter((s) => readKeys.has(itemKey(s.id))).length;
  const allRead = content.sections.length > 0 && readCount >= content.sections.length;
  // Every section read: read again, not "continue" to nothing.
  const readLabel = allRead ? t('study.readAgain') : readCount ? t('study.continueReading') : t('study.startReading');
  /*
   * Where "Continue reading" picks up, as on Android: the section they stopped
   * at when this is the chapter they were last in, else the first one not yet
   * read. It opened at section one, and paging on from there moved the resume
   * point back with it.
   */
  const resumeAt =
    state.lastChapterId === id
      ? Math.min(Math.max(state.lastSectionIndex, 0), Math.max(0, content.sections.length - 1))
      : Math.max(0, content.sections.findIndex((s) => !readKeys.has(itemKey(s.id))));
  const readHref = `/learn/reader/${id}${readCount && !allRead ? `?section=${resumeAt}` : ''}`;
  const knownKeys = new Set(state.cardsKnown.map(itemKey));
  const knownCards = content.flashcards.filter((f) => knownKeys.has(itemKey(f.id))).length;
  /*
   * The ring from this chapter's own counts, the Android hub's formula. The
   * shared chapterPct reads the browser's chapter index, which on a cold load
   * has no Punjab or Class 10 row yet: its divisor fell to one and three read
   * sections showed as 70%.
   */
  const sectionTotal = chapter.sectionCount || content.sections.length;
  const qTarget = Math.min(chapter.mcqCount || content.mcqs.length, 10);
  const answered = new Set(state.attempts.filter((a) => a.chapterId === id).map((a) => a.mcqId)).size;
  const pct = Math.min(
    100,
    Math.round(
      (sectionTotal ? (Math.min(readKeys.size, sectionTotal) / sectionTotal) * 70 : 0) + (qTarget ? (Math.min(answered, qTarget) / qTarget) * 30 : 0),
    ),
  );
  // Questions but no notes (a chapter part-way through being written): start
  // with the questions, as Android does. "Start reading" opened an empty reader.
  const noNotes = content.sections.length === 0 && content.mcqs.length > 0;
  // A best from a real set: one closed after a single right answer is "1/1",
  // a perfect score it did not earn.
  const best = state.results
    .filter((r) => r.chapterId === id && r.total >= 5)
    .sort((a, b) => b.score / b.total - a.score / a.total)[0];

  return (
    <Page>
      <PageHead
        back={`/learn/subject/${chapter.subjectId}`}
        backLabel={subject}
        eyebrow={eyebrow}
        title={chapterName(chapter, lang)}
        titleUrdu={isUrduScript(chapterName(chapter, lang))}
        sub={blurb}
        subUrdu={!!blurb && isUrduScript(blurb)}
        actions={
          <>
            {/* From md up only: on a phone the same button closes the page,
                and showing it in both places read as two different actions. */}
            <LinkBtn
              title={noNotes ? t('study.mcqs') : readLabel}
              href={noNotes ? `/session/setup?chapter=${id}` : readHref}
              sm
              className="max-md:hidden"
            />
          </>
        }
      />
      {/* The board's own weighting, front and centre: the single most useful
          planning number a student can have. Hidden when the table of
          specification gave none, never shown as a zero. */}
      {chapter.examShare ? (
        <p className="-mt-4 mb-5 text-[13px] font-extrabold text-orangedark">
          {/* Whole numbers: "About 6.48%" is more precise than the table it
              comes from, and "about" already says so. */}
          {chapter.examMarks
            ? t('study.examShareLong', { n: Math.round(chapter.examShare), m: chapter.examMarks })
            : t('study.examShare', { n: Math.round(chapter.examShare) })}
        </p>
      ) : offPaper(chapter) ? (
        /* The board gives this chapter no share of the paper. It stays open to
           read; nothing else steers the student here (see offPaper in core). */
        <p className="-mt-4 mb-5 flex items-start gap-1.5 text-[13px] leading-[1.55] text-ink2 rtl:leading-[1.9]">
          <span className="shrink-0 font-extrabold text-orangedark">{t('study.notOnPaper')}</span>
          <span>· {t('study.notOnPaperBody')}</span>
        </p>
      ) : null}

      <Split>
        <Work>
      <div className="mb-2">
        <Label>{t('study.sections')}</Label>
      </div>

      <Card flat className="py-0">
        <Item
          href={readHref}
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
          sub={derived.access.ai ? t('tutor.aiMade') : t('aiLock.short')}
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
              title={noNotes ? t('study.mcqs') : readLabel}
              href={noNotes ? `/session/setup?chapter=${id}` : readHref}
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
            <p className="mt-2 text-[13px] leading-[1.6] text-ink2 rtl:leading-[1.9]">
              {/* No notes counts as notes done: the questions are what there is. */}
              {readCount === 0 && !noNotes
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
