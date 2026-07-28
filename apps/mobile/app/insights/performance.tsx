import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { Bar, Card, Header, Item, Label, Row, Screen, SectionTitle, Seg, Small, Spacer } from '../../src/components/ui';
import { accuracy, confidenceBreakdown, confidenceInsight } from '../../src/core/domain';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

type Range = 'week' | 'month' | 'all';

export default function Performance() {
  const { state } = useApp();
  const [range, setRange] = useState<Range>('month');

  const attempts = useMemo(() => {
    const cut = range === 'week' ? 7 : range === 'month' ? 30 : 3650;
    const since = Date.now() - cut * 864e5;
    return state.attempts.filter((a) => a.at >= since);
  }, [state.attempts, range]);

  /** Accuracy per day, for the trend line. */
  const trend = useMemo(() => {
    const days = range === 'week' ? 7 : 14;
    return Array.from({ length: days }, (_, i) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1 - i));
      const end = start.getTime() + 864e5;
      const set = attempts.filter((a) => a.at >= start.getTime() && a.at < end);
      return { acc: set.length ? accuracy(set) : null, count: set.length };
    });
  }, [attempts, range]);

  const points = useMemo(() => {
    const w = 300;
    const h = 80;
    const valid = trend.map((t, i) => ({ ...t, i })).filter((t) => t.acc != null);
    if (valid.length < 2) return '';
    return valid
      .map((t) => `${(t.i / (trend.length - 1)) * w},${h - ((t.acc as number) / 100) * (h - 10) - 5}`)
      .join(' ');
  }, [trend]);

  const conf = useMemo(() => confidenceBreakdown(attempts), [attempts]);
  const insight = useMemo(() => confidenceInsight(conf), [conf]);
  const maxCount = Math.max(1, ...trend.map((t) => t.count));

  return (
    <Screen>
      <Header title="Performance" sub={`${attempts.length} questions in this range`} back />

      <Seg
        value={range}
        onChange={setRange}
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'all', label: 'All time' },
        ]}
      />

      <Spacer h={S.md} />
      <Card>
        <Label>Accuracy trend</Label>
        <View style={{ marginTop: S.sm }}>
          <Svg width="100%" height={90} viewBox="0 0 300 90">
            {[25, 50, 75].map((g) => (
              <Rect key={g} x={0} y={85 - (g / 100) * 80} width={300} height={1} fill="#EFF3F0" />
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
          {!points ? <Small style={{ textAlign: 'center' }}>Not enough data in this range yet.</Small> : null}
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <Small style={{ fontFamily: F.bodyBold, fontSize: 10.5 }}>
            {range === 'week' ? '7 days ago' : '14 days ago'}
          </Small>
          <Small style={{ fontFamily: F.bodyBold, fontSize: 10.5 }}>today · {accuracy(attempts)}%</Small>
        </Row>
      </Card>

      <Spacer h={S.md} />
      <Card>
        <Label>Questions per day</Label>
        <View style={{ marginTop: S.sm }}>
          <Svg width="100%" height={70} viewBox="0 0 300 70">
            {trend.map((t, i) => {
              const bw = 300 / trend.length - 6;
              const h = (t.count / maxCount) * 58;
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

      {/* the Pakka-meter payoff */}
      <Spacer h={S.md} />
      <Card border={C.orange}>
        <Label style={{ color: C.orangeDark }}>Confidence vs accuracy · Pakka-meter</Label>
        <View style={{ gap: S.md, marginTop: S.md }}>
          {conf.map((r) => (
            <View key={r.confidence}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: C.ink }}>{r.label}</Text>
                <Small style={{ fontFamily: F.bodyBold }}>
                  {r.said ? `${r.accuracy}% right · said ${r.said}×` : 'not used yet'}
                </Small>
              </Row>
              <View style={{ marginTop: 5 }}>
                <Bar
                  pct={r.accuracy}
                  tone={r.confidence === 2 ? 'green' : r.confidence === 1 ? 'orange' : 'red'}
                />
              </View>
            </View>
          ))}
        </View>
        {insight ? <Small style={{ marginTop: S.md }}>{insight}</Small> : null}
      </Card>

      <SectionTitle>Tests</SectionTitle>
      {state.results.length === 0 ? (
        <Card flat>
          <Small>No tests yet — try a timed exam to see how you do under pressure.</Small>
        </Card>
      ) : (
        <Card flat style={{ paddingVertical: 2 }}>
          {state.results.slice(0, 6).map((r, i) => (
            <Item
              key={r.id}
              title={r.label}
              sub={`${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${r.score}/${r.total} · +${r.xp} XP`}
              icon={r.mode === 'exam' ? 'clock' : 'target'}
              tone={r.mode === 'exam' ? 'orange' : 'teal'}
              last={i === Math.min(5, state.results.length - 1)}
              onPress={() => router.push('/session/review')}
            />
          ))}
        </Card>
      )}
      <Spacer h={S.lg} />
    </Screen>
  );
}
