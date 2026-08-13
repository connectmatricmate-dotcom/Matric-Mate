import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { Body, Card, IconButton, Pill, Row, Screen, Small, Tap, useToast } from '../../src/components/ui';
import { api, chapterById, ChatMessage, fetchTutorQuota, weakTopics } from '@matricmate/core';
import type { TutorQuota } from '@matricmate/core';
import { supabase } from '../../src/lib/supabase';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, isWeb } from '../../src/theme';

/** "21:00" style local clock time out of the server's reset instant. */
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export default function Chat() {
  const { q, chapter, thread } = useLocalSearchParams<{ q?: string; chapter?: string; thread?: string }>();
  const { state, actions, derived } = useApp();
  const t = useT();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  /**
   * The server owns the conversation now. threadId is minted by the tutor
   * route on the first answer and echoed back; opening a saved chat passes
   * the id in and the history is read from Postgres under the student's own
   * row-level security, so the same chat shows up on the website too.
   */
  const [threadId, setThreadId] = useState<string | null>(thread ?? null);
  const [contextLabel, setContextLabel] = useState<string | undefined>(
    chapter ? chapterById(chapter)?.title : undefined
  );
  /** The server's count, not a local guess. Null until the first fetch lands. */
  const [quota, setQuota] = useState<TutorQuota | null>(null);

  useEffect(() => {
    let alive = true;
    fetchTutorQuota().then((qta) => alive && qta && setQuota(qta));
    return () => {
      alive = false;
    };
  }, []);

  /** A saved thread's history, loaded once. New chats skip this entirely. */
  useEffect(() => {
    if (!thread) return;
    let alive = true;
    (async () => {
      try {
        const [{ data: rows }, { data: meta }] = await Promise.all([
          supabase.from('chat_messages').select('id,role,content,at').eq('thread_id', thread).order('at'),
          supabase.from('chat_threads').select('context_label').eq('id', thread).maybeSingle(),
        ]);
        if (!alive || !rows) return;
        setMessages(
          rows.map((r) => ({
            id: r.id as string,
            role: r.role === 'assistant' ? ('ai' as const) : ('user' as const),
            text: r.content as string,
            at: Date.parse(r.at as string),
          }))
        );
        if (meta?.context_label) setContextLabel((c) => c ?? (meta.context_label as string));
      } catch {
        // History is a nicety; the chat still works as a fresh thread.
      }
    })();
    return () => {
      alive = false;
    };
  }, [thread]);

  const outOfQuestions = quota !== null && quota.remaining <= 0;

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || thinking) return;
    if (outOfQuestions) {
      toast(t('tutor.limitToast'));
      return;
    }
    const mine: ChatMessage = { id: `m-${Date.now()}`, role: 'user', text: clean, at: Date.now() };
    setMessages((m) => [...m, mine]);
    setInput('');
    setThinking(true);

    const res = await api.askTutor(clean, {
      threadId,
      context: contextLabel,
      profile: {
        name: state.user?.name,
        medium: state.settings.contentMedium,
        language: state.settings.language,
        subjects: derived.subjects,
        weakTopics: weakTopics(state.attempts)
          .slice(0, 3)
          .map((w) => w.topic),
      },
    });
    setThinking(false);

    if (res.reason) {
      // The question never reached an answer, so it must not sit in the chat
      // looking answered. Put it back in the box and say what happened.
      setMessages((m) => m.filter((x) => x.id !== mine.id));
      setInput(clean);
      if (res.quota) setQuota(res.quota);
      const note = {
        offline: t('tutor.offline'),
        quota: t('tutor.limitToast'),
        rate: t('tutor.slowDown'),
        plan: t('tutor.planNeeded'),
        refused: t('tutor.refused'),
        error: t('tutor.errorReply'),
      }[res.reason];
      toast(note);
      return;
    }

    const reply: ChatMessage = { id: `m-${Date.now()}-ai`, role: 'ai', text: res.text, steps: res.steps, at: Date.now() };
    setMessages((m) => [...m, reply]);
    if (res.threadId) setThreadId(res.threadId);
    if (res.quota) setQuota(res.quota);
    // Mirror into the local counter so the tutor tab's ring stays roughly
    // right between server fetches. The server remains the authority.
    actions.consumeAi();
  }

  /**
   * Arriving with `?q=` means the student asked from somewhere else, so the
   * question is sent on their behalf.
   *
   * Started after the first paint rather than inside the effect body. `send`
   * writes state before it ever awaits, and doing that while the effect is
   * still running makes the screen re-render before it has shown anything.
   * The timer is cleared on unmount so a question is not sent from a screen
   * already left.
   */
  useEffect(() => {
    if (!q || messages.length) return;
    const timer = setTimeout(() => send(String(q)), 0);
    return () => clearTimeout(timer);
    // Only a new `?q=` should retrigger this. Including `send` or `messages`
    // would re-ask the question on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages.length, thinking]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll={false} padded={false}>
        <Row style={{ paddingHorizontal: S.md, paddingBottom: S.sm, borderBottomWidth: 1, borderBottomColor: C.line }} gap={S.sm}>
          <IconButton icon="back" onPress={() => router.back()} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>{t('tutor.title')}</Text>
            {contextLabel ? <Small numberOfLines={1}>{t('tutor.context', { label: contextLabel })}</Small> : null}
          </View>
          {quota ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Pill tone={outOfQuestions ? 'red' : 'grey'}>
                {t('tutor.quotaPill', { n: quota.remaining, limit: quota.limit })}
              </Pill>
              {outOfQuestions ? (
                <Text style={{ fontFamily: F.body, fontSize: 10.5, color: C.ink3, marginTop: 3 }}>
                  {t('tutor.resetsAt', { time: clock(quota.resetAt) })}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Row>

        <ScrollView
          ref={scroller}
          contentContainerStyle={[
            { padding: S.lg, gap: S.md },
            isWeb && { maxWidth: 760, width: '100%', alignSelf: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && !thinking ? (
            <Card flat tint={C.tealTint}>
              <Body>{t('tutor.starter')}</Body>
            </Card>
          ) : null}

          {messages.map((m) =>
            m.role === 'user' ? (
              <View
                key={m.id}
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '84%',
                  backgroundColor: C.teal,
                  paddingVertical: 12,
                  paddingHorizontal: 15,
                  borderRadius: 18,
                  borderBottomRightRadius: 6,
                }}
              >
                <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 22, color: '#fff' }}>{m.text}</Text>
              </View>
            ) : (
              <View
                key={m.id}
                style={{
                  alignSelf: 'flex-start',
                  maxWidth: '92%',
                  backgroundColor: C.card,
                  borderWidth: 1,
                  borderColor: C.line,
                  padding: 15,
                  borderRadius: 18,
                  borderBottomLeftRadius: 6,
                }}
              >
                {/* A real answer is paragraphs, not a headline: body weight.
                    The bold treatment stays for the stepped mock shape. */}
                <Text
                  style={{
                    fontFamily: m.steps?.length ? F.bodyBold : F.body,
                    fontSize: 13.5,
                    lineHeight: 21,
                    color: C.ink,
                  }}
                >
                  {m.text}
                </Text>
                {m.steps?.map((step, i) => (
                  <Row key={i} gap={S.sm} style={{ marginTop: S.sm, alignItems: 'flex-start' }}>
                    <View style={{ width: 20, height: 20, borderRadius: 99, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: C.teal }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontFamily: F.body, fontSize: 13.5, lineHeight: 22, color: C.ink }}>{step}</Text>
                  </Row>
                ))}
                <Row gap={S.sm} style={{ marginTop: S.md }}>
                  <Pill tone="grey" onPress={() => toast(t('tutor.helpful'))}>
                    👍
                  </Pill>
                  <Pill tone="grey" onPress={() => toast(t('tutor.notHelpful'))}>
                    👎
                  </Pill>
                  <Pill tone="teal" onPress={() => send(t('tutor.reExplainUrdu'))}>
                    {t('tutor.inUrdu')}
                  </Pill>
                </Row>
              </View>
            )
          )}

          {thinking ? (
            <View style={{ alignSelf: 'flex-start', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, padding: 14, borderRadius: 18 }}>
              <Small>{t('tutor.thinking')}</Small>
            </View>
          ) : null}
        </ScrollView>

        <Row
          style={{
            paddingHorizontal: S.md,
            paddingTop: S.sm,
            paddingBottom: Math.max(insets.bottom, S.md),
            borderTopWidth: 1,
            borderTopColor: C.line,
            backgroundColor: C.card,
          }}
          gap={S.sm}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: outOfQuestions ? C.line : C.paper,
              borderWidth: 1.5,
              borderColor: C.line,
              borderRadius: 99,
              paddingHorizontal: 16,
              paddingVertical: 11,
            }}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              editable={!outOfQuestions}
              placeholder={
                outOfQuestions && quota
                  ? t('tutor.limitInputHint', { time: clock(quota.resetAt) })
                  : t('tutor.placeholder')
              }
              placeholderTextColor={C.ink3}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              style={[
                { fontFamily: F.body, fontSize: 14, color: C.ink, paddingVertical: 0 },
                isWeb && ({ outlineStyle: 'none' } as object),
              ]}
            />
          </View>
          <Tap onPress={() => send(input)}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 99,
                backgroundColor: input.trim() && !outOfQuestions ? C.teal : C.ink3,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="send" size={19} color="#fff" />
            </View>
          </Tap>
        </Row>
      </Screen>
    </KeyboardAvoidingView>
  );
}
