import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon, IconName } from '../../src/components/Icon';
import { Card, Empty, Item, Pill, Screen, SectionTitle, Small, Spacer } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

const MODES: { label: StringKey; sub: StringKey; icon: IconName; href: string; accent?: boolean }[] = [
  { label: 'practice.mcqs', sub: 'practice.mcqsSub', icon: 'target', href: '/session/setup' },
  { label: 'practice.flashcards', sub: 'practice.flashcardsSub', icon: 'cards', href: '/session/flashcards' },
  { label: 'practice.blanks', sub: 'practice.blanksSub', icon: 'edit', href: '/session/blanks' },
  { label: 'practice.shortQ', sub: 'practice.shortQSub', icon: 'quill', href: '/session/shortq' },
  { label: 'practice.papers', sub: 'practice.papersSub', icon: 'doc', href: '/session/papers' },
  { label: 'practice.exam', sub: 'practice.examSub', icon: 'clock', href: '/session/exam-intro', accent: true },
];

export default function Practice() {
  const { state } = useApp();
  const t = useT();
  const recent = state.results.slice(0, 4);

  return (
    <Screen tabbed>
      <AppHeader title={t('practice.title')} eyebrow={t('practice.sub')} showStreak={false} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
        {MODES.map((m) => (
          <Card
            key={m.label}
            onPress={() => router.push(m.href as never)}
            border={m.accent ? C.orange : undefined}
            style={{ flexGrow: 1, flexBasis: '46%', gap: 6 }}
          >
            <Icon name={m.icon} color={m.accent ? C.orangeDark : C.teal} />
            <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>{t(m.label)}</Text>
            <Small style={{ fontSize: 11.5 }}>{t(m.sub)}</Small>
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
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>{t('practice.aiTest')}</Text>
          <Small>{t('practice.aiTestSub')}</Small>
        </View>
        <Icon name="chevron" size={18} color={C.ink3} />
      </Card>

      <SectionTitle>{t('practice.recent')}</SectionTitle>
      {recent.length === 0 ? (
        <Empty emoji="🎯" title={t('practice.noneTitle')} sub={t('practice.noneBody')} />
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {recent.map((r, i) => (
            <Item
              key={r.id}
              title={r.label}
              sub={`${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${r.score}/${r.total} · +${r.xp} XP`}
              icon={r.mode === 'exam' ? 'clock' : 'target'}
              tone={r.mode === 'exam' ? 'orange' : 'teal'}
              last={i === recent.length - 1}
              right={<Pill tone={r.score / r.total >= 0.7 ? 'green' : 'red'}>{`${Math.round((r.score / r.total) * 100)}%`}</Pill>}
            />
          ))}
        </Card>
      )}

      <Spacer h={S.md} />
      <Small>{t('practice.answered', { n: state.attempts.length })}</Small>
    </Screen>
  );
}
