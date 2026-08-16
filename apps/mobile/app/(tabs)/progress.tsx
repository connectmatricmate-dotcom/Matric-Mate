import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Bar, Card, Item, Kpi, Pill, Ring, Row, Screen, SectionTitle, Small, Spacer, Tap } from '../../src/components/ui';
import { accuracy, formatDate, grade, last14, overallPct, subjectById, subjectPct, weakTopics } from '@matricmate/core';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

export default function Progress() {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();

  const overall = useMemo(
    () => overallPct(derived.subjects, state.readSections, state.attempts),
    [derived.subjects, state.readSections, state.attempts]
  );
  const days = useMemo(() => last14(state.activeDays), [state.activeDays]);
  const weak = useMemo(() => weakTopics(state.attempts).slice(0, 3), [state.attempts]);
  const acc = accuracy(state.attempts);
  // Pinned once on mount rather than read during render: a render must be
  // repeatable, and the month label has no business changing mid-screen.
  const [now] = useState(() => Date.now());
  const month = formatDate(now, lang, { month: 'long' });

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
        <Kpi value={`${state.attempts.length}`} label={t('dash.questions')} small />
        <Kpi value={`${acc}%`} label={t('dash.accuracy')} small />
        <Kpi value={String(state.activeDays.length)} label={t('dash.activeDays')} small />
        <Kpi value={`${state.results.length}`} label={t('progress.tests')} small />
      </Row>

      <SectionTitle action={link(t('common.details'), '/insights/performance')}>{t('progress.bySubject')}</SectionTitle>
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

      <SectionTitle action={link(t('common.seeAll'), '/insights/weak')}>{t('progress.weakTopics')}</SectionTitle>
      {weak.length === 0 ? (
        <Card flat>
          <Small>{t('progress.weakEmpty')}</Small>
        </Card>
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {weak.map((w, i) => (
            <Item
              key={w.topic}
              title={w.topic}
              sub={subjectById(w.subjectId)?.name}
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
      <Card border={C.orange} onPress={() => router.push('/insights/report')}>
        <Row gap={S.md}>
          <Text style={{ fontSize: 26 }}>🎓</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{t('progress.reportCard', { month })}</Text>
            <Small>{t('progress.reportCardSub', { grade: grade(acc) })}</Small>
          </View>
          <Pill tone="orange">{t('progress.open')}</Pill>
        </Row>
      </Card>
    </Screen>
  );
}
