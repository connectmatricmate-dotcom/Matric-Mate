import { useEffect, useState } from 'react';
import { ActivityIndicator, Text , View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Empty, ErrorState, H2, Header, IconButton, Item, Pill, Row, Screen, SectionTitle, Skeleton, Small, Spacer, Ur, useToast } from '../../../src/components/ui';
import { api , chapterPct, hasStudyMaterial , isUrduScript, pickAudioTrack, subjectById, subjectName } from '@matricmate/core';
import { chapterDownloadBytes, formatBytes, localAudioTrack, localChapter } from '../../../src/core/downloads';
import { Confetti, Pop } from '../../../src/components/celebration';
import { LockedNotice } from '../../../src/components/LockedNotice';
import { cheer } from '../../../src/core/haptics';
import { useAsync } from '../../../src/core/useAsync';
import { useLang, useT } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { C, F, S, alpha } from '../../../src/theme';

export default function ChapterHub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { data: fetchedChapter, loading: chapterLoading } = useAsync(() => api.getChapter(id), [id]);
  /* With no signal the catalogue cannot answer for a Class 10 chapter, because
     the bundle is Class 9. The row saved with the download can, which is what
     keeps a downloaded chapter openable on a bus. */
  const chapter = fetchedChapter ?? localChapter(id) ?? undefined;
  const { data: content, reload: reloadContent } = useAsync(() => api.getChapterContent(id), [id]);
  const { data: tracks } = useAsync(() => api.getAudioTracks(id), [id]);
  // No row, no row in the grid: a chapter offers an audio lesson only once one
  // has really been recorded and published. Offline the fetch returns nothing,
  // so the copy saved with the download answers instead and a downloaded
  // chapter keeps offering the lesson that is sitting on the phone.
  const audio =
    pickAudioTrack(tracks ?? [], state.settings.contentMedium) ??
    localAudioTrack(id, state.settings.contentMedium);
  /**
   * The 100% moment, once per chapter, ever. A student who clears a chapter
   * deserves a bigger beat than a full progress ring; a student re-visiting
   * a cleared chapter deserves not to be confettied every time.
   */
  const justCleared = chapterPct(id, state.readSections, state.attempts) >= 100 && !state.celebratedChapters.includes(id);
  useEffect(() => {
    if (justCleared) {
      cheer();
      actions.markChapterCelebrated(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCleared, id]);


  // While the chapter row is still on its way, the screen used to paint the
  // full layout with every text slot blank: a teal card with nothing in it,
  // which on a slow connection read as a broken chapter rather than a loading
  // one. Skeletons, like the subject list already shows.
  if (!chapter && chapterLoading) {
    return (
      <Screen>
        <Header title=" " back />
        <View style={{ gap: S.md }}>
          <Skeleton h={120} />
          <Skeleton w="40%" h={14} />
          <Skeleton h={64} />
          <Skeleton h={64} />
          <Skeleton h={64} />
        </View>
      </Screen>
    );
  }

  /**
   * Paid-only gate, before any content fetch. Without a plan the RLS wall
   * returns empty content anyway; fetching and rendering that would read as
   * "broken chapter". What an unpaid student should meet is the shelf card,
   * what is inside, and the plain-text route to a plan, which is exactly
   * what LockedNotice is allowed to say on Play.
   */
  const locked = !!chapter && chapter.premium && !state.premium.active;
  if (locked) {
    return (
      <Screen>
        <Header title={t('study.chapterN', { n: chapter.number })} sub={subjectName(subjectById(chapter.subjectId), lang)} back />
        <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
          {state.settings.language === 'ur' && chapter.urduTitle ? (
            <Ur size={20} style={{ color: C.onBrand }}>{chapter.urduTitle}</Ur>
          ) : (
            <H2 style={{ color: C.onBrand }}>{chapter.title}</H2>
          )}
          {isUrduScript(chapter.blurb) ? (
            <Ur size={13} style={{ color: alpha(C.onBrand, 0.92), marginTop: 4 }}>{chapter.blurb}</Ur>
          ) : (
            <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 21, color: alpha(C.onBrand, 0.92), marginTop: 4 }}>
              {chapter.blurb}
            </Text>
          )}
        </Card>
        <Spacer h={S.md} />
        <Card flat style={{ paddingVertical: 0 }}>
          <Item title={t('study.notes')} sub={t('study.sectionsSub', { n: chapter.sectionCount })} icon="book" />
          <Item title={t('study.mcqs')} sub={t('study.mcqsSub', { n: chapter.mcqCount })} icon="target" />
          <Item title={t('study.flashcards')} sub={t('study.flashcardsSub', { n: chapter.flashcardCount, known: 0 })} icon="cards" last />
        </Card>
        <Spacer h={S.md} />
        <LockedNotice variant="locked" />
      </Screen>
    );
  }

  /**
   * The chapter row says there is material and the content read came back with
   * none of it, so the read failed.
   *
   * The fetch layer never throws: an error, a null and an empty array all
   * return the bundled sample, which is empty content for all but three
   * chapters. So the hub rendered "0 sections, 0 cards, 0 questions" beside
   * rows that were still tappable, contradicting the "8 MCQs" the student had
   * just seen on the subject list. The counts on the row are the second
   * opinion that catches it.
   */
  const contentFailed =
    !!chapter && !!content && hasStudyMaterial(chapter) &&
    !content.sections.length && !content.mcqs.length && !content.flashcards.length;
  if (contentFailed) {
    return (
      <Screen>
        <Header title={t('study.chapterN', { n: chapter.number })} sub={subjectName(subjectById(chapter.subjectId), lang)} back />
        <Spacer h={S.lg} />
        <ErrorState
          title={t('states.errorTitle')}
          sub={t('states.errorBody')}
          retry={t('common.retry')}
          onRetry={reloadContent}
        />
      </Screen>
    );
  }

  // Guards a direct link or an old bookmark to a chapter the board doesn't
  // examine: no notes, audio, flashcards, MCQs, short questions or blanks
  // exist for it, so there is nothing the usual grid could open.
  if (chapter && !hasStudyMaterial(chapter)) {
    return (
      <Screen>
        <Header title={t('study.chapterN', { n: chapter.number })} sub={subjectName(subjectById(chapter.subjectId), lang)} back />
        <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
          {state.settings.language === 'ur' && chapter.urduTitle ? (
            <Ur size={20} style={{ color: C.onBrand }}>{chapter.urduTitle}</Ur>
          ) : (
            <H2 style={{ color: C.onBrand }}>{chapter.title}</H2>
          )}
          {isUrduScript(chapter.blurb) ? (
            <Ur size={13} style={{ color: alpha(C.onBrand, 0.92), marginTop: 4 }}>{chapter.blurb}</Ur>
          ) : (
            <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 21, color: alpha(C.onBrand, 0.92), marginTop: 4 }}>
              {chapter.blurb}
            </Text>
          )}
        </Card>
        <Spacer h={S.lg} />
        <Empty title={t('study.emptyChapterTitle')} sub={t('study.emptyChapterBody')} />
      </Screen>
    );
  }

  const pct = chapterPct(id, state.readSections, state.attempts);
  const downloaded = state.downloads.includes(id);


  async function toggleDownload() {
    setBusy(true);
    const result = await actions.toggleDownload(id);
    setBusy(false);
    if (result === 'downloaded') toast(t('study.saveOffline'));
    else if (result === 'removed') toast(t('study.removedOffline'));
    else toast(t('downloads.saveFailed'));
  }
  const readCount = content ? content.sections.filter((s) => state.readSections.includes(s.id)).length : 0;
  const best = state.results.filter((r) => r.chapterId === id).sort((a, b) => (b.total ? b.score / b.total : 0) - (a.total ? a.score / a.total : 0))[0];
  const knownCards = content ? content.flashcards.filter((f) => state.cardsKnown.includes(f.id)).length : 0;

  return (
    <Screen
      footer={
        <Btn
          title={readCount ? t('study.continueReading') : t('study.startReading')}
          onPress={() => router.push(`/learn/reader/${id}`)}
        />
      }
    >
      {justCleared ? <Confetti /> : null}
      {justCleared ? (
        <Pop>
          <Card flat tint={C.greenTint} border={C.green} style={{ alignItems: 'center', paddingVertical: 12, marginBottom: S.sm }}>
            <Text style={{ fontFamily: F.display, fontSize: 17, color: C.green }}>{t('study.chapterCleared')}</Text>
          </Card>
        </Pop>
      ) : null}
      <Header
        title={chapter ? t('study.chapterN', { n: chapter.number }) : ' '}
        sub={chapter ? subjectName(subjectById(chapter.subjectId), lang) : ' '}
        back
        right={
          busy ? (
            <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={C.teal} />
            </View>
          ) : (
            // Keyed on the state, so the icon swap replays the pop: saving a
            // chapter visibly lands instead of just recolouring.
            <Pop key={downloaded ? 'saved' : 'unsaved'}>
              <IconButton icon={downloaded ? 'check' : 'download'} tone={downloaded ? 'active' : 'card'} onPress={toggleDownload} />
            </Pop>
          )
        }
      />

      <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
        {state.settings.language === 'ur' && chapter?.urduTitle ? (
          <Ur size={20} style={{ color: C.onBrand }}>{chapter.urduTitle}</Ur>
        ) : (
          <H2 style={{ color: C.onBrand }}>{chapter?.title ?? ''}</H2>
        )}
        {/* The board's own weighting, front and centre: it is the single most
            useful planning number a student can have. Hidden when the table
            of specification gave none, never shown as a zero. */}
        {chapter?.examShare ? (
          <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: C.orange, marginTop: 6 }}>
            {chapter.examMarks
              ? t('study.examShareLong', { n: chapter.examShare, m: chapter.examMarks })
              : t('study.examShare', { n: chapter.examShare })}
          </Text>
        ) : null}
        {isUrduScript(chapter?.blurb ?? '') ? (
          <Ur size={13} style={{ color: alpha(C.onBrand, 0.92), marginTop: 4 }}>{chapter?.blurb}</Ur>
        ) : (
          <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 21, color: alpha(C.onBrand, 0.92), marginTop: 4 }}>
            {chapter?.blurb}
          </Text>
        )}
        <Row gap={S.md} style={{ marginTop: S.md }}>
          <View style={{ flex: 1, height: 7, backgroundColor: alpha(C.onBrand, 0.25), borderRadius: 99, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.orange, borderRadius: 99 }} />
          </View>
          <Text style={{ fontFamily: F.display, fontSize: 15, color: C.onBrand }}>{pct}%</Text>
        </Row>
      </Card>

      <Spacer h={S.lg} />
      <Small style={{ fontFamily: F.bodyBold, marginBottom: S.sm }}>{t('study.sections')}</Small>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item
          title={t('study.notes')}
          sub={content ? t('study.notesSub', { n: content.sections.length, read: readCount }) : t('common.loading')}
          icon="book"
          pct={content?.sections.length ? (readCount / content.sections.length) * 100 : 0}
          onPress={() => router.push(`/learn/reader/${id}`)}
        />
        {audio ? (
          <Item
            title={t('study.audio')}
            sub={t('study.audioSub', { n: Math.max(1, Math.round(audio.durationSecs / 60)) })}
            icon="headphones"
            onPress={() => router.push(`/learn/audio/${id}`)}
          />
        ) : null}
        <Item
          title={t('tutor.sheetMake')}
          sub={t('tutor.aiMade')}
          icon="spark"
          onPress={() => router.push(`/learn/sheet/${id}`)}
        />
        <Item
          title={t('study.flashcards')}
          sub={content ? t('study.flashcardsSub', { n: content.flashcards.length, known: knownCards }) : ''}
          icon="cards"
          onPress={() => router.push(`/session/flashcards?chapter=${id}`)}
        />
        <Item
          title={t('study.mcqs')}
          sub={
            content
              ? best
                ? t('study.mcqsBest', { n: content.mcqs.length, score: `${best.score}/${best.total}` })
                : t('study.mcqsSub', { n: content.mcqs.length })
              : ''
          }
          icon="target"
          onPress={() => router.push(`/session/setup?chapter=${id}`)}
        />
        <Item
          title={t('study.shortQ')}
          sub={content ? t('study.shortQSub', { n: content.shortQs.length }) : ''}
          icon="quill"
          onPress={() => router.push(`/session/shortq?chapter=${id}`)}
        />
        <Item
          title={t('study.blanks')}
          sub={content ? t('study.blanksSub', { n: content.blanks.length }) : ''}
          icon="edit"
          last
          onPress={() => router.push(`/session/blanks?chapter=${id}`)}
        />
      </Card>

      {/* What to do next, which the website's chapter hub has had and this
          did not. The advice is not decoration: it follows how much of the
          chapter has actually been read, and the button changes with it, so
          a student who has finished the notes is sent to the chapter test
          rather than back into practice. */}
      {content ? (
        <>
          <SectionTitle>{t('study.upNext')}</SectionTitle>
          <Card flat>
            <Small style={{ color: C.ink }}>
              {readCount === 0
                ? t('study.coachStart')
                : readCount < content.sections.length
                  ? t('study.coachKeepGoing')
                  : t('study.coachDone')}
            </Small>
            <Spacer h={S.sm} />
            <Btn
              title={readCount >= content.sections.length ? t('study.chapterTest') : t('study.mcqs')}
              variant="line"
              sm
              onPress={() =>
                router.push(
                  readCount >= content.sections.length
                    ? `/session/exam-intro?chapter=${id}`
                    : `/session/setup?chapter=${id}`,
                )
              }
            />
          </Card>
        </>
      ) : null}

      <Spacer h={S.lg} />
      <Row gap={S.sm}>
        <Pill tone={downloaded ? 'green' : 'grey'} icon={downloaded ? 'check' : 'download'}>
          {downloaded ? t('study.savedOffline') : t('study.notDownloaded')}
        </Pill>
        {downloaded ? <Pill tone="grey">{formatBytes(chapterDownloadBytes(id))}</Pill> : null}
      </Row>
    </Screen>
  );
}
