import { boardName, formatDate, pastPaperYears } from '@matricmate/core';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon, IconName } from '../../src/components/Icon';
import {
  Btn,
  Card,
  Chevron,
  Empty,
  Item,
  Pill,
  Screen,
  SectionTitle,
  Sheet,
  Small,
  Spacer,
  TileGrid,
} from '../../src/components/ui';
import { LockedNotice } from '../../src/components/LockedNotice';
import { useLang, useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, rowDir } from '../../src/theme';

const MODES: { label: StringKey; sub: StringKey; icon: IconName; href: string; accent?: boolean }[] = [
  { label: 'practice.mcqs', sub: 'practice.mcqsSub', icon: 'target', href: '/session/setup' },
  { label: 'practice.flashcards', sub: 'practice.flashcardsSub', icon: 'cards', href: '/session/flashcards' },
  { label: 'practice.blanks', sub: 'practice.blanksSub', icon: 'edit', href: '/session/blanks' },
  { label: 'practice.shortQ', sub: 'practice.shortQSub', icon: 'quill', href: '/session/shortq' },
  { label: 'practice.papers', sub: 'practice.papersSub', icon: 'doc', href: '/session/papers' },
  { label: 'practice.toppers', sub: 'practice.toppersSub', icon: 'award', href: '/session/topper-papers' },
  { label: 'practice.exam', sub: 'practice.examSub', icon: 'clock', href: '/session/exam-intro', accent: true },
];

export default function Practice() {
  const { state } = useApp();
  const t = useT();
  const { lang } = useLang();
  const recent = state.results.slice(0, 5);
  /**
   * Paid-only: the practice grid is the shop window for unpaid accounts.
   * Everything stays visible so they can see what they would get, nothing
   * navigates, because every session behind these tiles fetches content the
   * server will not serve them. Topper papers stay open: board URLs, not
   * our content.
   */
  const paid = state.premium.active;
  // A dimmed tile that swallows the tap teaches nothing: the student cannot
  // tell the app from a dead one. Same sheet the study shelf opens.
  const [showLocked, setShowLocked] = useState(false);
  /**
   * The past papers tile says what the catalogue actually holds.
   *
   * It used to read "FBISE 2019 to 2025" from a literal in both language
   * tables, over nine papers across 2023, 2024 and 2025, all Class 9. A Class
   * 10 student got the same promise above the honest empty state behind it.
   */
  const classLevel = state.onboarding?.classLevel ?? 9;
  const board = state.onboarding?.board ?? 'fbise';
  const years = pastPaperYears(classLevel, board);
  const papersSub = years
    ? t('practice.papersSub', {
        board: boardName(board, lang),
        years: years.from === years.to ? years.from : `${years.from} to ${years.to}`,
      })
    : t('practice.papersSubNone', { n: classLevel });
  const subFor = (m: (typeof MODES)[number]) => (m.href === '/session/papers' ? papersSub : t(m.sub));


  return (
    <Screen tabbed>
      <AppHeader title={t('practice.title')} eyebrow={t('practice.sub')} showStreak={false} />

      {!paid ? (
        <>
          <LockedNotice variant="free" />
          <Spacer h={S.sm} />
        </>
      ) : null}

      <TileGrid
        tiles={MODES.filter((m) => m.href !== '/session/topper-papers' || board !== 'punjab').map((m) => {
          const open = paid || m.href === '/session/topper-papers';
          return {
            key: m.label,
            full: m.accent,
            node: m.accent ? (
              // The timed test is the special one, so it gets a whole row,
              // laid out like the AI banner below it rather than a stray tile.
              <Card
                onPress={open ? () => router.push(m.href as never) : () => setShowLocked(true)}
                border={C.orange}
                style={{ flexDirection: rowDir(), alignItems: 'center', gap: S.md, opacity: open ? 1 : 0.62 }}
              >
                <Icon name={open ? m.icon : 'lock'} color={C.orangeDark} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>{t(m.label)}</Text>
                  <Small style={{ fontSize: 11.5 }}>{subFor(m)}</Small>
                </View>
                <Chevron size={18} color={C.ink3} />
              </Card>
            ) : (
              <Card
                onPress={open ? () => router.push(m.href as never) : () => setShowLocked(true)}
                style={{ flex: 1, gap: 6, minHeight: 106, opacity: open ? 1 : 0.62 }}
              >
                <Icon name={open ? m.icon : 'lock'} color={C.teal} />
                <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>{t(m.label)}</Text>
                <Small style={{ fontSize: 11.5 }} numberOfLines={2}>
                  {subFor(m)}
                </Small>
              </Card>
            ),
          };
        })}
      />

      <Spacer h={S.md} />
      <Card
        onPress={() => router.push('/tutor/ai-test')}
        style={{ borderStyle: 'dashed', borderColor: C.tealTint2, flexDirection: rowDir(), alignItems: 'center', gap: S.md }}
      >
        <Icon name="spark" color={C.orangeDark} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>{t('practice.aiTest')}</Text>
          <Small>{t('practice.aiTestSub')}</Small>
        </View>
        <Chevron size={18} color={C.ink3} />
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
              sub={`${formatDate(r.at, lang, { day: 'numeric', month: 'short' })} · ${r.score}/${r.total} · +${r.xp} XP`}
              icon={r.mode === 'exam' ? 'clock' : 'target'}
              tone={r.mode === 'exam' ? 'orange' : 'teal'}
              last={i === recent.length - 1}
              right={<Pill tone={(r.total ? r.score / r.total : 0) >= 0.7 ? 'green' : 'red'}>{`${Math.round((r.total ? r.score / r.total : 0) * 100)}%`}</Pill>}
            />
          ))}
        </Card>
      )}

      <Spacer h={S.md} />
      <Small>{t('practice.answered', { n: state.attempts.length })}</Small>

      <Sheet visible={showLocked} onClose={() => setShowLocked(false)} title={t('billing.premium')}>
        <LockedNotice variant="free" />
        <Spacer h={S.md} />
        <Btn title={t('common.close')} variant="line" onPress={() => setShowLocked(false)} />
      </Sheet>
    </Screen>
  );
}
