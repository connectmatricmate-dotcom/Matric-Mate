import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Body, Btn, Card, Pill, Row, Screen, Small, Spacer, Tap, Ur, useToast } from '../../src/components/ui';
import { api } from '../../src/core/api';
import { chapterById } from '../../src/core/content';
import { ChatMessage } from '../../src/core/types';
import { useApp } from '../../src/store/app';
import { C, F, S, isWeb } from '../../src/theme';

export default function Chat() {
  const { q, chapter, thread } = useLocalSearchParams<{ q?: string; chapter?: string; thread?: string }>();
  const { state, actions, derived } = useApp();
  const toast = useToast();
  const scroller = useRef<ScrollView | null>(null);

  const existing = thread ? state.threads.find((t) => t.id === thread) : undefined;
  const [messages, setMessages] = useState<ChatMessage[]>(existing?.messages ?? []);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const threadId = useRef(existing?.id ?? `t-${Date.now()}`);
  const contextLabel = chapter ? `Ch ${chapterById(chapter)?.number} · ${chapterById(chapter)?.title}` : existing?.contextLabel;

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || thinking) return;
    if (!derived.aiLeft) {
      toast('Daily AI limit reached — resets at 12 AM');
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
    // Persist outside the state updater — updaters run during render.
    actions.saveThread({
      id: threadId.current,
      title: clean.length > 42 ? `${clean.slice(0, 42)}…` : clean,
      contextLabel,
      messages: next,
      at: Date.now(),
    });
  }

  // A question passed in from a lesson or a wrong answer is asked automatically.
  useEffect(() => {
    if (q && messages.length === 0) send(String(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, thinking]);

  return (
    <Screen scroll={false} padded={false}>
      <Row style={{ paddingHorizontal: S.lg, paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: C.line }} gap={S.sm}>
        <Tap onPress={() => router.back()} hit>
          <Icon name="back" color={C.ink} />
        </Tap>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>AI Tutor</Text>
          {contextLabel ? <Small style={{ fontFamily: F.bodyBold }}>Context: {contextLabel}</Small> : null}
        </View>
        <Pill tone={derived.aiLeft ? 'grey' : 'red'}>{derived.aiLeft} left today</Pill>
      </Row>

      <ScrollView
        ref={scroller}
        contentContainerStyle={[
          { padding: S.lg, gap: S.md },
          isWeb && { maxWidth: 760, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && !thinking ? (
          <Card flat tint={C.tealTint}>
            <Body>Kuch bhi poochho — concept, sawaal ka hal, ya “yeh simple lafzon mein samjhao”.</Body>
            <Spacer h={S.sm} />
            <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
              {['What is inertia?', 'Explain F = ma', 'اردو میں سمجھائیں'].map((s) => (
                <Pill key={s} tone="teal" onPress={() => send(s)} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                  {s.includes('اردو') ? <Ur size={12}>{s}</Ur> : s}
                </Pill>
              ))}
            </Row>
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
                paddingVertical: 11,
                paddingHorizontal: 14,
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
                padding: 14,
                borderRadius: 18,
                borderBottomLeftRadius: 6,
              }}
            >
              <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>{m.text}</Text>
              {m.steps?.map((s, i) => (
                <Row key={i} gap={S.sm} style={{ marginTop: S.sm, alignItems: 'flex-start' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 99, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: C.teal }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontFamily: F.body, fontSize: 13.5, lineHeight: 22, color: C.ink }}>{s}</Text>
                </Row>
              ))}
              <Row gap={S.sm} style={{ marginTop: S.md }}>
                <Pill tone="grey" onPress={() => toast('Thanks — feedback noted')}>
                  👍
                </Pill>
                <Pill tone="grey" onPress={() => toast('Noted — we’ll improve this answer')}>
                  👎
                </Pill>
                <Pill tone="teal" onPress={() => send('Yehi baat aasan Urdu mein samjhao')}>
                  <Ur size={12}>اردو میں</Ur>
                </Pill>
              </Row>
            </View>
          )
        )}

        {thinking ? (
          <View style={{ alignSelf: 'flex-start', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, padding: 14, borderRadius: 18 }}>
            <Small>Soch raha hoon…</Small>
          </View>
        ) : null}
      </ScrollView>

      <Row
        style={{
          paddingHorizontal: S.md,
          paddingTop: S.sm,
          paddingBottom: S.lg,
          borderTopWidth: 1,
          borderTopColor: C.line,
          backgroundColor: C.card,
        }}
        gap={S.sm}
      >
        <Tap onPress={() => toast('Photo question — camera arrives with the live tutor')} hit>
          <Icon name="camera" color={C.ink2} />
        </Tap>
        <View
          style={{
            flex: 1,
            backgroundColor: C.paper,
            borderWidth: 1.5,
            borderColor: C.line,
            borderRadius: 99,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything…"
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
          <View style={{ width: 42, height: 42, borderRadius: 99, backgroundColor: input.trim() ? C.teal : C.ink3, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" size={18} color="#fff" />
          </View>
        </Tap>
      </Row>
    </Screen>
  );
}
