import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { Body, Card, IconButton, Pill, Row, Screen, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { api } from '../../src/core/api';
import { chapterById } from '../../src/core/content';
import { ChatMessage } from '../../src/core/types';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, isWeb } from '../../src/theme';

export default function Chat() {
  const { q, chapter, thread } = useLocalSearchParams<{ q?: string; chapter?: string; thread?: string }>();
  const { state, actions, derived } = useApp();
  const t = useT();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView | null>(null);

  const existing = thread ? state.threads.find((x) => x.id === thread) : undefined;
  const [messages, setMessages] = useState<ChatMessage[]>(existing?.messages ?? []);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const threadId = useRef(existing?.id ?? `t-${Date.now()}`);
  const contextLabel = chapter ? chapterById(chapter)?.title : existing?.contextLabel;

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || thinking) return;
    if (!derived.aiLeft) {
      toast(t('tutor.limitToast'));
      return;
    }
    if (!actions.consumeAi()) return;

    const mine: ChatMessage = { id: `m-${Date.now()}`, role: 'user', text: clean, at: Date.now() };
    setMessages((m) => [...m, mine]);
    setInput('');
    setThinking(true);

    const res = await api.askTutor(clean, contextLabel);
    const reply: ChatMessage = { id: `m-${Date.now()}-ai`, role: 'ai', text: res.text, steps: res.steps, at: Date.now() };
    setThinking(false);
    const next = [...messages, mine, reply];
    setMessages(next);
    actions.saveThread({
      id: threadId.current,
      title: clean.length > 42 ? `${clean.slice(0, 42)}…` : clean,
      contextLabel,
      messages: next,
      at: Date.now(),
    });
  }

  useEffect(() => {
    if (q && messages.length === 0) send(String(q));
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
          <Pill tone={derived.aiLeft ? 'grey' : 'red'}>{t('tutor.leftToday', { n: derived.aiLeft })}</Pill>
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
                <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, lineHeight: 20, color: C.ink }}>{m.text}</Text>
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
          <IconButton icon="camera" onPress={() => toast(t('tutor.photoSoon'))} />
          <View
            style={{
              flex: 1,
              backgroundColor: C.paper,
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
              placeholder={t('tutor.placeholder')}
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
                backgroundColor: input.trim() ? C.teal : C.ink3,
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
