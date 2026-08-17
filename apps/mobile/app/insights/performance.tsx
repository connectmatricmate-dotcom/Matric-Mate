import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { Bar, Card, Header, Item, Label, Row, Screen, SectionTitle, Seg, Small, Spacer } from '../../src/components/ui';
import { accuracy, confidenceBreakdown, formatDate } from '@matricmate/core';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

type Range = 'week' | 'month' | 'all';

/**
 * One y-mapping for the accuracy chart, shared by the gridlines and the
 * polyline. They used to use two slightly different formulas, so the 50%
 * gridline sat five pixels away from a 50% data point.
 */
const CHART_W = 300;
const yFor = (pct: number) => 80 - (pct / 100) * 70; // 0% -> y=80, 100% -> y=10

export default function Performance() {
  const { state } = useApp();
  const t = useT();
  const { lang } = useLang();
  const [range, setRange] = useState<Range>('month');

  /**
   * One clock reading for the whole screen, taken on mount.
   *
   * Two things wanted the time here and each was reading it separately, so the
   * filter below and the day buckets underneath it could land on opposite sides
   * of midnight and disagree about which day an attempt belonged to. Reading it
   * once fixes that, and keeps render repeatable, which is what the hooks rule
   * is really asking for.
   */
  const [now] = useState(() => Date.now());

  const attempts = useMemo(() => {
    const cut = range === 'week' ? 7 : range === 'month' ? 30 : 3650;
    const since = now - cut * 864e5;
    return state.attempts.filter((a) => a.at >= since);
  }, [state.attempts, range, now]);

  const trend = useMemo(() => {
    const days = range === 'week' ? 7 : 14;
    return Array.from({ length: days }, (_, i) => {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1 - i));
      const end = start.getTime() + 864e5;
      const set = attempts.filter((a) => a.at >= start.getTime() && a.at < end);
      return { acc: set.length ? accuracy(set) : null, count: set.length };
    });
  }, [attempts, range, now]);

  const points = useMemo(() => {
    const valid = trend.map((x, i) => ({ ...x, i })).filter((x) => x.acc != null);
    if (valid.length < 2) return '';
    return valid.map((x) => `${(x.i / (trend.length - 1)) * CHART_W},${yFor(x.acc as number)}`).join(' ');
  }, [trend]);

  // Every attempt, not the selected range, so this block matches the card
  // on the dashboard. The range picker above governs the trend chart.
  const conf = useMemo(() => confidenceBreakdown(state.attempts), [state.attempts]);
  const maxCount = Math.max(1, ...trend.map((x) => x.count));
  const confLabels = [t('session.conf0'), t('session.conf1'), t('session.conf2')];

  return (
    <Screen>
      <Header title={t('progress.perfTitle')} sub={t('progress.perfSub', { n: attempts.length })} back />

      <Seg
        value={range}
        onChange={setRange}
        options={[
          { value: 'week', label: t('progress.week') },
          { value: 'month', label: t('progress.month') },
          { value: 'all', label: t('progress.allTime') },
        ]}
      />

      <Spacer h={S.md} />
      <Card>
        <Label>{t('progress.accuracyTrend')}</Label>
        <View style={{ marginTop: S.sm }}>
          <Svg width="100%" height={90} viewBox="0 0 300 90">
            {[25, 50, 75].map((g) => (
              <Rect key={g} x={0} y={yFor(g)} width={CHART_W} height={1} fill="#EFF3F0" />
            ))}
            {points ? <Polyline points={points} fill="none" stroke={C.teal} strokeWidth={3} strokeLinecap="round" /> : null}
            {points ? (
              <Circle
                cx={Number(points.split(' ').slice(-1)[0].split(',')[0])}
                cy={Number(points.split(' ').slice(-1)[0].split(',')[1])}
                r={4.5}
                fill={C.orange}
              />
            ) : null}
          </Svg>
          {!points ? <Small style={{ textAlign: 'center' }}>{t('progress.notEnoughData')}</Small> : null}
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <Small style={{ fontFamily: F.bodyBold, fontSize: 10.5 }}>
            {t('progress.daysAgo', { n: range === 'week' ? 7 : 14 })}
          </Small>
          <Small style={{ fontFamily: F.bodyBold, fontSize: 10.5 }}>{t('progress.today', { n: accuracy(attempts) })}</Small>
        </Row>
      </Card>

      <Spacer h={S.md} />
      <Card>
        <Label>{t('progress.questionsPerDay')}</Label>
        <View style={{ marginTop: S.sm }}>
          <Svg width="100%" height={70} viewBox="0 0 300 70">
            {trend.map((x, i) => {
              const bw = 300 / trend.length - 6;
              const h = (x.count / maxCount) * 58;
              return (
                <Rect
                  key={i}
                  x={(300 / trend.length) * i + 3}
                  y={64 - h}
                  width={bw}
                  height={Math.max(2, h)}
                  rx={4}
                  fill={i >= trend.length - 2 ? C.orange : '#B9D2DB'}
                />
              );
            })}
          </Svg>
        </View>
      </Card>

      <Spacer h={S.md} />
      <Card border={C.orange}>
        <Label style={{ color: C.orangeDark }}>{t('progress.confidenceTitle')}</Label>
        <View style={{ gap: S.md, marginTop: S.md }}>
          {conf.map((r) => (
            <View key={r.confidence}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: C.ink }}>{confLabels[r.confidence]}</Text>
                <Small style={{ fontFamily: F.bodyBold }}>
                  {r.said ? t('progress.saidTimes', { n: r.accuracy, times: r.said }) : t('progress.notUsed')}
                </Small>
              </Row>
              <View style={{ marginTop: 5 }}>
                <Bar pct={r.accuracy} tone={r.confidence === 2 ? 'green' : r.confidence === 1 ? 'orange' : 'red'} />
              </View>
            </View>
          ))}
        </View>
      </Card>

      <SectionTitle>{t('progress.testsTitle')}</SectionTitle>
      {state.results.length === 0 ? (
        <Card flat>
          <Small>{t('progress.noTests')}</Small>
        </Card>
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {state.results.slice(0, 6).map((r, i) => (
            <Item
              key={r.id}
              title={r.label}
              sub={`${formatDate(r.at, lang, { day: 'numeric', month: 'short' })} · ${r.score}/${r.total} · +${r.xp} XP`}
              icon={r.mode === 'exam' ? 'clock' : 'target'}
              tone={r.mode === 'exam' ? 'orange' : 'teal'}
              last={i === Math.min(5, state.results.length - 1)}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
