import { useMemo } from 'react';
import { Image, Text, View } from 'react-native';
import { Btn, Card, Header, Label, Pill, Row, Screen, Small, Spacer, useToast } from '../../src/components/ui';
import { subjectById } from '../../src/core/content';
import { accuracy, grade, subjectPct } from '../../src/core/domain';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

export default function Report() {
  const { state, derived } = useApp();
  const toast = useToast();

  const month = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const overallAcc = accuracy(state.attempts);

  const rows = useMemo(
    () =>
      derived.subjects.map((sid) => {
        const set = state.attempts.filter((a) => a.subjectId === sid);
        const acc = set.length ? accuracy(set) : subjectPct(sid, state.readSections, state.attempts);
        const half = Math.floor(set.length / 2);
        const older = set.slice(0, half);
        const recent = set.slice(half);
        const trend =
          older.length && recent.length
            ? accuracy(recent) - accuracy(older) > 4
              ? '↑'
              : accuracy(recent) - accuracy(older) < -4
                ? '↓'
                : '→'
            : '→';
        return { sid, acc, trend, attempted: set.length };
      }),
    [derived.subjects, state.attempts, state.readSections]
  );

  const activeDays = state.activeDays.filter((d) => d.slice(0, 7) === new Date().toISOString().slice(0, 7)).length;

  return (
    <Screen>
      <Header title="Report card" sub={month} back />

      <Card border={C.teal} style={{ borderWidth: 2, overflow: 'hidden' }}>
        <Row>
          <View style={{ flex: 1 }}>
            <Image source={require('../../assets/wordmark.png')} style={{ width: 120, height: 24 }} resizeMode="contain" />
            <Label style={{ marginTop: 4 }}>Monthly report · {month}</Label>
          </View>
          <View
            style={{
              width: 66,
              height: 66,
              borderRadius: 99,
              backgroundColor: C.orangeTint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: F.display, fontSize: 24, color: C.orangeDark }}>{grade(overallAcc)}</Text>
          </View>
        </Row>

        <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink, marginTop: S.md }}>
          {state.user?.name ?? 'Student'} · Class {state.onboarding?.classLevel ?? 9} ·{' '}
          {state.onboarding?.board === 'punjab' ? 'Punjab Board' : 'FBISE'}
        </Text>

        <View style={{ marginTop: S.md }}>
          {rows.map((r) => (
            <Row
              key={r.sid}
              style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, justifyContent: 'space-between' }}
            >
              <Text style={{ flex: 1, fontFamily: F.body, fontSize: 13.5, color: C.ink }}>{subjectById(r.sid)?.name}</Text>
              <Text style={{ fontFamily: F.display, fontSize: 15, color: C.ink, width: 44, textAlign: 'right' }}>
                {r.attempted ? grade(r.acc) : '—'}
              </Text>
              <Text
                style={{
                  width: 26,
                  textAlign: 'right',
                  fontFamily: F.bodyBold,
                  fontSize: 14,
                  color: r.trend === '↑' ? C.green : r.trend === '↓' ? C.red : C.ink3,
                }}
              >
                {r.trend}
              </Text>
            </Row>
          ))}
        </View>

        <Row gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap' }}>
          <Pill tone="teal">{activeDays} active days</Pill>
          <Pill tone="teal">{state.attempts.length} questions</Pill>
          <Pill tone="orange">{state.results.length} tests</Pill>
          <Pill tone="grey">{state.xp} XP · Level {derived.level}</Pill>
        </Row>
      </Card>

      <Spacer h={S.lg} />
      <Row gap={S.sm}>
        <View style={{ flex: 1 }}>
          <Btn
            title="Share"
            variant="whatsapp"
            icon="whatsapp"
            onPress={() => toast('Share sheet — sends the card as an image (M9)')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Btn title="Save PDF" variant="line" icon="download" onPress={() => toast('PDF export arrives with M9')} />
        </View>
      </Row>
      <Spacer h={S.md} />
      <Small>Grades come from your accuracy this month. Parents can view a shared card without an account.</Small>
    </Screen>
  );
}
