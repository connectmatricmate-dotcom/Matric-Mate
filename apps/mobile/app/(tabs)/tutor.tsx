import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, IconName } from '../../src/components/Icon';
import { Card, Empty, Item, Ring, Row, Screen, SectionTitle, Small, Spacer, Tiny } from '../../src/components/ui';
import { fetchTutorQuota } from '@matricmate/core';
import type { TutorQuota } from '@matricmate/core';
import { supabase } from '../../src/lib/supabase';
import { useAsync } from '../../src/core/useAsync';
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

type ThreadRow = { id: string; title: string; context_label: string | null; updated_at: string };

export default function Tutor() {
  const { state, derived } = useApp();
  const t = useT();

  /**
   * The server's quota is the truth; the local counter is only the fallback
   * for the moment before the fetch lands. Same numbers the chat screen and
   * the website show, so the ring never disagrees with the input box.
   */
  const [quota, setQuota] = useState<TutorQuota | null>(null);
  useEffect(() => {
    let alive = true;
    fetchTutorQuota().then((q) => alive && q && setQuota(q));
    return () => {
      alive = false;
    };
  }, []);
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
      .order('updated_at', { ascending: false })
      .limit(6);
    if (error) throw new Error(error.message);
    return (data as ThreadRow[]) ?? [];
  }, [state.user?.id ?? '']);

  return (
    <Screen tabbed>
      <Row style={{ paddingTop: S.sm, paddingBottom: S.md }} gap={S.sm}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.display, fontSize: 21, color: C.ink }}>{t('tutor.title')}</Text>
          <Small style={{ fontFamily: F.bodyBold }}>{t('tutor.sub')}</Small>
        </View>
        <Ring pct={usedPct} size={46} stroke={6} color={low ? C.orange : C.teal}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 10.5, color: C.ink }}>
            {left}/{limit}
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

      {left === 0 ? (
        <>
          <Spacer h={S.md} />
          <Card flat tint={C.redTint} border={C.red}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.red }}>{t('tutor.limitTitle')}</Text>
            <Small style={{ marginTop: 2 }}>
              {limit === 0 ? t('tutor.limitPremium') : t('tutor.limitBody', { n: limit })}
            </Small>
          </Card>
        </>
      ) : null}

      <SectionTitle>{t('tutor.recentChats')}</SectionTitle>
      {!threads.data?.length ? (
        <Empty emoji="💬" title={t('tutor.noChatsTitle')} sub={t('tutor.noChatsBody')} />
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {threads.data.map((thread, i) => (
            <Item
              key={thread.id}
              title={thread.title}
              sub={`${thread.context_label ?? ''} ${new Date(thread.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`.trim()}
              icon="spark"
              last={i === threads.data!.length - 1}
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
