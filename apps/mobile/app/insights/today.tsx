import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  chapterById,
  chapterName,
  fetchDailyReport,
  formatDate,
  karachiDay,
  studyTimeLabel,
  subjectById,
  subjectName,
} from '@matricmate/core';
import { Icon } from '../../src/components/Icon';
import { Bar, Card, Chevron, Empty, ErrorState, Header, Kpi, Pill, Row, Screen, ScriptText, SectionTitle, Skeleton, Small, Spacer, Tap } from '../../src/components/ui';
import { useOnline } from '../../src/core/connectivity';
import { useAsync } from '../../src/core/useAsync';
import { useLang, useT } from '../../src/i18n';
import { supabase } from '../../src/lib/supabase';
import { useApp } from '../../src/store/app';
import { C, F, S, rowDir } from '../../src/theme';

/** Today and the six days before it: a week to look back over, no further. */
const DAYS_BACK = 7;

/** A YYYY-MM-DD day as noon in Karachi, so formatting it never slips a day either side. */
const dayInstant = (day: string) => Date.parse(`${day}T12:00:00+05:00`);

/**
 * One day of study, next to the monthly report card: the website's daily
 * report, on the phone. Read from the database's own day (daily_report,
 * migration 0042), which knows the minutes in the app and when notes and
 * flashcards were done, which the phone does not keep. So it needs the
 * internet; offline it says so rather than showing an empty day.
 */
export default function DailyReport() {
  const t = useT();
  const { lang } = useLang();
  const { state, contentKey } = useApp();
  const online = useOnline();
  const [now] = useState(() => Date.now());
  const days = Array.from({ length: DAYS_BACK }, (_, back) => karachiDay(back, now));
  const [day, setDay] = useState(days[0]);
  const today = day === days[0];

  const { data: report, loading, reload } = useAsync(
    async () => (online && state.user?.id ? fetchDailyReport(supabase, day) : null),
    [day, online, state.user?.id ?? '', today ? state.attempts.length : 0],
  );

  const dayLabel = (d: string, i: number) =>
    i === 0 ? t('today.today') : i === 1 ? t('today.yesterday') : formatDate(dayInstant(d), lang, { weekday: 'short', day: 'numeric' });
  const empty = !!report && report.questions === 0 && report.sections === 0 && report.cards === 0 && report.tests.length === 0;

  return (
    <Screen>
      <Header title={t('today.title')} sub={formatDate(dayInstant(day), lang, { weekday: 'long', day: 'numeric', month: 'long' })} back />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm, flexDirection: rowDir(), paddingBottom: 4 }}>
        {days.map((d, i) => (
          <Tap key={d} onPress={() => setDay(d)} role="checkbox" checked={d === day}>
            <View
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 99,
                backgroundColor: d === day ? C.teal : C.card,
                borderWidth: d === day ? 0 : 1,
                borderColor: C.line,
              }}
            >
              <Small style={{ fontFamily: F.bodyBold, color: d === day ? C.onBrand : C.ink2 }}>{dayLabel(d, i)}</Small>
            </View>
          </Tap>
        ))}
      </ScrollView>
      <Spacer h={S.md} />

      {!online ? (
        <ErrorState title={t('offline.title')} sub={t('today.loadFailed')} retry={t('common.retry')} onRetry={reload} />
      ) : loading && !report ? (
        <View style={{ gap: S.sm }}>
          {[0, 1].map((r) => (
            <Row key={r} gap={S.sm}>
              <View style={{ flex: 1 }}>
                <Skeleton h={74} style={{ borderRadius: 16 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Skeleton h={74} style={{ borderRadius: 16 }} />
              </View>
            </Row>
          ))}
          <Skeleton h={140} style={{ borderRadius: 16 }} />
        </View>
      ) : !report ? (
        <ErrorState title={t('states.errorTitle')} sub={t('today.loadFailed')} retry={t('common.retry')} onRetry={reload} />
      ) : (
        <>
          <View style={{ gap: S.sm }}>
            <Row gap={S.sm}>
              <Kpi value={studyTimeLabel(report.seconds, lang)} label={t('today.timeInApp')} />
              <Kpi value={String(report.questions)} label={t('today.questions')} />
            </Row>
            <Row gap={S.sm}>
              <Kpi value={String(report.sections)} label={t('today.sections')} />
              <Kpi value={String(report.cards)} label={t('today.cards')} />
            </Row>
          </View>

          {empty ? (
            <>
              <Spacer h={S.md} />
              <Empty
                emoji="📅"
                title={today ? t('today.nothingTitle') : t('today.nothingPastTitle')}
                sub={today ? t('today.nothingBody') : report.opened ? t('today.nothingPastBody') : t('today.notOpened')}
              />
            </>
          ) : (
            <>
              {report.subjects.length ? (
                <>
                  <SectionTitle>{t('today.bySubject')}</SectionTitle>
                  <Card flat style={{ gap: S.md }}>
                    {report.subjects.map((s) => {
                      const pct = s.questions ? Math.round((s.correct / s.questions) * 100) : 0;
                      return (
                        <View key={s.subject}>
                          <Row style={{ justifyContent: 'space-between' }}>
                            <ScriptText text={subjectName(subjectById(s.subject), lang) || s.subject} face="bodyBold" size={13.5} style={{ flex: 1 }} />
                            <Small style={{ fontFamily: F.bodyBold }}>{t('today.rightOf', { c: s.correct, n: s.questions })}</Small>
                          </Row>
                          <View style={{ marginTop: 6 }}>
                            <Bar pct={pct} tone={pct >= 70 ? 'green' : pct >= 40 ? 'orange' : 'red'} />
                          </View>
                        </View>
                      );
                    })}
                  </Card>
                </>
              ) : null}

              {report.tests.length ? (
                <>
                  <SectionTitle>{t('today.tests')}</SectionTitle>
                  <Card flat style={{ gap: S.sm }}>
                    {report.tests.map((x, i) => {
                      const pct = x.total ? Math.round((x.score / x.total) * 100) : 0;
                      return (
                        <Row key={`${x.label}-${i}`} gap={S.sm}>
                          <Icon name="clock" size={17} color={C.orangeDark} />
                          <ScriptText text={x.label} face="bodyBold" size={13.5} style={{ flex: 1 }} />
                          <Pill tone={pct >= 70 ? 'green' : 'red'}>{`${x.score}/${x.total}`}</Pill>
                        </Row>
                      );
                    })}
                  </Card>
                </>
              ) : null}

              {report.chapters.length ? (
                <>
                  <SectionTitle>{t('today.chapters')}</SectionTitle>
                  <Card flat style={{ paddingVertical: 4 }}>
                    {report.chapters.map((id) => {
                      // Named from the chapter index once it has loaded (contentKey); the id until then.
                      void contentKey;
                      const chapter = chapterById(id);
                      return (
                        <Tap key={id} onPress={() => router.push(`/learn/chapter/${id}`)}>
                          <Row gap={S.md} style={{ paddingVertical: 10 }}>
                            <Icon name="book" size={17} color={C.teal} />
                            <View style={{ flex: 1 }}>
                              <ScriptText text={chapter ? chapterName(chapter, lang) : id} face="bodyBold" size={13.5} />
                              {chapter ? <Small>{subjectName(subjectById(chapter.subjectId), lang)}</Small> : null}
                            </View>
                            <Chevron size={16} color={C.ink3} />
                          </Row>
                        </Tap>
                      );
                    })}
                  </Card>
                </>
              ) : null}
            </>
          )}
        </>
      )}
      <Spacer h={S.lg} />
    </Screen>
  );
}
