import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Bar, Card, Item, Kpi, Pill, Ring, Row, Screen, SectionTitle, Small, Spacer, Tap } from '../../src/components/ui';
import { subjectById } from '../../src/core/content';
import { accuracy, grade, last14, overallPct, subjectPct, weakTopics } from '../../src/core/domain';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

export default function Progress() {
  const { state, derived } = useApp();

  const overall = useMemo(
    () => overallPct(derived.subjects, state.readSections, state.attempts),
    [derived.subjects, state.readSections, state.attempts]
  );
  const days = useMemo(() => last14(state.activeDays), [state.activeDays]);
  const weak = useMemo(() => weakTopics(state.attempts).slice(0, 3), [state.attempts]);
  const acc = accuracy(state.attempts);
  const minutes = state.attempts.length * 1.6 + state.readSections.length * 4;

  return (
    <Screen>
      <AppHeader title="Progress" eyebrow="Dekho kitna aa gaya 📈" />

      <Card>
        <Row gap={S.lg}>
          <Ring pct={overall} size={84} stroke={9}>
            <Text style={{ fontFamily: F.display, fontSize: 18, color: C.ink }}>{overall}%</Text>
          </Ring>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>Syllabus covered</Text>
            <Small>{derived.streak > 0 ? `${derived.streak}-day streak — keep it alive.` : 'Study today to start a streak.'}</Small>
            <Row gap={4} style={{ marginTop: S.sm }}>
              {days.map((on, i) => (
                <View
                  key={i}
                  style={{
                    width: 14,
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
          </View>
        </Row>
      </Card>

      <Spacer h={S.md} />
      <Row gap={S.sm}>
        <Kpi value={`${state.attempts.length}`} label="questions" small />
        <Kpi value={`${acc}%`} label="accuracy" small />
        <Kpi value={`${Math.round(minutes / 60)}h`} label="study time" small />
        <Kpi value={`${state.results.length}`} label="tests" small />
      </Row>

      <SectionTitle action={<Tap onPress={() => router.push('/insights/performance')}><Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.teal }}>Details</Text></Tap>}>
        By subject
      </SectionTitle>
      <Card flat style={{ gap: S.md }}>
        {derived.subjects.slice(0, 6).map((sid) => {
          const pct = subjectPct(sid, state.readSections, state.attempts);
          return (
            <Tap key={sid} onPress={() => router.push('/insights/performance')}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }}>{subjectById(sid)?.name}</Text>
                <Small style={{ fontFamily: F.bodyBold }}>{pct}%</Small>
              </Row>
              <View style={{ marginTop: 5 }}>
                <Bar pct={pct} tone="teal" />
              </View>
            </Tap>
          );
        })}
      </Card>

      <SectionTitle action={<Tap onPress={() => router.push('/insights/weak')}><Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.teal }}>All</Text></Tap>}>
        Weak topics
      </SectionTitle>
      {weak.length === 0 ? (
        <Card flat>
          <Small>Practice a bit more — we’ll point out your weak spots once there’s enough data.</Small>
        </Card>
      ) : (
        <Card flat style={{ paddingVertical: 2 }}>
          {weak.map((w, i) => (
            <Item
              key={w.topic}
              title={w.topic}
              sub={`${subjectById(w.subjectId)?.name} · ${w.accuracy}% accuracy`}
              emoji="⚠️"
              tone={w.accuracy < 50 ? 'red' : 'orange'}
              last={i === weak.length - 1}
              onPress={() => router.push('/insights/weak')}
              right={<Pill tone={w.accuracy < 50 ? 'red' : 'orange'}>{w.accuracy}%</Pill>}
            />
          ))}
        </Card>
      )}

      <Spacer h={S.md} />
      <Card border={C.orange} onPress={() => router.push('/insights/report')}>
        <Row gap={S.md}>
          <Text style={{ fontSize: 26 }}>🎓</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>
              {new Date().toLocaleDateString('en-GB', { month: 'long' })} report card
            </Text>
            <Small>Overall {grade(acc)} · share with Abbu/Ammi</Small>
          </View>
          <Pill tone="orange">Open</Pill>
        </Row>
      </Card>
      <Spacer h={S.lg} />
    </Screen>
  );
}
