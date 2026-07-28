'use client';

import type { Chapter, ChapterContent } from '@matricmate/core';
import { chapterPct } from '@matricmate/core';
import { Actions, Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { IconButton } from '@/components/ui/controls';
import { Card, Item, Label, LinkBtn, Pill, Ring, Ur } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';

export function ChapterHub({
  chapter,
  content,
  subjectName,
}: {
  chapter: Chapter;
  content: ChapterContent;
  subjectName: string;
}) {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();

  const id = chapter.id;
  const pct = chapterPct(id, state.readSections, state.attempts);
  const downloaded = state.downloads.includes(id);
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
            <IconButton
              icon={downloaded ? 'check' : 'download'}
              tone={downloaded ? 'active' : 'card'}
              label={downloaded ? t('study.removedOffline') : t('study.saveOffline')}
              onClick={() => {
                actions.toggleDownload(id);
                toast(downloaded ? t('study.removedOffline') : t('study.saveOffline'));
              }}
            />
            <LinkBtn
              title={readCount ? t('study.continueReading') : t('study.startReading')}
              href={`/learn/reader/${id}`}
              sm
            />
          </>
        }
      />

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
        <Item
          href={`/learn/audio/${id}`}
          title={t('study.audio')}
          sub={t('study.audioSub', { n: chapter.audioMinutes })}
          icon="headphones"
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

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Pill tone={downloaded ? 'green' : 'grey'} icon={downloaded ? 'check' : 'download'}>
              {downloaded ? t('study.savedOffline') : t('study.notDownloaded')}
            </Pill>
            <Pill tone="grey">≈ 2 MB</Pill>
          </div>

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
              <p className="text-[13.5px] font-extrabold text-ink">This chapter</p>
              <p className="text-[12.5px] text-ink2">
                {readCount} of {content.sections.length} sections read
              </p>
            </div>
          </Card>

          <Card flat>
            <Label>Up next</Label>
            <p className="mt-2 text-[13px] leading-[1.6] text-ink2">
              {readCount === 0
                ? 'Start with the notes. The MCQs draw from the same sections.'
                : readCount < content.sections.length
                  ? 'Finish the notes, then try the chapter MCQs while it’s fresh.'
                  : 'Notes done. A timed test is the fastest way to find what didn’t stick.'}
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
