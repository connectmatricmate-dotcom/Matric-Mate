import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '../../src/components/AppHeader';
import { ChapterPicker } from '../../src/components/ChapterPicker';
import { Icon, IconName } from '../../src/components/Icon';
import {
  Btn,
  Card,
  Chevron,
  Empty,
  ErrorState,
  Item,
  Pill,
  Ring,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  TileGrid,
  Tiny,
} from '../../src/components/ui';
import { BILLING_SITE, chapterName, formatDate } from '@matricmate/core';
import { supabase } from '../../src/lib/supabase';
import { useAsync } from '../../src/core/useAsync';
import { useLang, useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, rowDir } from '../../src/theme';
import { useQuota } from '../../src/core/useQuota';

/**
 * Three ways in, and not one of them spends a question.
 *
 * There were four, and three carried a hardcoded prompt that was sent the
 * instant you tapped the tile: "Explain a topic" asked about Newton's second
 * law, whoever you were. A Class 10 biology student tapping it got a physics
 * answer to a question they had not asked, in English however they had set the
 * app, and it cost them one of their fifty for the day. The fourth, "Make it
 * simple", opened the same chat as the first: four doors into one room.
 *
 * Now each tile opens the composer in a different state and the student
 * presses send. `ask` is an empty box. `explain` picks one of their own
 * chapters first and prefills a question they can edit. `photo` opens the
 * camera, which is the one genuinely different thing you can do here.
 */
const ENTRIES: { key: 'ask' | 'explain' | 'photo'; label: StringKey; sub: StringKey; icon: IconName; full?: boolean }[] = [
  { key: 'ask', label: 'tutor.askDoubt', sub: 'tutor.askDoubtSub', icon: 'spark', full: true },
  { key: 'explain', label: 'tutor.explainTopic', sub: 'tutor.explainTopicSub', icon: 'book' },
  { key: 'photo', label: 'tutor.solveQuestion', sub: 'tutor.solveQuestionSub', icon: 'camera' },
];

type ThreadRow = { id: string; title: string; context_label: string | null; updated_at: string };

export default function Tutor() {
  const { state, derived } = useApp();
  const [picking, setPicking] = useState(false);
  const t = useT();
  const { lang } = useLang();

  /**
   * The server's quota is the truth; the local counter is only the fallback
   * for the moment before the fetch lands. Same numbers the chat screen and
   * the website show, so the ring never disagrees with the input box.
   */
  const quota = useQuota();
  const left = quota ? quota.remaining : derived.aiLeft;
  const limit = quota ? quota.limit : derived.aiLimit;
  const usedPct = (limit ? (limit - left) / limit : 0) * 100;
  const low = left <= Math.max(1, Math.floor(limit * 0.2));

  /**
   * Recent chats come from Postgres, where the tutor route saves every
   * conversation, so a chat started on the website shows up here too. RLS
   * only returns the signed-in student's own threads.
   */
  const threads = useAsync<ThreadRow[]>(async () => {
    const { data, error } = await supabase
      .from('chat_threads')
      .select('id,title,context_label,updated_at')
      // Five here, the rest behind "View all". A tab is a launchpad, not an
      // archive, but an archive has to exist: see app/tutor/chats.tsx.
      .order('updated_at', { ascending: false })
      .limit(6);
    if (error) throw new Error(error.message);
    return (data as ThreadRow[]) ?? [];
  }, [state.user?.id ?? '']);

  return (
    <Screen tabbed>
      {/* The same header as the other four tab roots. This screen used to draw
          its own so the quota ring had somewhere to sit, and lost the settings
          gear and the notification bell with it: on one of five tabs there was
          no way to reach either. The ring is a right-hand slot now. */}
      <AppHeader
        title={t('tutor.title')}
        eyebrow={t('tutor.sub')}
        showStreak={false}
        right={
          /* An account with no plan has no allowance to draw a ring around.
             "0/0" read as a used-up plan, which is the opposite of the truth. */
          limit === 0 ? (
            <Pill tone="grey">{t('billing.statusFree')}</Pill>
          ) : (
            <Ring pct={usedPct} size={46} stroke={6} color={low ? C.orange : C.teal}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 10.5, color: C.ink }}>
                {left}/{limit}
              </Text>
            </Ring>
          )
        }
      />

      <TileGrid
        tiles={ENTRIES.map((e) => ({
          key: e.key,
          full: e.full,
          node: (
            <Card
              onPress={() => {
                if (e.key === 'explain') setPicking(true);
                else router.push(e.key === 'photo' ? '/tutor/chat?photo=1' : '/tutor/chat');
              }}
              style={{ flex: 1, gap: 6, minHeight: e.full ? 88 : 106 }}
            >
              <Icon name={e.icon} color={C.teal} />
              <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>{t(e.label)}</Text>
              <Small style={{ fontSize: 11.5 }} numberOfLines={2}>
                {t(e.sub)}
              </Small>
            </Card>
          ),
        }))}
      />

      {/* Picking a chapter prefills the box and stops. Nothing is sent until
          the student sends it, and the chapter rides along as context so the
          answer comes out of their own notes. */}
      <ChapterPicker
        visible={picking}
        onClose={() => setPicking(false)}
        onPick={({ chapter, topic }) => {
          setPicking(false);
          // The topic when they picked one, the chapter when they stopped
          // there. Either way the chapter id rides along, so the answer is
          // grounded in that chapter's own notes.
          const draft = t('tutor.explainDraft', { chapter: topic ?? chapterName(chapter, lang) });
          router.push(`/tutor/chat?chapter=${chapter.id}&draft=${encodeURIComponent(draft)}`);
        }}
      />

      <Spacer h={S.md} />
      <Card
        onPress={() => router.push('/tutor/ai-test')}
        border={C.orange}
        style={{ flexDirection: rowDir(), alignItems: 'center', gap: S.md }}
      >
        <Icon name="spark" color={C.orangeDark} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>{t('tutor.makeTest')}</Text>
          <Small>{t('tutor.makeTestSub')}</Small>
        </View>
        <Chevron size={18} color={C.ink3} />
      </Card>

      <Spacer h={S.sm} />
      <Card
        onPress={() => router.push('/tutor/paper')}
        border={C.teal}
        style={{ flexDirection: rowDir(), alignItems: 'center', gap: S.md }}
      >
        <Icon name="doc" color={C.teal} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>{t('tutor.paperTitle')}</Text>
          <Small>{t('tutor.paperSub')}</Small>
        </View>
        <Chevron size={18} color={C.ink3} />
      </Card>

      {/* Two different states wearing one face. A free account never had a
          daily allowance, so "Daily limit reached. Your plan includes 50 a
          day." told it about a plan it does not hold and a reset that will
          never come. It gets its own, calmer card, and the red one is kept
          for the account that genuinely spent today's questions. */}
      {limit === 0 ? (
        <>
          <Spacer h={S.md} />
          <Card flat tint={C.tealTint} border={C.teal}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>{t('tutor.noPlanTitle')}</Text>
            <Small style={{ marginTop: 2 }}>{t('tutor.noPlanBody')}</Small>
            {/* Plain text, never tappable: see core/billing.ts. */}
            <Small style={{ marginTop: 4 }}>{t('billing.manageNote', { site: BILLING_SITE })}</Small>
          </Card>
        </>
      ) : left === 0 ? (
        <>
          <Spacer h={S.md} />
          <Card flat tint={C.redTint} border={C.red}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.red }}>{t('tutor.limitTitle')}</Text>
            <Small style={{ marginTop: 2 }}>{t('tutor.limitBody', { n: limit })}</Small>
          </Card>
        </>
      ) : null}

      <SectionTitle>{t('tutor.recentChats')}</SectionTitle>
      {/* A failed read is not an empty history. It used to render the "no chats
          yet" card to a student with a month of them, which tells the wrong
          person to start a conversation and gives them nothing to retry. */}
      {threads.error && !threads.data?.length ? (
        <ErrorState
          title={t('states.errorTitle')}
          sub={t('states.errorBody')}
          retry={t('common.retry')}
          onRetry={threads.reload}
        />
      ) : !threads.data?.length ? (
        <Empty emoji="💬" title={t('tutor.noChatsTitle')} sub={t('tutor.noChatsBody')} />
      ) : (
        <>
          <Card flat style={{ paddingVertical: 0 }}>
            {threads.data.slice(0, 5).map((thread, i, shown) => (
              <Item
                key={thread.id}
                title={thread.title}
                sub={`${thread.context_label ?? ''} ${formatDate(thread.updated_at, lang, { day: 'numeric', month: 'short' })}`.trim()}
                icon="spark"
                last={i === shown.length - 1}
                onPress={() => router.push(`/tutor/chat?thread=${thread.id}`)}
              />
            ))}
          </Card>
          {/* Only when there is more to see. A button that opens a list of the
              same five you are already looking at is a small lie. */}
          {threads.data.length > 5 ? (
            <>
              <Spacer h={S.sm} />
              <Btn
                title={t('tutor.viewAllChats')}
                variant="ghost"
                icon="chevron"
                /* Cast because expo-router's route union is generated by the
                   dev server and does not know a route added since it last
                   ran. Same as ROUTE in core/usePush.ts. */
                onPress={() => router.push('/tutor/chats' as never)}
              />
            </>
          ) : null}
        </>
      )}

      <Spacer h={S.lg} />
      <Tiny style={{ textAlign: 'center' }}>{t('tutor.disclaimer')}</Tiny>
    </Screen>
  );
}
