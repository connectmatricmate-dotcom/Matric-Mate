import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, IconName } from '../../src/components/Icon';
import { Card, Empty, Item, Ring, Row, Screen, SectionTitle, Small, Spacer, Tiny } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

const ENTRIES: { label: StringKey; sub: StringKey; icon: IconName; prompt: string }[] = [
  { label: 'tutor.askDoubt', sub: 'tutor.askDoubtSub', icon: 'spark', prompt: '' },
  { label: 'tutor.explainTopic', sub: 'tutor.explainTopicSub', icon: 'book', prompt: 'Explain Newton’s second law simply' },
  { label: 'tutor.solveQuestion', sub: 'tutor.solveQuestionSub', icon: 'calc', prompt: 'A 5 kg body is pushed with 20 N. Find its acceleration.' },
  { label: 'tutor.conceptClarity', sub: 'tutor.conceptClaritySub', icon: 'help', prompt: 'What is inertia? Give an example.' },
];

export default function Tutor() {
  const { state, derived } = useApp();
  const t = useT();
  const usedPct = (derived.aiLimit ? (derived.aiLimit - derived.aiLeft) / derived.aiLimit : 0) * 100;
  const low = derived.aiLeft <= Math.max(1, Math.floor(derived.aiLimit * 0.2));

  return (
    <Screen tabbed>
      <Row style={{ paddingTop: S.sm, paddingBottom: S.md }} gap={S.sm}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.display, fontSize: 21, color: C.ink }}>{t('tutor.title')}</Text>
          <Small style={{ fontFamily: F.bodyBold }}>{t('tutor.sub')}</Small>
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
            <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{t(e.label)}</Text>
            <Small style={{ fontSize: 11.5 }}>{t(e.sub)}</Small>
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
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>{t('tutor.makeTest')}</Text>
          <Small>{t('tutor.makeTestSub')}</Small>
        </View>
        <Icon name="chevron" size={18} color={C.ink3} />
      </Card>

      {derived.aiLeft === 0 ? (
        <>
          <Spacer h={S.md} />
          {/* A free account has no quota to exhaust, so "your 0 questions
              reset at midnight" was nonsense. Say what it actually is. */}
          <Card flat tint={C.redTint} border={C.red}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.red }}>{t('tutor.limitTitle')}</Text>
            <Small style={{ marginTop: 2 }}>
              {derived.aiLimit === 0
                ? t('tutor.limitPremium')
                : `${t('tutor.limitBody', { n: derived.aiLimit })}${state.premium.active ? '' : ` ${t('tutor.limitPremium')}`}`}
            </Small>
          </Card>
        </>
      ) : null}

      <SectionTitle>{t('tutor.recentChats')}</SectionTitle>
      {state.threads.length === 0 ? (
        <Empty emoji="💬" title={t('tutor.noChatsTitle')} sub={t('tutor.noChatsBody')} />
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {state.threads.slice(0, 6).map((thread, i) => (
            <Item
              key={thread.id}
              title={thread.title}
              sub={`${thread.contextLabel ?? ''} ${new Date(thread.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`.trim()}
              icon="spark"
              last={i === Math.min(5, state.threads.length - 1)}
              onPress={() => router.push(`/tutor/chat?thread=${thread.id}`)}
            />
          ))}
        </Card>
      )}

      <Spacer h={S.lg} />
      <Tiny style={{ textAlign: 'center' }}>{t('tutor.disclaimer')}</Tiny>
    </Screen>
  );
}
