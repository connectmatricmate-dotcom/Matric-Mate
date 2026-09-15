import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Empty, ErrorState, H2, Header, IconButton, Item, Pill, Row, Screen, SectionTitle, Skeleton, Small, Spacer, Text, Ur } from '../../../src/components/ui';
import {
  api,
  belongsToChapter,
  chapterBlurb,
  contentFor,
  hasStudyMaterial,
  isAuthored,
  isUrduScript,
  itemKey,
  pickAudioTrack,
  subjectById,
  subjectMedium,
  subjectName,
  subjectOpen,
} from '@matricmate/core';
import type { Chapter } from '@matricmate/core';
import { chapterDownloadBytes, formatBytes, localAudioTrack, localChapter } from '../../../src/core/downloads';
import { Confetti, Pop } from '../../../src/components/celebration';
import { useChapterDownload } from '../../../src/components/ChapterDownload';
import { LockedNotice } from '../../../src/components/LockedNotice';
import { useOnline } from '../../../src/core/connectivity';
import { cheer } from '../../../src/core/haptics';
import { useAsync } from '../../../src/core/useAsync';
import { useLang, useT } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { C, F, S, alpha, isRTL } from '../../../src/theme';

/** A row whose counts mean something: a live row, or one with counts in it. The bundled catalogue has zeroes and no board. */
const countsKnown = (c: Chapter): boolean => c.board !== undefined || hasStudyMaterial(c);

export default function ChapterHub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions, contentKey, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const online = useOnline();
  const download = useChapterDownload(id);
  // contentKey in every read: a language, class or board switch reaches an
  // open chapter instead of leaving it on the old one until it is reopened.
  const { data: fetchedChapter, loading: chapterLoading } = useAsync(() => api.getChapter(id), [id, contentKey]);
  /*
   * With no signal the catalogue cannot answer for a Class 10 chapter, because
   * the bundle is Class 9. The row saved with the download can, which is what
   * keeps a downloaded chapter openable on a bus. And it wins over a fetched
   * row with no counts in it: offline or on a slow read FBISE Class 9 got the
   * bundle's zero-count row, and a chapter sitting on the phone said
   * "Nothing to revise here".
   */
  const saved = localChapter(id) ?? undefined;
  const chapter = (fetchedChapter && countsKnown(fetchedChapter) ? fetchedChapter : (saved ?? fetchedChapter)) ?? undefined;
  const { data: content, reload: reloadContent } = useAsync(() => api.getChapterContent(id), [id, contentKey]);
  const { data: tracks } = useAsync(() => api.getAudioTracks(id), [id, contentKey]);
  // No row, no row in the grid: a chapter offers an audio lesson only once one
  // has really been recorded and published. Offline the fetch returns nothing,
  // so the copy saved with the download answers instead and a downloaded
  // chapter keeps offering the lesson that is sitting on the phone. Picked in
  // the subject's own language: an Urdu subject's lesson is Urdu for everyone.
  const trackMedium = subjectMedium(id, state.onboarding?.board, state.settings.contentMedium);
  const audio = pickAudioTrack(tracks ?? [], trackMedium) ?? localAudioTrack(id, trackMedium);

  /**
   * Progress from this chapter's own counts, the row resolved above and the
   * content loaded here, not from the synchronous index.
   *
   * The shared chapterPct reads the index, which offline has nothing for a
   * Class 10 chapter and zeroes for an FBISE Class 9 one, so its divisors fell
   * to one: a single read section and a single answer made 100%, and used up
   * the chapter's one celebration for good. Null when the counts are unknown,
   * which shows no figure and celebrates nothing.
   */
  const sectionTotal = (chapter && countsKnown(chapter) ? chapter.sectionCount : 0) || content?.sections.length || 0;
  const mcqTotal = (chapter && countsKnown(chapter) ? chapter.mcqCount : 0) || content?.mcqs.length || 0;
  const readKeys = new Set(state.readSections.filter((s) => belongsToChapter(s, id)).map(itemKey));
  const answered = new Set(state.attempts.filter((a) => a.chapterId === id).map((a) => a.mcqId)).size;
  const qTarget = Math.min(mcqTotal, 10);
  const pct: number | null =
    sectionTotal || qTarget
      ? Math.min(
          100,
          Math.round(
            (sectionTotal ? (Math.min(readKeys.size, sectionTotal) / sectionTotal) * 70 : 0) +
              (qTarget ? (Math.min(answered, qTarget) / qTarget) * 30 : 0),
          ),
        )
      : null;
  /**
   * The 100% moment, once per chapter, ever. A student who clears a chapter
   * deserves a bigger beat than a full progress ring; a student re-visiting
   * a cleared chapter deserves not to be confettied every time. Only with
   * real counts behind it, and only for a chapter this screen will show.
   */
  const justCleared =
    pct !== null && pct >= 100 && !!chapter && hasStudyMaterial(chapter) && !state.celebratedChapters.includes(id);
  /*
   * The burst, held here rather than read off the store, as the dashboard's
   * streak burst is: marking the chapter celebrated lands in the same commit
   * that mounts the confetti, so reading `justCleared` for it unmounted the
   * pieces before a frame of them ran. Latched while rendering, let go when
   * the pieces are done.
   */
  const [burst, setBurst] = useState(false);
  if (justCleared && !burst) setBurst(true);
  useEffect(() => {
    if (justCleared) {
      cheer();
      actions.markChapterCelebrated(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCleared, id]);
  useEffect(() => {
    if (!burst) return;
    const timer = setTimeout(() => setBurst(false), 2400);
    return () => clearTimeout(timer);
  }, [burst]);


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

  // No row at all once the read has settled: offline on a chapter that is not
  // on the phone, or an id this syllabus does not have (an old link, or one
  // from before a board or class change). A blank teal card said neither.
  if (!chapter) {
    return (
      <Screen>
        <Header title=" " back />
        <Spacer h={S.lg} />
        {!online ? (
          <ErrorState title={t('offline.title')} sub={t('offline.sub')} retry={t('common.retry')} onRetry={reloadContent} />
        ) : (
          <Empty emoji="🔍" title={t('states.notFoundTitle')} sub={t('states.notFoundBody')} />
        )}
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
  /*
   * Also locked, not empty: an account with no plan reads zero counts on
   * every chapter under row level security, and the empty-chapter screen
   * below told it "Nothing to revise here" about a chapter full of notes.
   */
  // A free trial opens one subject: this chapter may belong to another.
  const shutByTrial = !!chapter && derived.access.tier === 'trial' && !subjectOpen(derived.access, chapter.subjectId);
  const locked = !!chapter && ((!state.premium.active && (chapter.premium || !hasStudyMaterial(chapter))) || shutByTrial);
  const blurb = chapter ? chapterBlurb(chapter, lang) : '';
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
          {isUrduScript(blurb) ? (
            <Ur size={13} style={{ color: alpha(C.onBrand, 0.92), marginTop: 4 }}>{blurb}</Ur>
          ) : (
            // A Latin blurb keeps the Latin face in the Urdu interface: in
            // Nastaliq this line height cut its descenders (see F.latin).
            <Text style={{ fontFamily: F.latin.body, fontSize: 13, lineHeight: 21, color: alpha(C.onBrand, 0.92), marginTop: 4 }}>
              {blurb}
            </Text>
          )}
        </Card>
        <Spacer h={S.md} />
        {/* The counts, when they are known. Under a trial's lock they read
            zero (the database counts nothing it will not serve), which would
            say the chapter is empty; the notice alone is the truth. */}
        {shutByTrial ? null : (
          <>
            <Card flat style={{ paddingVertical: 0 }}>
              <Item title={t('study.notes')} sub={t('study.sectionsSub', { n: chapter.sectionCount })} icon="book" />
              <Item title={t('study.mcqs')} sub={t('study.mcqsSub', { n: chapter.mcqCount })} icon="target" />
              <Item title={t('study.flashcards')} sub={t('study.flashcardsSub', { n: chapter.flashcardCount, known: 0 })} icon="cards" last />
            </Card>
            <Spacer h={S.md} />
          </>
        )}
        <LockedNotice />
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
    ((!content.sections.length && !content.mcqs.length && !content.flashcards.length) ||
      // The bundled FBISE sample standing in for a live chapter whose read
      // failed: shown as if it were the chapter, it synced sample section ids
      // as read. A live row (it has a board) never has the sample for content.
      (chapter.board !== undefined && isAuthored(id) && content === contentFor(id)));
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
  // exist for it, so there is nothing the usual grid could open. Only when the
  // row can say so: a zero-count row from the bundle knows nothing, and the
  // content read below decides instead.
  const nothingInIt =
    !!chapter && countsKnown(chapter) === false
      ? !!content && !content.sections.length && !content.mcqs.length && !content.flashcards.length
      : !!chapter && !hasStudyMaterial(chapter);
  if (chapter && nothingInIt) {
    return (
      <Screen>
        <Header title={t('study.chapterN', { n: chapter.number })} sub={subjectName(subjectById(chapter.subjectId), lang)} back />
        <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
          {state.settings.language === 'ur' && chapter.urduTitle ? (
            <Ur size={20} style={{ color: C.onBrand }}>{chapter.urduTitle}</Ur>
          ) : (
            <H2 style={{ color: C.onBrand }}>{chapter.title}</H2>
          )}
          {isUrduScript(blurb) ? (
            <Ur size={13} style={{ color: alpha(C.onBrand, 0.92), marginTop: 4 }}>{blurb}</Ur>
          ) : (
            // Latin face for a Latin blurb, as above.
            <Text style={{ fontFamily: F.latin.body, fontSize: 13, lineHeight: 21, color: alpha(C.onBrand, 0.92), marginTop: 4 }}>
              {blurb}
            </Text>
          )}
        </Card>
        <Spacer h={S.lg} />
        {/* Offline, a chapter that is not on the phone is not an empty one. */}
        {!online && !download.listed ? (
          <ErrorState title={t('offline.title')} sub={t('offline.sub')} retry={t('common.retry')} onRetry={reloadContent} />
        ) : (
          <Empty title={t('study.emptyChapterTitle')} sub={t('study.emptyChapterBody')} />
        )}
      </Screen>
    );
  }

  // Read in either medium counts once, as it does for progress everywhere else.
  const readCount = content ? content.sections.filter((s) => readKeys.has(itemKey(s.id))).length : 0;
  // A best from a real set: one closed after a single right answer is "1/1",
  // a perfect score it did not earn.
  const best = state.results
    .filter((r) => r.chapterId === id && r.total >= 5)
    .sort((a, b) => b.score / b.total - a.score / a.total)[0];
  const knownKeys = new Set(state.cardsKnown.map(itemKey));
  const knownCards = content ? content.flashcards.filter((f) => knownKeys.has(itemKey(f.id))).length : 0;
  const noNotes = !!content && content.sections.length === 0;
  /**
   * Where "Continue reading" picks up: the section they stopped at when this
   * is the chapter they were last in, else the first one not yet read. It
   * always opened at section one.
   */
  // Every section read: read again from the start, not "continue" to nothing.
  const allRead = !!content && content.sections.length > 0 && readCount >= content.sections.length;
  const readLabel = allRead ? t('study.readAgain') : readCount ? t('study.continueReading') : t('study.startReading');
  const resumeAt = content
    ? state.lastChapterId === id
      ? Math.min(Math.max(state.lastSectionIndex, 0), Math.max(0, content.sections.length - 1))
      : Math.max(0, content.sections.findIndex((s) => !readKeys.has(itemKey(s.id))))
    : 0;

  return (
    <Screen
      footer={
        // A chapter with questions and no notes starts with the questions:
        // "Start reading" opened an empty reader.
        noNotes && content?.mcqs.length ? (
          <Btn title={t('study.mcqs')} onPress={() => router.push(`/session/setup?chapter=${id}`)} />
        ) : (
          <Btn
            title={readLabel}
            onPress={() => router.push(`/learn/reader/${id}${readCount && !allRead ? `?section=${resumeAt}` : ''}`)}
          />
        )
      }
    >
      {burst ? <Confetti /> : null}
      {burst ? (
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
          download.busy ? (
            <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={C.teal} />
            </View>
          ) : (
            // Keyed on the state, so the icon swap replays the pop: saving a
            // chapter visibly lands instead of just recolouring. A tick only
            // for a copy that opens in this language; a copy saved in the
            // other one downloads again. Removing asks first.
            <Pop key={download.readable ? 'saved' : 'unsaved'}>
              <IconButton
                icon={download.readable ? 'check' : 'download'}
                tone={download.readable ? 'active' : 'card'}
                label={t(download.readable ? 'study.removeOffline' : 'study.saveOffline')}
                onPress={download.press}
              />
            </Pop>
          )
        }
      />
      {download.confirm}

      <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
        {state.settings.language === 'ur' && chapter?.urduTitle ? (
          <Ur size={20} style={{ color: C.onBrand }}>{chapter.urduTitle}</Ur>
        ) : (
          <H2 style={{ color: C.onBrand }}>{chapter?.title ?? ''}</H2>
        )}
        {/* The board's own weighting, front and centre: it is the single most
            useful planning number a student can have. Hidden when the table
            of specification gave none, never shown as a zero. On its own
            tint, not as orange type on the teal: that pairing measured under
            2:1 and the number was the hardest thing on the card to read. It
            starts where the title does, which is the right edge in Urdu. */}
        {chapter?.examShare ? (
          <Pill tone="orange" style={{ marginTop: 8, alignSelf: isRTL() ? 'flex-end' : 'flex-start' }}>
            {chapter.examMarks
              ? t('study.examShareLong', { n: chapter.examShare, m: chapter.examMarks })
              : t('study.examShare', { n: chapter.examShare })}
          </Pill>
        ) : null}
        {isUrduScript(blurb) ? (
          <Ur size={13} style={{ color: alpha(C.onBrand, 0.92), marginTop: 4 }}>{blurb}</Ur>
        ) : (
          // Latin face for a Latin blurb, as on the locked card above.
          <Text style={{ fontFamily: F.latin.body, fontSize: 13, lineHeight: 21, color: alpha(C.onBrand, 0.92), marginTop: 4 }}>
            {blurb}
          </Text>
        )}
        {/* No figure while the counts are unknown, rather than a made-up one. */}
        {pct !== null ? (
          <Row gap={S.md} style={{ marginTop: S.md }}>
            <View style={{ flex: 1, height: 7, backgroundColor: alpha(C.onBrand, 0.25), borderRadius: 99, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.orange, borderRadius: 99 }} />
            </View>
            <Text style={{ fontFamily: F.display, fontSize: 15, color: C.onBrand }}>{pct}%</Text>
          </Row>
        ) : null}
      </Card>

      <Spacer h={S.lg} />
      <Small style={{ fontFamily: F.bodyBold, marginBottom: S.sm }}>{t('study.sections')}</Small>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item
          title={t('study.notes')}
          sub={content ? t('study.notesSub', { n: content.sections.length, read: readCount }) : t('common.loading')}
          icon="book"
          pct={content?.sections.length ? (readCount / content.sections.length) * 100 : 0}
          onPress={() => router.push(`/learn/reader/${id}${readCount && !allRead ? `?section=${resumeAt}` : ''}`)}
        />
        {audio ? (
          <Item
            title={t('study.audio')}
            sub={t('study.audioSub', { n: Math.max(1, Math.round(audio.durationSecs / 60)) })}
            icon="headphones"
            onPress={() => router.push(`/learn/audio/${id}`)}
          />
        ) : null}
        {/* Written by the AI on the server, so it cannot open offline, and
            offering it there only led to an error. */}
        {online ? (
          <Item
            title={t('tutor.sheetMake')}
            sub={derived.access.ai ? t('tutor.aiMade') : t('access.aiShort')}
            icon="spark"
            onPress={() => router.push(`/learn/sheet/${id}`)}
          />
        ) : null}
        <Item
          title={t('study.flashcards')}
          sub={content ? t('study.flashcardsSub', { n: content.flashcards.length, known: knownCards }) : ''}
          icon="cards"
          onPress={() => router.push(`/session/flashcards?chapter=${id}&from=chapter`)}
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
          onPress={() => router.push(`/session/shortq?chapter=${id}&from=chapter`)}
        />
        <Item
          title={t('study.blanks')}
          sub={content ? t('study.blanksSub', { n: content.blanks.length }) : ''}
          icon="edit"
          last
          onPress={() => router.push(`/session/blanks?chapter=${id}&from=chapter`)}
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
            {/* No notes is its own case, first: "start with the notes" over a
                button to the chapter test contradicted itself. */}
            <Small style={{ color: C.ink }}>
              {noNotes
                ? t('reader.noNotesTitle')
                : readCount === 0
                  ? t('study.coachStart')
                  : readCount < content.sections.length
                    ? t('study.coachKeepGoing')
                    : t('study.coachDone')}
            </Small>
            <Spacer h={S.sm} />
            <Btn
              title={!noNotes && readCount >= content.sections.length ? t('study.chapterTest') : t('study.mcqs')}
              variant="line"
              sm
              onPress={() =>
                router.push(
                  !noNotes && readCount >= content.sections.length
                    ? `/session/exam-intro?chapter=${id}`
                    : `/session/setup?chapter=${id}`,
                )
              }
            />
          </Card>
        </>
      ) : null}

      <Spacer h={S.lg} />
      {/* Saving for offline, said in words: it was an unlabelled icon in the
          header, and a pill down here that looked like a button and was not.
          The same press as the header's (a removal asks first). */}
      {download.readable ? (
        <Row gap={S.sm} style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill tone="green" icon="check">
            {t('study.savedOffline')}
          </Pill>
          {download.listed ? <Pill tone="grey">{formatBytes(chapterDownloadBytes(id))}</Pill> : null}
          <View style={{ flex: 1 }} />
          <Btn title={t('study.removeOffline')} variant="ghost" sm icon="trash" onPress={download.press} loading={download.busy} />
        </Row>
      ) : download.savedInNote ? null : (
        <Btn title={t('study.saveOffline')} variant="line" icon="download" onPress={download.press} loading={download.busy} />
      )}
      {/* Saved, but in the other language: said, with the way to fix it. */}
      {download.savedInNote ? (
        <Card flat tint={C.orangeTint} style={{ marginTop: S.sm }}>
          <Small>{download.savedInNote}</Small>
          {online ? (
            <>
              <Spacer h={S.sm} />
              <Btn title={t('downloads.downloadAgain')} variant="line" sm icon="download" onPress={download.press} loading={download.busy} />
            </>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}
