import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
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
  Skeleton,
  Small,
  Spacer,
  Tap,
  Text,
  TileGrid,
} from '../../src/components/ui';
import { CoachCard } from '../../src/components/CoachCard';
import {
  SUBJECT_COLORS,
  accuracy,
  boardName,
  chapterById,
  chapterName,
  chapterPct,
  formatDate,
  inSyllabus,
  subjectById,
  subjectName,
  todayKey,
} from '@matricmate/core';
import { Confetti, Pop } from '../../src/components/celebration';
import { cheer } from '../../src/core/haptics';
import { useLang, useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { useAsync } from '../../src/core/useAsync';
import { supabase } from '../../src/lib/supabase';
import { C, F, S, alpha, rowDir, textStart } from '../../src/theme';

/*
 * The Flashcards tile names no chapter on purpose: the flashcards screen picks
 * one of the student's own chapters that has cards, names it, and lets them
 * change it (see PracticeChapter). It used to land on Matrices or on FBISE's
 * `phy-1`, whatever the student's class and board.
 */
const QUICK: { label: StringKey; icon: IconName; href: string }[] = [
  { label: 'dash.quickMcq', icon: 'target', href: '/session/setup' },
  { label: 'dash.quickCards', icon: 'cards', href: '/session/flashcards' },
  { label: 'dash.quickAi', icon: 'spark', href: '/(tabs)/tutor' },
  { label: 'dash.quickPapers', icon: 'doc', href: '/session/papers' },
  { label: 'dash.quickToppers', icon: 'award', href: '/session/topper-papers' },
];

export default function Dashboard() {
  const { state, derived, actions, contentLoading } = useApp();
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
  /**
   * The burst, held here rather than read off the store.
   *
   * Marking the streak celebrated lands in the same commit that mounts the
   * confetti, so reading `milestoneToday` for it unmounted the pieces before a
   * single frame of them ran: only the haptic ever fired. Latched for as long
   * as the pieces take, then let go.
   */
  const [burst, setBurst] = useState(false);
  // Latched while rendering, the way React documents adjusting state to a
  // change: the milestone is seen in this render, and the burst with it.
  if (milestoneToday && !burst) setBurst(true);
  useEffect(() => {
    if (!milestoneToday) return;
    cheer();
    actions.markStreakCelebrated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestoneToday]);
  useEffect(() => {
    if (!burst) return;
    const timer = setTimeout(() => setBurst(false), 2400);
    return () => clearTimeout(timer);
  }, [burst]);

  // Only a chapter of their own syllabus: after a board or class change the
  // last one read belongs to the old one.
  const lastChapter =
    state.lastChapterId && inSyllabus(state.lastChapterId, state.onboarding?.classLevel ?? 9, state.onboarding?.board)
      ? chapterById(state.lastChapterId)
      : undefined;
  const lastPct = lastChapter ? chapterPct(lastChapter.id, state.readSections, state.attempts) : 0;
  const planDone = derived.plan.filter((task) => task.done).length;
  const today = formatDate(now, lang, { weekday: 'long', day: 'numeric', month: 'short' });

  /** Plan labels are composed here so they follow the app language. */
  function planLabel(task: (typeof derived.plan)[number]) {
    const chapter = chapterById(task.chapterId);
    // A chapter the index has not named yet (offline, say) reads as its
    // subject, never as "Read  · 15 min" with a hole in it.
    const name = chapter ? chapterName(chapter, lang) : subjectName(subjectById(task.subjectId), lang);
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
        {t('tutor.classBadge', { n: state.onboarding?.classLevel ?? 9, board: boardName(state.onboarding?.board, lang) })}
      </Small>
      <Spacer h={S.sm} />
      {burst ? <Confetti /> : null}

      {/* The streak lives in the header pill alone. A second chip here said
          the same thing twice, and its entrance slide dragged the row in
          from outside the screen, which read as broken. */}

      {/* Today's plan */}
      <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
        <Row>
          <H3 style={{ color: C.onBrand, flex: 1 }}>{t('dash.todayPlan')}</H3>
          {derived.plan.length ? (
            <View style={{ backgroundColor: alpha(C.onBrand, 0.18), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 11.5, color: C.onBrand }}>
                {t('dash.doneCount', { a: planDone, b: derived.plan.length })}
              </Text>
            </View>
          ) : null}
        </Row>

        <View style={{ marginVertical: S.md, height: 7, backgroundColor: alpha(C.onBrand, 0.25), borderRadius: 99, overflow: 'hidden' }}>
          <View
            style={{
              width: `${(planDone / Math.max(1, derived.plan.length)) * 100}%`,
              height: '100%',
              backgroundColor: C.orange,
              borderRadius: 99,
            }}
          />
        </View>

        {/* No plan yet. While the chapter index is on its way the plan is
            simply not built, so it gets a skeleton; once it has landed and
            there is still nothing to plan from, it says so and offers the
            chapters instead of "0/0" over an empty card. */}
        {derived.plan.length === 0 ? (
          contentLoading ? (
            <View style={{ gap: 10, paddingTop: 4 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} h={16} w={i === 1 ? '70%' : '85%'} style={{ backgroundColor: alpha(C.onBrand, 0.22) }} />
              ))}
            </View>
          ) : (
            <View style={{ gap: S.sm }}>
              <ScriptText text={t('dash.planEmpty')} size={13.5} color={C.onBrand} />
              <Tap onPress={() => router.push('/(tabs)/study')} hit>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.onBrand, textDecorationLine: 'underline', textAlign: textStart() }}>
                  {t('downloads.browse')}
                </Text>
              </Tap>
            </View>
          )
        ) : null}
        {derived.plan.map((task) => (
          <View
            key={task.id}
            style={{
              flexDirection: rowDir(),
              alignItems: 'center',
              gap: S.md,
              paddingVertical: 10,
              borderTopWidth: 1,
              borderTopColor: alpha(C.onBrand, 0.14),
            }}
          >
            <Tap onPress={() => actions.togglePlanTask(task.id)} hit role="checkbox" checked={task.done} label={t('a11y.markDone')}>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: task.done ? C.orange : alpha(C.onBrand, 0.55),
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
              <ScriptText
                text={subjectName(subjectById(task.subjectId), lang)}
                face="bodyBold"
                size={11}
                color={C.onBrand}
                style={{ opacity: 0.92 }}
              />
            </Tap>

            <Chevron size={18} color={alpha(C.onBrand, 0.8)} />
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
                <ScriptText text={chapterName(lastChapter, lang)} face="bodyBold" size={14.5} lines={1} />
                {/* "Section 0 of 0" is not a position: a chapter whose count
                    is not known yet shows its subject alone. */}
                <ScriptText
                  text={
                    lastChapter.sectionCount > 0
                      ? `${subjectName(subjectById(lastChapter.subjectId), lang)} · ${t('dash.sectionOf', {
                          a: Math.min(state.lastSectionIndex + 1, lastChapter.sectionCount),
                          b: lastChapter.sectionCount,
                        })}`
                      : subjectName(subjectById(lastChapter.subjectId), lang)
                  }
                  size={13}
                  color={C.ink2}
                />
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

      {/* Quick actions. Topper scripts are FBISE's own marked answer sheets and
          no Punjab board publishes any, so a Punjab student is not offered them. */}
      <SectionTitle>{t('dash.quickActions')}</SectionTitle>
      <TileGrid
        tiles={QUICK.filter((q) => q.href !== '/session/topper-papers' || state.onboarding?.board !== 'punjab').map((q) => ({
          key: q.label,
          node: (
            <Card
              onPress={() => router.push(q.href as never)}
              style={{ flex: 1, minHeight: 58, flexDirection: rowDir(), alignItems: 'center', gap: S.sm }}
            >
              <Icon name={q.icon} color={C.teal} />
              {/* Shrinks beside the icon and wraps: "Topper papers" is 97dp in
                  a 98dp slot, so any font larger than the default ran it out
                  of the tile. */}
              <Text numberOfLines={2} style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink, flexShrink: 1 }}>
                {t(q.label)}
              </Text>
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
