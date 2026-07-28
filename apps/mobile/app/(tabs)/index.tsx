import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon } from '../../src/components/Icon';
import {
  Bar,
  Body,
  Btn,
  Card,
  H2,
  H3,
  Kpi,
  Pill,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  Tap,
  Tiny,
} from '../../src/components/ui';
import { chapterById, subjectById } from '../../src/core/content';
import { accuracy, chapterPct } from '../../src/core/domain';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

const QUICK: { label: string; icon: 'target' | 'cards' | 'spark' | 'doc'; href: string }[] = [
  { label: '10 MCQs', icon: 'target', href: '/session/setup' },
  { label: 'Flashcards', icon: 'cards', href: '/session/flashcards' },
  { label: 'Ask AI', icon: 'spark', href: '/(tabs)/tutor' },
  { label: 'Past papers', icon: 'doc', href: '/session/papers' },
];

export default function Dashboard() {
  const { state, derived, actions } = useApp();
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
  const planDone = derived.plan.filter((t) => t.done).length;

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <Screen>
      <AppHeader eyebrow={today} title={`Salam, ${firstName} 👋`} />

      {/* Today's plan */}
      <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
        <Row>
          <H3 style={{ color: '#fff', flex: 1 }}>Aaj ka plan</H3>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 11.5, color: '#fff' }}>
              {planDone}/{derived.plan.length} done
            </Text>
          </View>
        </Row>
        <View style={{ marginVertical: S.md }}>
          <View style={{ height: 7, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 99, overflow: 'hidden' }}>
            <View
              style={{
                width: `${(planDone / Math.max(1, derived.plan.length)) * 100}%`,
                height: '100%',
                backgroundColor: C.orange,
                borderRadius: 99,
              }}
            />
          </View>
        </View>
        {derived.plan.map((t) => (
          <Tap key={t.id} onPress={() => actions.togglePlanTask(t.id)}>
            <Row style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' }} gap={S.md}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: t.done ? C.orange : 'rgba(255,255,255,0.5)',
                  backgroundColor: t.done ? C.orange : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {t.done ? <Icon name="check" size={13} color="#fff" strokeWidth={3} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: F.bodyBold,
                    fontSize: 13.5,
                    color: '#fff',
                    textDecorationLine: t.done ? 'line-through' : 'none',
                    opacity: t.done ? 0.7 : 1,
                  }}
                >
                  {t.label}
                </Text>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
                  {subjectById(t.subjectId)?.name}
                </Text>
              </View>
              <Tap
                onPress={() =>
                  router.push(
                    t.kind === 'read'
                      ? `/learn/reader/${t.chapterId}`
                      : t.kind === 'mcq'
                        ? `/session/setup?chapter=${t.chapterId}`
                        : `/session/flashcards?chapter=${t.chapterId}`
                  )
                }
              >
                <Icon name="chevron" size={18} color="rgba(255,255,255,0.8)" />
              </Tap>
            </Row>
          </Tap>
        ))}
      </Card>

      {/* Continue learning */}
      {lastChapter ? (
        <>
          <SectionTitle>Continue learning</SectionTitle>
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
                <Icon name={subjectById(lastChapter.subjectId)?.icon ?? 'book'} color={C.teal} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }} numberOfLines={1}>
                  Ch {lastChapter.number} · {lastChapter.title}
                </Text>
                <Small>
                  {subjectById(lastChapter.subjectId)?.name} · section {Math.min(state.lastSectionIndex + 1, lastChapter.sectionCount)} of{' '}
                  {lastChapter.sectionCount}
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
      <SectionTitle>Quick actions</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
        {QUICK.map((q) => (
          <Card
            key={q.label}
            onPress={() => router.push(q.href as never)}
            style={{ flexGrow: 1, flexBasis: '46%', flexDirection: 'row', alignItems: 'center', gap: S.sm }}
          >
            <Icon name={q.icon} color={C.teal} />
            <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{q.label}</Text>
          </Card>
        ))}
      </View>

      {/* This week */}
      <SectionTitle>This week</SectionTitle>
      <Row gap={S.sm}>
        <Kpi value={`${week.accuracy}%`} label="accuracy" small />
        <Kpi value={`${week.questions}`} label="questions" small />
        <Kpi value={week.time} label="study time" small />
      </Row>

      {!state.premium.active ? (
        <>
          <Spacer h={S.lg} />
          <Card tint={C.orangeTint} border={C.orange}>
            <Row gap={S.md}>
              <Text style={{ fontSize: 22 }}>👑</Text>
              <View style={{ flex: 1 }}>
                <H3>Free mode</H3>
                <Small>5 MCQs and 5 AI questions a day. Go Premium for everything.</Small>
              </View>
            </Row>
            <Spacer h={S.md} />
            <Btn title="See Premium — Rs 1,000/month" variant="orange" sm onPress={() => router.push('/paywall')} />
          </Card>
        </>
      ) : null}

      <Spacer h={S.xl} />
      <Tiny style={{ textAlign: 'center' }}>Demo build · sample FBISE Class 9 content</Tiny>
    </Screen>
  );
}
