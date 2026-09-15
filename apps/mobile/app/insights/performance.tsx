import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { Bar, Card, Header, Item, Label, Row, Screen, SectionTitle, Seg, Small, Spacer, Text } from '../../src/components/ui';
import { accuracy, confidenceBreakdown, formatDate } from '@matricmate/core';
import { resultTitle } from '../../src/components/resultTitle';
import { useNow } from '../../src/core/useNow';
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
   * One clock reading for the whole screen, held still while it is open.
   *
   * Two things wanted the time here and each was reading it separately, so the
   * filter below and the day buckets underneath it could land on opposite sides
   * of midnight and disagree about which day an attempt belonged to. Reading it
   * once fixes that, and keeps render repeatable, which is what the hooks rule
   * is really asking for. It moves on when the day turns (useNow).
   */
  const now = useNow();

  const attempts = useMemo(() => {
    const cut = range === 'week' ? 7 : range === 'month' ? 30 : 3650;
    const since = now - cut * 864e5;
    return state.attempts.filter((a) => a.at >= since);
  }, [state.attempts, range, now]);

  /**
   * One bar and one point per day for a week or a month, per week for all
   * time (twelve weeks), as on the website. Month and All time both drew the
   * same fourteen days, so the picker changed the number above the charts and
   * nothing in them.
   */
  const perWeek = range === 'all';
  const trend = useMemo(() => {
    const count = range === 'week' ? 7 : range === 'month' ? 30 : 12;
    const span = (perWeek ? 7 : 1) * 864e5;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const end = today.getTime() + 864e5;
    return Array.from({ length: count }, (_, i) => {
      const to = end - (count - 1 - i) * span;
      const set = attempts.filter((a) => a.at >= to - span && a.at < to);
      return { acc: set.length ? accuracy(set) : null, count: set.length };
    });
  }, [attempts, range, perWeek, now]);

  const points = useMemo(() => {
    const valid = trend.map((x, i) => ({ ...x, i })).filter((x) => x.acc != null);
    if (valid.length < 2) return '';
    return valid.map((x) => `${(x.i / (trend.length - 1)) * CHART_W},${yFor(x.acc as number)}`).join(' ');
  }, [trend]);

  // Every attempt, not the selected range, so this block matches the card
  // on the dashboard. The range picker above governs the trend chart.
  const conf = useMemo(() => confidenceBreakdown(state.attempts), [state.attempts]);
  const maxCount = Math.max(1, ...trend.map((x) => x.count));
  /**
   * The right-hand end of the chart is today, so the label under it has to be
   * today's accuracy. It was fed the whole selected range, 7, 30 or 3650 days,
   * so a student who had answered nothing today still read "today · 62%". The
   * last bucket is already computed for the line; when it is empty there is no
   * figure to give and the label says so.
   */
  const todaysBucket = trend[trend.length - 1];
  const todayLabel = perWeek
    ? todaysBucket?.acc != null
      ? t('progress.weekPct', { n: todaysBucket.acc })
      : t('progress.weekNone')
    : todaysBucket?.acc != null
      ? t('progress.today', { n: todaysBucket.acc })
      : t('progress.todayNone');
  const sinceLabel = perWeek ? t('progress.weeksAgo', { n: trend.length }) : t('progress.daysAgo', { n: trend.length });

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
        {/* Gridlines with no line through them read as a chart that failed to
            load rather than one with nothing to show yet, so an empty period
            draws no frame at all. Same on the website. */}
        {points ? (
          <>
            <View style={{ marginTop: S.sm }}>
              <Svg width="100%" height={90} viewBox="0 0 300 90">
                {[25, 50, 75].map((g) => (
                  <Rect key={g} x={0} y={yFor(g)} width={CHART_W} height={1} fill={C.grey} />
                ))}
                <Polyline points={points} fill="none" stroke={C.teal} strokeWidth={3} strokeLinecap="round" />
                <Circle
                  cx={Number(points.split(' ').slice(-1)[0].split(',')[0])}
                  cy={Number(points.split(' ').slice(-1)[0].split(',')[1])}
                  r={4.5}
                  fill={C.orange}
                />
              </Svg>
            </View>
            {/* A plain row, not the mirrored one: the chart line runs from
                the oldest day on the left to today on the right in both
                languages, so its labels have to as well. Mirrored, "today"
                sat under the oldest point in Urdu. */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Small style={{ fontFamily: F.bodyBold, fontSize: 10.5 }}>{sinceLabel}</Small>
              <Small style={{ fontFamily: F.bodyBold, fontSize: 10.5 }}>{todayLabel}</Small>
            </View>
          </>
        ) : (
          <Small style={{ marginTop: S.sm }}>{t('progress.notEnoughData')}</Small>
        )}
      </Card>

      <Spacer h={S.md} />
      <Card>
        <Label>{perWeek ? t('progress.questionsPerWeek') : t('progress.questionsPerDay')}</Label>
        <View style={{ marginTop: S.sm }}>
          <Svg width="100%" height={70} viewBox="0 0 300 70">
            {trend.map((x, i) => {
              // A share of the slot, not a fixed gap: thirty bars with a
              // six-unit gap each left almost nothing of the bars.
              const bw = (300 / trend.length) * 0.7;
              const h = (x.count / maxCount) * 58;
              return (
                <Rect
                  key={i}
                  x={(300 / trend.length) * (i + 0.15)}
                  y={64 - h}
                  width={bw}
                  height={Math.max(2, h)}
                  rx={Math.min(4, bw / 2)}
                  // A theme colour, so dark mode gets a dark-mode bar.
                  fill={i >= trend.length - 2 ? C.orange : C.tealTint2}
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
                <Small style={{ fontFamily: F.bodyBold, flexShrink: 1 }}>
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
              // Rebuilt in today's language, not the one it was saved in.
              title={resultTitle(r, lang)}
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
