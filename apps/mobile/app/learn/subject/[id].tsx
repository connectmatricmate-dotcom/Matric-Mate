import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../../src/components/Icon';
import {
  Bar,
  Btn,
  Card,
  Chevron,
  ErrorState,
  Header,
  Pill,
  Row,
  Screen,
  ScriptText,
  Sheet,
  Skeleton,
  Small,
  Spacer,
  Text,
  Ur,
} from '../../../src/components/ui';
import { LockedNotice } from '../../../src/components/LockedNotice';
import { api, chapterBlurb, chapterName, chapterPct, hasStudyMaterial, isUrduScript, subjectById, subjectName, subjectOpen, subjectPct } from '@matricmate/core';
import type { Chapter } from '@matricmate/core';
import { useAsync } from '../../../src/core/useAsync';
import { useLang, useT } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { C, F, S, isRTL } from '../../../src/theme';

export default function Chapters() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, derived, contentKey, contentLoading } = useApp();
  const t = useT();
  const { lang } = useLang();
  // contentKey: a language, class or board switch reaches an open list.
  const { data: subject } = useAsync(() => api.getSubject(id), [id, contentKey]);
  const { data: chapters, loading, reload } = useAsync(() => api.getChapters(id), [id, contentKey]);
  const [showLocked, setShowLocked] = useState(false);

  const pct = subjectPct(id, state.readSections, state.attempts);
  /**
   * Whether a row's zero counts mean "nothing in it".
   *
   * Only a live row can say so. The bundled catalogue, which answers when the
   * read fails or is slow, carries zeroes for every chapter and no board, and
   * treating those as empty greyed out every FBISE Class 9 chapter offline
   * and made none of them tappable. And an account without a plan sees zero
   * counts on everything under row level security, which is a locked chapter,
   * not an empty one.
   */
  /* A free trial opens one subject. Any other is listed, so the student can
     see what a plan adds, but nothing in it opens and there is no test to take:
     the database would hand either nothing at all. Its counts read zero for
     the same reason, which is a lock, not an empty chapter. */
  const shut = derived.access.tier === 'trial' && !subjectOpen(derived.access, id);
  const emptyRow = (c: Chapter) => !shut && c.board !== undefined && state.premium.active && !hasStudyMaterial(c);

  return (
    <Screen
      footer={
        shut ? undefined : (
          <Btn
            title={t('study.subjectTest')}
            variant="orange"
            icon="clock"
            onPress={() => router.push(`/session/exam-intro?subject=${id}`)}
          />
        )
      }
    >
      <Header
        // In the app's language: this was the English name in the Urdu UI.
        title={subjectName(subject ?? subjectById(id), lang)}
        sub={
          chapters?.length
            ? `${t('study.chapterCount', { n: chapters.length })} · ${t('study.percentComplete', { n: pct })}`
            : ' '
        }
        back
      />

      {shut ? (
        <>
          <LockedNotice />
          <Spacer h={S.md} />
        </>
      ) : null}

      {(loading || contentLoading) && !chapters?.length ? (
        <View style={{ gap: S.sm }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={i} flat>
              <Row gap={S.md}>
                <Skeleton w={38} h={38} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton w="70%" h={13} />
                  <Skeleton w="45%" h={10} />
                </View>
              </Row>
            </Card>
          ))}
        </View>
      ) : !(chapters ?? []).length ? (
        // The chapter read never throws, so a failed or empty list used to
        // show "0 chapters" and nothing under it, with no way to try again.
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
      ) : (
        <View style={{ gap: S.sm }}>
          {(chapters ?? []).map((c) => {
            const empty = emptyRow(c);
            // No figure for a row whose counts are not known: divided by
            // nothing, one read section came out as most of a chapter.
            const p = empty || (c.board === undefined && !hasStudyMaterial(c)) ? 0 : chapterPct(c.id, state.readSections, state.attempts);
            const locked = shut || (c.premium && !state.premium.active);
            const current = c.id === state.lastChapterId;
            const done = p >= 100;
            return (
              <Card
                key={c.id}
                flat={!current}
                border={current ? C.teal : undefined}
                style={{ opacity: empty || locked ? 0.62 : 1 }}
                onPress={empty ? undefined : () => (locked ? setShowLocked(true) : router.push(`/learn/chapter/${c.id}`))}
              >
                <Row gap={S.md}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: empty ? C.grey : done ? C.greenTint : C.tealTint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {done ? (
                      <Icon name="check" size={19} color={C.green} strokeWidth={2.6} />
                    ) : (
                      <Text style={{ fontFamily: F.display, fontSize: 16, color: empty ? C.ink3 : C.teal }}>{c.number}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {/* One language at a time: the app language picks the
                        title, both never stack. */}
                    <ScriptText text={chapterName(c, lang)} face="bodyBold" size={14} />
                    {/* Under the title, not beside it: at the end of the row
                        this pill took about 150dp and left the chapter name
                        four or five words wide, and at a large font it ran
                        out of the card. */}
                    {empty ? (
                      <Pill tone="grey" style={{ marginTop: 4, alignSelf: isRTL() ? 'flex-end' : 'flex-start' }}>
                        {t('study.notOnPaper')}
                      </Pill>
                    ) : shut || (c.board === undefined && !hasStudyMaterial(c)) ? null : (
                      // Two lines, not one: on a 390dp phone one line cut the
                      // sections count off every row ("5 sec...").
                      <Small numberOfLines={2}>
                        {/* Only what the row actually knows. audioMinutes is
                            always zero here; the real length lives on the
                            audio_tracks row and belongs to the chapter hub.
                            The share leads: it is the number the board itself
                            publishes and the one that decides study order.
                            A row with no counts to give says nothing rather
                            than "0 questions · 0 sections". */}
                        {/* Each figure held to its word, so the line breaks at a
                            dot and never leaves "sections" alone on the next. */}
                        {[
                          c.examShare ? t('study.examShare', { n: c.examShare }) : '',
                          t('study.mcqsSub', { n: c.mcqCount }),
                          t('study.sectionsSub', { n: c.sectionCount }),
                        ]
                          .filter(Boolean)
                          .map((part) => part.replace(/ /g, '\u00A0'))
                          .join(' · ')}
                      </Small>
                    )}
                    {!empty && p > 0 && p < 100 ? (
                      <View style={{ marginTop: 7 }}>
                        <Bar pct={p} tone="teal" />
                      </View>
                    ) : null}
                  </View>
                  {empty ? null : locked && shut ? (
                    <Icon name="lock" size={17} color={C.ink3} />
                  ) : locked ? (
                    // A lock, not a plan's name: the app names no plan to buy (core/billing.ts).
                    <Icon name="lock" size={17} color={C.ink3} />
                  ) : current ? (
                    <Pill tone="orange" style={{ maxWidth: '40%' }}>
                      {t('common.continue')}
                    </Pill>
                  ) : (
                    <Chevron size={18} color={C.ink3} />
                  )}
                </Row>
                {empty ? (
                  // The blurb takes the card's full width below the title
                  // row; squeezed into the middle column it wrapped into a
                  // cramped ribbon (client screenshot). Urdu blurbs keep the
                  // Urdu treatment, Latin ones stay Small.
                  <View style={{ marginTop: S.sm }}>
                    {/* The Urdu blurb in the Urdu interface, where one exists. */}
                    {isUrduScript(chapterBlurb(c, lang)) ? (
                      <Ur size={13} style={{ color: C.ink2 }}>{chapterBlurb(c, lang)}</Ur>
                    ) : (
                      <Small>{chapterBlurb(c, lang)}</Small>
                    )}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      <Sheet visible={showLocked} onClose={() => setShowLocked(false)} title={t('trial.lockedTitle')}>
        <LockedNotice />
        <Spacer h={S.md} />
        <Btn title={t('common.close')} variant="line" onPress={() => setShowLocked(false)} />
      </Sheet>
    </Screen>
  );
}
