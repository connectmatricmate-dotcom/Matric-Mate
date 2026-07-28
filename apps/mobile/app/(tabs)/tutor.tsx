import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon, IconName } from '../../src/components/Icon';
import { Card, Empty, Item, Pill, Ring, Row, Screen, SectionTitle, Small, Spacer, Tiny } from '../../src/components/ui';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

const ENTRIES: { label: string; sub: string; icon: IconName; prompt: string }[] = [
  { label: 'Ask a doubt', sub: 'Type your question', icon: 'spark', prompt: '' },
  { label: 'Explain a topic', sub: 'From your chapters', icon: 'book', prompt: 'Explain Newton’s second law simply' },
  { label: 'Solve a question', sub: 'Step by step', icon: 'calc', prompt: 'Solve: a 5 kg body is pushed with 20 N. Find acceleration.' },
  { label: 'Concept clarity', sub: 'Simple words + example', icon: 'help', prompt: 'What is inertia? Give an example.' },
];

export default function Tutor() {
  const { state, derived } = useApp();
  const usedPct = ((derived.aiLimit - derived.aiLeft) / derived.aiLimit) * 100;
  const low = derived.aiLeft <= Math.max(1, Math.floor(derived.aiLimit * 0.2));

  return (
    <Screen>
      <Row style={{ paddingTop: S.sm, paddingBottom: S.sm }} gap={S.sm}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.display, fontSize: 21, color: C.ink }}>AI Tutor</Text>
          <Small style={{ fontFamily: F.bodyBold }}>24/7 — English ya Urdu mein poochho</Small>
        </View>
        <Ring pct={usedPct} size={46} stroke={6} color={low ? C.orange : C.teal}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 10.5, color: C.ink }}>
            {derived.aiLeft}/{derived.aiLimit}
          </Text>
        </Ring>
      </Row>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
        {ENTRIES.map((e) => (
          <Card
            key={e.label}
            onPress={() => router.push(e.prompt ? `/tutor/chat?q=${encodeURIComponent(e.prompt)}` : '/tutor/chat')}
            style={{ flexGrow: 1, flexBasis: '46%', gap: 6 }}
          >
            <Icon name={e.icon} color={C.teal} />
            <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{e.label}</Text>
            <Small style={{ fontSize: 11.5 }}>{e.sub}</Small>
          </Card>
        ))}
      </View>

      <Spacer h={S.md} />
      <Card
        onPress={() => router.push('/tutor/ai-test')}
        border={C.orange}
        style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}
      >
        <Icon name="spark" color={C.orangeDark} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>Make me a test</Text>
          <Small>AI picks questions from your weak topics</Small>
        </View>
        <Icon name="chevron" size={18} color={C.ink3} />
      </Card>

      {derived.aiLeft === 0 ? (
        <>
          <Spacer h={S.md} />
          <Card flat tint={C.redTint} border={C.red}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.red }}>Daily limit reached</Text>
            <Small style={{ marginTop: 2 }}>
              Your {derived.aiLimit} questions reset at 12 AM.
              {state.premium.active ? '' : ' Premium gets 20 a day.'}
            </Small>
          </Card>
        </>
      ) : null}

      <SectionTitle>Recent chats</SectionTitle>
      {state.threads.length === 0 ? (
        <Empty emoji="💬" title="No questions yet" sub="Ask your first doubt — it’s the fastest way to unstick yourself." />
      ) : (
        <Card flat style={{ paddingVertical: 2 }}>
          {state.threads.slice(0, 6).map((t, i) => (
            <Item
              key={t.id}
              title={t.title}
              sub={`${t.contextLabel ?? 'General'} · ${new Date(t.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
              icon="spark"
              last={i === Math.min(5, state.threads.length - 1)}
              onPress={() => router.push(`/tutor/chat?thread=${t.id}`)}
            />
          ))}
        </Card>
      )}

      <Spacer h={S.lg} />
      <Tiny style={{ textAlign: 'center' }}>AI can make mistakes — verify with your book.</Tiny>
    </Screen>
  );
}
