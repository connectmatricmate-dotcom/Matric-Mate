import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Bar, Card, Item, Kpi, Pill, Ring, Row, Screen, ScriptText, SectionTitle, Small, Spacer, Tap, Text } from '../../src/components/ui';
import {
  accuracy,
  fetchDailyReport,
  formatDate,
  grade,
  last14,
  overallPct,
  studyTimeLabel,
  subjectById,
  subjectName,
  subjectPct,
  weakTopics,
} from '@matricmate/core';
import { Icon } from '../../src/components/Icon';
import { useOnline } from '../../src/core/connectivity';
import { useAsync } from '../../src/core/useAsync';
import { supabase } from '../../src/lib/supabase';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

export default function Progress() {
  const { state, derived, contentKey } = useApp();
  const t = useT();
  const { lang } = useLang();

  const overall = useMemo(
    () => overallPct(derived.subjects, state.readSections, state.attempts),
    // contentKey is not read here and has to be listed: the percentages read
    // the chapter index, and the first session after sign-in or a switch
    // showed 0% (or an inflated figure) until something else re-rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [derived.subjects, state.readSections, state.attempts, contentKey]
  );
  const days = useMemo(() => last14(state.activeDays), [state.activeDays]);
  // Same reason: weakTopics holds answers to the syllabus the index knows.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weak = useMemo(() => weakTopics(state.attempts).slice(0, 4), [state.attempts, contentKey]);
  const acc = accuracy(state.attempts);
  // Pinned once on mount rather than read during render: a render must be
  // repeatable, and the month label has no business changing mid-screen.
  const [now] = useState(() => Date.now());
  const month = formatDate(now, lang, { month: 'long' });
  /**
   * This month's answers, for the report card row. The row names this
   * month's report, and the report grades this month alone, but the row
   * graded every answer ever: on the first of a month it said "Overall B"
   * over a report with no answers in it. Karachi's calendar, as the report's.
   */
  const monthAttempts = useMemo(() => {
    const pktMonth = (ms: number) => new Date(ms + 5 * 3600_000).toISOString().slice(0, 7);
    const current = pktMonth(now);
    return state.attempts.filter((a) => Number.isFinite(a.at) && pktMonth(a.at) === current);
  }, [state.attempts, now]);

  const link = (label: string, href: string) => (
    <Tap onPress={() => router.push(href as never)} hit>
      <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: C.teal }}>{label}</Text>
    </Tap>
  );

  return (
    <Screen tabbed>
      <AppHeader title={t('progress.title')} eyebrow={t('progress.sub')} />

      <Card>
        <Row gap={S.lg}>
          <Ring pct={overall} size={84} stroke={9}>
            <Text style={{ fontFamily: F.display, fontSize: 18, color: C.ink }}>{overall}%</Text>
          </Ring>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>{t('progress.syllabusCovered')}</Text>
            <Small>{derived.streak > 0 ? t('progress.streakAlive', { n: derived.streak }) : t('progress.noStreak')}</Small>
          </View>
        </Row>

        {/*
          Its own full-width row, and chips that share the width.
          Fourteen fixed 14px chips with a 4px gap need 248px and had 196
          beside the ring on a 360dp phone, which is the screen this app is
          designed for, so the last few fell outside the card. flex: 1 makes
          the strip fit whatever it is given, the way the web rail already did.
        */}
        <Row gap={3} style={{ marginTop: S.md }}>
          {days.map((on, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 22,
                borderRadius: 5,
                backgroundColor: on ? C.orangeTint : C.grey,
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {on ? <Text style={{ fontSize: 8 }}>🔥</Text> : null}
            </View>
          ))}
        </Row>
        <Small style={{ marginTop: 6, fontSize: 11.5 }}>{t('progress.last14')}</Small>
      </Card>

      <Spacer h={S.md} />
      {/* Two rows of two. Four across left each label about 56dp on a 360dp
          phone, so "Active days" was cut short and, at a large font,
          "Questions" broke in the middle of the word. */}
      <View style={{ gap: S.sm }}>
        <Row gap={S.sm}>
          <Kpi value={`${state.attempts.length}`} label={t('dash.questions')} small />
          <Kpi value={`${acc}%`} label={t('dash.accuracy')} small />
        </Row>
        <Row gap={S.sm}>
          <Kpi value={String(state.activeDays.length)} label={t('dash.activeDays')} small />
          <Kpi value={`${state.results.length}`} label={t('progress.tests')} small />
        </Row>
      </View>

      <SectionTitle action={link(t('common.details'), '/insights/performance')}>{t('progress.bySubject')}</SectionTitle>
      {/* Every subject. Six was the cut, which kept Maths to Pakistan Studies
          and one elective, so Chemistry, Biology and Computer Science never
          showed at all. */}
      <Card flat style={{ gap: S.md }}>
        {derived.subjects.map((sid) => {
          const pct = subjectPct(sid, state.readSections, state.attempts);
          return (
            <Tap key={sid} onPress={() => router.push('/insights/performance')}>
              <Row style={{ justifyContent: 'space-between' }}>
                <ScriptText text={subjectName(subjectById(sid), lang)} face="bodyBold" size={13} style={{ flex: 1 }} />
                <Small style={{ fontFamily: F.bodyBold }}>{pct}%</Small>
              </Row>
              <View style={{ marginTop: 5 }}>
                <Bar pct={pct} tone="teal" />
              </View>
            </Tap>
          );
        })}
      </Card>

      <SectionTitle action={link(t('common.seeAll'), '/insights/weak')}>{t('progress.weakTopics')}</SectionTitle>
      {weak.length === 0 ? (
        <Card flat>
          <Small>{t('progress.weakEmpty')}</Small>
        </Card>
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {weak.map((w, i) => (
            <Item
              // Two subjects can share a topic's name; weakTopics keys them apart.
              key={`${w.subjectId}|${w.topic}`}
              title={w.topic}
              sub={subjectName(subjectById(w.subjectId), lang)}
              icon="alert"
              tone={w.accuracy < 50 ? 'red' : 'orange'}
              last={i === weak.length - 1}
              onPress={() => router.push('/insights/weak')}
              right={<Pill tone={w.accuracy < 50 ? 'red' : 'orange'}>{`${w.accuracy}%`}</Pill>}
            />
          ))}
        </Card>
      )}

      <Spacer h={S.md} />
      <TodayCard />
      <Spacer h={S.sm} />
      <CareerCard />

      <Spacer h={S.md} />
      <Card border={C.orange} onPress={() => router.push('/insights/report')}>
        <Row gap={S.md}>
          <Text style={{ fontSize: 26 }}>🎓</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{t('progress.reportCard', { month })}</Text>
            {/* No answers, no grade: a brand-new student was told "Overall F". */}
            <Small>
              {monthAttempts.length
                ? t('progress.reportCardSub', { grade: grade(accuracy(monthAttempts)) })
                : t('progress.reportCardSubNone')}
            </Small>
          </View>
          <Pill tone="orange">{t('progress.open')}</Pill>
        </Row>
      </Card>
    </Screen>
  );
}

/**
 * The way into today's report, with today's two numbers on it: the time and
 * the questions. The line under it says what the card is for until there is
 * something to count, and while offline, since the report is read from the
 * server.
 */
function TodayCard() {
  const { state } = useApp();
  const t = useT();
  const { lang } = useLang();
  const online = useOnline();
  // Answering a question changes today, so the count follows it.
  const { data: report } = useAsync(
    async () => (online && state.user?.id ? fetchDailyReport(supabase) : null),
    [online, state.user?.id ?? '', state.attempts.length],
  );
  const active = !!report && (report.seconds >= 60 || report.questions > 0);
  return (
    <Card border={C.teal} onPress={() => router.push('/insights/today')}>
      <Row gap={S.md}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="calendar" size={20} color={C.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{t('today.cardTitle')}</Text>
          <Small>{active && report ? t('today.cardSub', { time: studyTimeLabel(report.seconds, lang), n: report.questions }) : t('today.cardSubNone')}</Small>
        </View>
        <Pill tone="teal">{t('progress.open')}</Pill>
      </Row>
    </Card>
  );
}

/** The way into career guidance: Premium's, so Basic sees what it is and whose it is. */
function CareerCard() {
  const { derived } = useApp();
  const t = useT();
  return (
    <Card flat onPress={() => router.push('/insights/career')}>
      <Row gap={S.md}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="gradCap" size={20} color={C.teal} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{t('career.title')}</Text>
          <Small>{derived.access.ai ? t('career.cardSub') : t('aiLock.short')}</Small>
        </View>
        <Icon name={derived.access.ai ? 'chevron' : 'lock'} size={18} color={C.ink3} />
      </Row>
    </Card>
  );
}
