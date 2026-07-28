import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon, IconName } from '../../src/components/Icon';
import { Card, Item, Pill, Row, Screen, SectionTitle, Small, Spacer, Empty } from '../../src/components/ui';
import { subjectById } from '../../src/core/content';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

const MODES: { label: string; sub: string; icon: IconName; href: string; accent?: boolean }[] = [
  { label: 'MCQs', sub: 'Topic-wise & mixed', icon: 'target', href: '/session/setup' },
  { label: 'Flashcards', sub: 'Active recall', icon: 'cards', href: '/session/flashcards' },
  { label: 'Fill in the blanks', sub: 'Test your recall', icon: 'edit', href: '/session/blanks' },
  { label: 'Short questions', sub: 'With model answers', icon: 'quill', href: '/session/shortq' },
  { label: 'Past papers', sub: 'FBISE 2019–2025', icon: 'doc', href: '/session/papers' },
  { label: 'Timed exam', sub: 'XP ×2', icon: 'clock', href: '/session/exam-intro', accent: true },
];

export default function Practice() {
  const { state } = useApp();
  const recent = state.results.slice(0, 4);

  return (
    <Screen>
      <AppHeader title="Practice" eyebrow="Har question type, ek jagah" showStreak={false} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
        {MODES.map((m) => (
          <Card
            key={m.label}
            onPress={() => router.push(m.href as never)}
            border={m.accent ? C.orange : undefined}
            style={{ flexGrow: 1, flexBasis: '46%', gap: 6 }}
          >
            <Icon name={m.icon} color={m.accent ? C.orangeDark : C.teal} />
            <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>{m.label}</Text>
            <Small style={{ fontSize: 11.5 }}>{m.sub}</Small>
          </Card>
        ))}
      </View>

      <Spacer h={S.md} />
      <Card
        onPress={() => router.push('/tutor/ai-test')}
        style={{ borderStyle: 'dashed', borderColor: C.tealTint2, flexDirection: 'row', alignItems: 'center', gap: S.md }}
      >
        <Icon name="spark" color={C.orangeDark} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>AI test — from my weak topics</Text>
          <Small>Personalised paper in seconds</Small>
        </View>
        <Icon name="chevron" size={18} color={C.ink3} />
      </Card>

      <SectionTitle>Recent sessions</SectionTitle>
      {recent.length === 0 ? (
        <Empty emoji="🎯" title="No sessions yet" sub="Start with 10 MCQs — takes about five minutes." />
      ) : (
        <Card flat style={{ paddingVertical: 2 }}>
          {recent.map((r, i) => (
            <Item
              key={r.id}
              title={r.label}
              sub={`${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${r.score}/${r.total} · +${r.xp} XP`}
              icon={r.mode === 'exam' ? 'clock' : 'target'}
              tone={r.mode === 'exam' ? 'orange' : 'teal'}
              last={i === recent.length - 1}
              right={<Pill tone={r.score / r.total >= 0.7 ? 'green' : 'red'}>{Math.round((r.score / r.total) * 100)}%</Pill>}
            />
          ))}
        </Card>
      )}

      <Spacer h={S.lg} />
      <Row gap={S.sm}>
        <Pill tone="grey">{state.attempts.length} questions answered</Pill>
        <Pill tone="grey">{subjectById(state.results[0]?.subjectId ?? 'phy')?.name ?? 'Physics'} most practised</Pill>
      </Row>
    </Screen>
  );
}
