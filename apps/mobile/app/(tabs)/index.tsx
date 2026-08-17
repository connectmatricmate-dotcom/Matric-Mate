import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon, IconName, SUBJECT_ICON } from '../../src/components/Icon';
import {
  Bar,
  Card,
  Chevron,
  H3,
  Kpi,
  Row,
  Screen,
  ScriptText,
  SectionTitle,
  Small,
  Spacer,
  Tap,
  TileGrid,
} from '../../src/components/ui';
import { CoachCard } from '../../src/components/CoachCard';
import { LockedNotice } from '../../src/components/LockedNotice';
import { SUBJECT_COLORS, accuracy, chapterById, chapterPct, formatDate, subjectById, todayKey } from '@matricmate/core';
import { Confetti, Pop } from '../../src/components/celebration';
import { cheer } from '../../src/core/haptics';
import { useLang, useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { useAsync } from '../../src/core/useAsync';
import { supabase } from '../../src/lib/supabase';
import { C, F, S, rowDir } from '../../src/theme';

const QUICK: { label: StringKey; icon: IconName; href: string }[] = [
  { label: 'dash.quickMcq', icon: 'target', href: '/session/setup' },
  { label: 'dash.quickCards', icon: 'cards', href: '/session/flashcards' },
  { label: 'dash.quickAi', icon: 'spark', href: '/(tabs)/tutor' },
  { label: 'dash.quickPapers', icon: 'doc', href: '/session/papers' },
  { label: 'dash.quickToppers', icon: 'award', href: '/session/topper-papers' },
];

export default function Dashboard() {
  const { state, derived, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  const firstName = (state.user?.name ?? t('common.student')).split(' ')[0];

  /**
   * The clock, read once on mount rather than on every render.
   *
   * Reading it during render means the same state can produce different output
   * on two consecutive passes, so React cannot treat the render as repeatable.
   * A dashboard is a snapshot of the moment it opened, so pinning "now" is also
   * what the screen means: the seven-day window should not slide underneath the
   * numbers while somebody is looking at them.
   */
  const [now] = useState(() => Date.now());

  /** Teacher verifications, the client's trust feature. The card only
   *  appears once real certificates exist; an empty promise would be
   *  exactly the "fake data" this dashboard just stopped showing. */
  const certCount = useAsync<number>(async () => {
    const { count } = await supabase.from('certificates').select('id', { count: 'exact', head: true });
    return count ?? 0;
  }, []);

  const week = useMemo(() => {
    const since = now - 7 * 864e5;
    const recent = state.attempts.filter((a) => a.at >= since);
    // Days actually studied, counted from real activity. The old value here
    // was minutes invented by a formula over counts, which told a student
    // they had studied for hours they never spent.
    const days = state.activeDays.filter((d) => Date.parse(d) >= since).length;
    return {
      accuracy: accuracy(recent),
      questions: recent.length,
      days: `${Math.min(7, days)}/7`,
    };
  }, [state.attempts, state.activeDays, now]);

  /**
   * Milestone streaks get one celebration on the day they land. The flame
   * chip itself pulses any day the streak is alive, a small ember of "do not
   * break it now" that costs nothing to keep lit.
   */
  const MILESTONES = [3, 7, 14, 30, 50, 100];
  const streakActiveToday = state.activeDays.includes(todayKey());
  const milestoneToday =
    streakActiveToday && MILESTONES.includes(derived.streak) && state.lastStreakCelebrated !== todayKey();
  useEffect(() => {
    if (milestoneToday) {
      cheer();
      actions.markStreakCelebrated();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestoneToday]);

  const lastChapter = state.lastChapterId ? chapterById(state.lastChapterId) : undefined;
  const lastPct = lastChapter ? chapterPct(lastChapter.id, state.readSections, state.attempts) : 0;
  const planDone = derived.plan.filter((task) => task.done).length;
  const today = formatDate(now, lang, { weekday: 'long', day: 'numeric', month: 'short' });

  /** Plan labels are composed here so they follow the app language. */
  function planLabel(task: (typeof derived.plan)[number]) {
    const chapter = chapterById(task.chapterId);
    const name = chapter?.title ?? '';
    if (task.kind === 'read') return t('dash.taskRead', { chapter: name });
    if (task.kind === 'mcq') return t('dash.taskMcq', { chapter: name });
    if (task.weakTopic) return t('dash.taskWeak', { topic: task.weakTopic, n: task.weakAccuracy ?? 0 });
    return t('dash.taskCards');
  }

  return (
    <Screen tabbed>
      <AppHeader eyebrow={today} title={t('dash.greeting', { name: firstName })} />
      {/* Which class this whole dashboard is showing. One line, always on. */}
      <Small style={{ fontFamily: F.bodyBold, color: C.teal, marginTop: -6 }}>
        {t('tutor.classBadge', { n: state.onboarding?.classLevel ?? 9 })}
      </Small>
      <Spacer h={S.sm} />
      {milestoneToday ? <Confetti /> : null}

      {!state.premium.active ? (
        <>
          {/* Leading with the pitch, not burying it: for an unpaid account
              this screen's job is to show what a plan opens. */}
          <LockedNotice variant="free" />
          <Spacer h={S.md} />
        </>
      ) : null}

      {/* The streak lives in the header pill alone. A second chip here said
          the same thing twice, and its entrance slide dragged the row in
          from outside the screen, which read as broken. */}

      {/* Today's plan */}
      <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
        <Row>
          <H3 style={{ color: C.onBrand, flex: 1 }}>{t('dash.todayPlan')}</H3>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 11.5, color: C.onBrand }}>
              {t('dash.doneCount', { a: planDone, b: derived.plan.length })}
            </Text>
          </View>
        </Row>

        <View style={{ marginVertical: S.md, height: 7, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 99, overflow: 'hidden' }}>
          <View
            style={{
              width: `${(planDone / Math.max(1, derived.plan.length)) * 100}%`,
              height: '100%',
              backgroundColor: C.orange,
              borderRadius: 99,
            }}
          />
        </View>

        {derived.plan.map((task) => (
          <View
            key={task.id}
            style={{
              flexDirection: rowDir(),
              alignItems: 'center',
              gap: S.md,
              paddingVertical: 10,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.14)',
            }}
          >
            <Tap onPress={() => actions.togglePlanTask(task.id)} hit>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: task.done ? C.orange : 'rgba(255,255,255,0.55)',
                  backgroundColor: task.done ? C.orange : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {task.done ? (
                  <Pop>
                    <Icon name="check" size={14} color={C.onBrand} strokeWidth={3} />
                  </Pop>
                ) : null}
              </View>
            </Tap>

            <Tap
              style={{ flex: 1 }}
              onPress={() =>
                router.push(
                  task.kind === 'read'
                    ? `/learn/reader/${task.chapterId}`
                    : task.kind === 'mcq'
                      ? `/session/setup?chapter=${task.chapterId}`
                      : `/session/flashcards?chapter=${task.chapterId}`
                )
              }
            >
              {/* The task line embeds a chapter or weak-topic name, which is
                  Urdu on an Urdu-medium account. */}
              <ScriptText
                text={planLabel(task)}
                face="bodyBold"
                size={13.5}
                color={C.onBrand}
                style={{
                  textDecorationLine: task.done ? 'line-through' : 'none',
                  opacity: task.done ? 0.7 : 1,
                }}
              />
              <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: 'rgba(255,255,255,0.92)' }}>
                {subjectById(task.subjectId)?.name}
              </Text>
            </Tap>

            <Chevron size={18} color="rgba(255,255,255,0.8)" />
          </View>
        ))}
      </Card>

      {certCount.data ? (
        <>
          <Spacer h={S.md} />
          <Card onPress={() => router.push('/certificates')} tint={C.greenTint} border={C.green}>
            <Row gap={S.md}>
              <Text style={{ fontSize: 24 }}>🎓</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>{t('cert.dashCard')}</Text>
                <Small>{t('cert.dashCardSub')}</Small>
              </View>
              <Chevron size={18} color={C.ink3} />
            </Row>
          </Card>
        </>
      ) : null}

      {/* Continue learning */}
      {lastChapter ? (
        <>
          <SectionTitle>{t('dash.continueLearning')}</SectionTitle>
          <Card onPress={() => router.push(`/learn/chapter/${lastChapter.id}`)}>
            <Row gap={S.md}>
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  backgroundColor: C.tealTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 13,
                    backgroundColor: SUBJECT_COLORS[lastChapter.subjectId]?.tint ?? C.tealTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name={SUBJECT_ICON[lastChapter.subjectId] ?? 'book'}
                    color={SUBJECT_COLORS[lastChapter.subjectId]?.main ?? C.teal}
                    strokeWidth={2.3}
                  />
                </View>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }} numberOfLines={1}>
                  {lastChapter.title}
                </Text>
                <Small>
                  {subjectById(lastChapter.subjectId)?.name} ·{' '}
                  {t('dash.sectionOf', {
                    a: Math.min(state.lastSectionIndex + 1, lastChapter.sectionCount),
                    b: lastChapter.sectionCount,
                  })}
                </Small>
                <View style={{ marginTop: 8 }}>
                  <Bar pct={lastPct} />
                </View>
              </View>
              <Chevron size={18} color={C.ink3} />
            </Row>
          </Card>
        </>
      ) : null}

      {/* The weekly AI coach, cached server-side per week. */}
      <Spacer h={S.md} />
      <CoachCard />

      {/* Quick actions */}
      <SectionTitle>{t('dash.quickActions')}</SectionTitle>
      <TileGrid
        tiles={QUICK.map((q) => ({
          key: q.label,
          node: (
            <Card
              onPress={() => router.push(q.href as never)}
              style={{ flex: 1, minHeight: 58, flexDirection: rowDir(), alignItems: 'center', gap: S.sm }}
            >
              <Icon name={q.icon} color={C.teal} />
              <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{t(q.label)}</Text>
            </Card>
          ),
        }))}
      />

      {/* This week */}
      <SectionTitle>{t('dash.thisWeek')}</SectionTitle>
      <Row gap={S.sm}>
        <Kpi value={`${week.accuracy}%`} label={t('dash.accuracy')} small />
        <Kpi value={`${week.questions}`} label={t('dash.questions')} small />
        <Kpi value={week.days} label={t('dash.activeDays')} small />
      </Row>
    </Screen>
  );
}
