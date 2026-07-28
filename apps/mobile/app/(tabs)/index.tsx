import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon, IconName, SUBJECT_ICON } from '../../src/components/Icon';
import {
  Bar,
  Btn,
  Card,
  Check,
  H3,
  Kpi,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  Tap,
  Tiny,
} from '../../src/components/ui';
import { LockedNotice } from '../../src/components/LockedNotice';
import { chapterById, subjectById } from '@matricmate/core';
import { accuracy, chapterPct } from '@matricmate/core';
import { useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

const QUICK: { label: StringKey; icon: IconName; href: string }[] = [
  { label: 'dash.quickMcq', icon: 'target', href: '/session/setup' },
  { label: 'dash.quickCards', icon: 'cards', href: '/session/flashcards' },
  { label: 'dash.quickAi', icon: 'spark', href: '/(tabs)/tutor' },
  { label: 'dash.quickPapers', icon: 'doc', href: '/session/papers' },
];

export default function Dashboard() {
  const { state, derived, actions } = useApp();
  const t = useT();
  const firstName = (state.user?.name ?? 'Student').split(' ')[0];

  const week = useMemo(() => {
    const since = Date.now() - 7 * 864e5;
    const recent = state.attempts.filter((a) => a.at >= since);
    const minutes = Math.round(recent.length * 1.6 + state.readSections.length * 4);
    return {
      accuracy: accuracy(recent),
      questions: recent.length,
      time: minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`,
    };
  }, [state.attempts, state.readSections]);

  const lastChapter = state.lastChapterId ? chapterById(state.lastChapterId) : undefined;
  const lastPct = lastChapter ? chapterPct(lastChapter.id, state.readSections, state.attempts) : 0;
  const planDone = derived.plan.filter((task) => task.done).length;
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

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

      {/* Today's plan */}
      <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
        <Row>
          <H3 style={{ color: '#fff', flex: 1 }}>{t('dash.todayPlan')}</H3>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 11.5, color: '#fff' }}>
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
              flexDirection: 'row',
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
                {task.done ? <Icon name="check" size={14} color="#fff" strokeWidth={3} /> : null}
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
              <Text
                style={{
                  fontFamily: F.bodyBold,
                  fontSize: 13.5,
                  color: '#fff',
                  textDecorationLine: task.done ? 'line-through' : 'none',
                  opacity: task.done ? 0.7 : 1,
                }}
              >
                {planLabel(task)}
              </Text>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                {subjectById(task.subjectId)?.name}
              </Text>
            </Tap>

            <Icon name="chevron" size={18} color="rgba(255,255,255,0.8)" />
          </View>
        ))}
      </Card>

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
                <Icon name={SUBJECT_ICON[lastChapter.subjectId] ?? 'book'} color={C.teal} />
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
              <Icon name="chevron" size={18} color={C.ink3} />
            </Row>
          </Card>
        </>
      ) : null}

      {/* Quick actions */}
      <SectionTitle>{t('dash.quickActions')}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
        {QUICK.map((q) => (
          <Card
            key={q.label}
            onPress={() => router.push(q.href as never)}
            style={{ flexGrow: 1, flexBasis: '46%', flexDirection: 'row', alignItems: 'center', gap: S.sm }}
          >
            <Icon name={q.icon} color={C.teal} />
            <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{t(q.label)}</Text>
          </Card>
        ))}
      </View>

      {/* This week */}
      <SectionTitle>{t('dash.thisWeek')}</SectionTitle>
      <Row gap={S.sm}>
        <Kpi value={`${week.accuracy}%`} label={t('dash.accuracy')} small />
        <Kpi value={`${week.questions}`} label={t('dash.questions')} small />
        <Kpi value={week.time} label={t('dash.studyTime')} small />
      </Row>

      {!state.premium.active ? (
        <>
          <Spacer h={S.lg} />
          <LockedNotice variant="free" />
        </>
      ) : null}

      <Spacer h={S.lg} />
      <Tiny style={{ textAlign: 'center' }}>{t('common.demoNote')}</Tiny>
    </Screen>
  );
}
