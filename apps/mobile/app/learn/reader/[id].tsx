import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../../src/components/Icon';
import {
  Bar,
  Body,
  Btn,
  Card,
  H2,
  Label,
  Pill,
  Row,
  Screen,
  Seg,
  Sheet,
  Skeleton,
  Small,
  Spacer,
  Tap,
  Ur,
  useToast,
} from '../../../src/components/ui';
import { api } from '../../../src/core/api';
import { useAsync } from '../../../src/core/useAsync';
import { Block, Medium } from '../../../src/core/types';
import { useApp } from '../../../src/store/app';
import { C, F, S, isWeb } from '../../../src/theme';

/** One content block → its typographic treatment. */
function BlockView({ b, scale }: { b: Block; scale: number }) {
  switch (b.kind) {
    case 'h':
      return <H2 style={{ marginTop: S.md, marginBottom: S.sm, fontSize: 21 * scale }}>{b.text}</H2>;
    case 'p':
      return (
        <Text style={{ fontFamily: F.bodyReg, fontSize: 15.5 * scale, lineHeight: 27 * scale, color: C.ink, marginBottom: S.md }}>
          {b.text}
        </Text>
      );
    case 'def':
      return (
        <Card flat tint={C.tealTint} style={{ borderLeftWidth: 4, borderLeftColor: C.teal, marginBottom: S.md }}>
          <Label style={{ color: C.teal }}>Definition · {b.term}</Label>
          <Text style={{ fontFamily: F.body, fontSize: 14.5 * scale, lineHeight: 24 * scale, color: C.ink, marginTop: 4 }}>
            {b.text}
          </Text>
        </Card>
      );
    case 'formula':
      return (
        <Card flat style={{ alignItems: 'center', marginBottom: S.md }}>
          <Text style={{ fontFamily: F.display, fontSize: 24 * scale, letterSpacing: 1.2, color: C.ink }}>{b.text}</Text>
          {b.caption ? <Small style={{ marginTop: 4 }}>{b.caption}</Small> : null}
        </Card>
      );
    case 'ur':
      return (
        <View style={{ marginBottom: S.md }}>
          <Ur size={16 * scale} style={{ color: C.ink2 }}>
            {b.text}
          </Ur>
        </View>
      );
    case 'list':
      return (
        <View style={{ gap: 8, marginBottom: S.md }}>
          {b.items.map((it, i) => (
            <Row key={i} gap={S.sm} style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: C.teal, marginTop: 9 }} />
              <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14.5 * scale, lineHeight: 24 * scale, color: C.ink }}>{it}</Text>
            </Row>
          ))}
        </View>
      );
    case 'example':
      return (
        <Card flat tint={C.orangeTint} style={{ marginBottom: S.md }}>
          <Label style={{ color: C.orangeDark }}>Example</Label>
          <Text style={{ fontFamily: F.body, fontSize: 14.5 * scale, lineHeight: 24 * scale, color: C.ink, marginTop: 4 }}>
            {b.text}
          </Text>
        </Card>
      );
  }
}

const SUGGESTIONS = ['Explain simply', 'Give an example', 'اردو میں سمجھائیں'];

export default function Reader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions, derived } = useApp();
  const toast = useToast();
  const { data: chapter } = useAsync(() => api.getChapter(id), [id]);
  const { data: content, loading } = useAsync(() => api.getChapterContent(id), [id]);
  const [idx, setIdx] = useState(0);
  const [askOpen, setAskOpen] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; steps: string[] } | null>(null);
  const [asking, setAsking] = useState(false);

  const section = content?.sections[idx];
  const scale = [0.92, 1, 1.12][state.settings.fontScale];
  const total = content?.sections.length ?? 1;
  const readPct = useMemo(() => ((idx + 1) / total) * 100, [idx, total]);

  function advance(dir: 1 | -1) {
    if (!content) return;
    const next = idx + dir;
    if (next < 0 || next >= content.sections.length) return;
    if (section) actions.markSectionRead(section.id, id, next);
    setIdx(next);
  }

  async function ask(prompt: string) {
    if (!derived.aiLeft) {
      toast('Daily AI limit reached — resets at 12 AM');
      return;
    }
    if (!actions.consumeAi()) return;
    setAsking(true);
    setAnswer(null);
    const res = await api.askTutor(prompt, chapter ? `Ch ${chapter.number} · ${chapter.title}` : undefined);
    setAnswer(res);
    setAsking(false);
  }

  return (
    <>
      <Screen scroll={false} padded={false}>
        {/* sticky mini header with progress */}
        <Row style={{ paddingHorizontal: S.lg, paddingVertical: S.sm, borderBottomWidth: 1, borderBottomColor: C.line }} gap={S.sm}>
          <Tap onPress={() => router.back()} hit>
            <Icon name="back" color={C.ink} />
          </Tap>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink }} numberOfLines={1}>
              {chapter ? `Ch ${chapter.number} · ${chapter.title}` : 'Notes'}
            </Text>
            <View style={{ marginTop: 6 }}>
              <Bar pct={readPct} tone="teal" h={4} />
            </View>
          </View>
          <View style={{ width: 112 }}>
            <Seg<Medium>
              value={state.settings.contentMedium}
              onChange={(m) => actions.setSettings({ contentMedium: m })}
              options={[
                { value: 'en', label: 'EN' },
                { value: 'ur', label: 'اردو', urdu: true },
              ]}
            />
          </View>
          <Tap
            onPress={() => {
              const next = ((state.settings.fontScale + 1) % 3) as 0 | 1 | 2;
              actions.setSettings({ fontScale: next });
              toast(`Text size: ${['small', 'medium', 'large'][next]}`);
            }}
            hit
          >
            <Text style={{ fontFamily: F.display, fontSize: 17, color: C.teal }}>Aa</Text>
          </Tap>
        </Row>

        <ScrollView
          contentContainerStyle={[
            { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 110 },
            isWeb && { maxWidth: 720, width: '100%', alignSelf: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={{ gap: S.md }}>
              <Skeleton w="40%" h={12} />
              <Skeleton w="80%" h={22} />
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} h={14} />
              ))}
            </View>
          ) : section ? (
            <>
              <Label>
                Section {idx + 1} of {total}
              </Label>
              <Spacer h={S.sm} />
              {state.settings.contentMedium === 'ur' ? (
                <Card flat tint={C.tealTint} style={{ marginBottom: S.md }}>
                  <Small>Urdu-medium content for this section is supplied by the client (dual-medium authoring in the CMS).</Small>
                </Card>
              ) : null}
              {section.blocks.map((b, i) => (
                <BlockView key={i} b={b} scale={scale} />
              ))}
            </>
          ) : null}
        </ScrollView>

        {/* Ask AI */}
        <View style={{ position: 'absolute', right: S.lg, bottom: 84 }}>
          <Btn title="Ask AI" icon="spark" sm onPress={() => setAskOpen(true)} style={{ borderRadius: 99 }} />
        </View>

        {/* section pager */}
        <Row
          style={{
            paddingHorizontal: S.lg,
            paddingVertical: S.md,
            borderTopWidth: 1,
            borderTopColor: C.line,
            backgroundColor: C.card,
          }}
          gap={S.md}
        >
          <Tap onPress={() => advance(-1)} disabled={idx === 0}>
            <View style={{ width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', opacity: idx === 0 ? 0.4 : 1 }}>
              <Icon name="back" size={18} color={C.ink} />
            </View>
          </Tap>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.bodyBold, fontSize: 13, color: C.ink2 }}>
            Section {idx + 1} / {total}
          </Text>
          {idx + 1 >= total ? (
            <Btn
              title="Finish"
              sm
              onPress={() => {
                if (section) actions.markSectionRead(section.id, id, idx);
                toast('Chapter progress saved');
                router.back();
              }}
            />
          ) : (
            <Tap onPress={() => advance(1)}>
              <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chevron" size={18} color="#fff" />
              </View>
            </Tap>
          )}
        </Row>
      </Screen>

      <Sheet visible={askOpen} onClose={() => setAskOpen(false)} title="Ask AI about this section">
        <Row gap={S.sm} style={{ marginBottom: S.md }}>
          <Pill tone="teal">{chapter ? `Ch ${chapter.number} · ${chapter.title}` : 'This chapter'}</Pill>
          <Pill tone={derived.aiLeft ? 'grey' : 'red'}>{derived.aiLeft} left today</Pill>
        </Row>
        <View style={{ gap: S.sm }}>
          {SUGGESTIONS.map((s) => (
            <Tap key={s} onPress={() => ask(`${s} — ${section?.title ?? ''}`)}>
              <Card flat style={{ paddingVertical: 12 }}>
                {s.includes('اردو') ? <Ur size={14}>{s}</Ur> : <Body>{s}</Body>}
              </Card>
            </Tap>
          ))}
        </View>
        {asking ? (
          <Card flat style={{ marginTop: S.md, gap: 8 }}>
            <Skeleton w="70%" h={13} />
            <Skeleton w="90%" h={13} />
            <Skeleton w="60%" h={13} />
          </Card>
        ) : answer ? (
          <Card flat style={{ marginTop: S.md }}>
            <Body style={{ fontFamily: F.bodyBold }}>{answer.text}</Body>
            {answer.steps.map((s, i) => (
              <Row key={i} gap={S.sm} style={{ marginTop: S.sm, alignItems: 'flex-start' }}>
                <View style={{ width: 20, height: 20, borderRadius: 99, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: C.teal }}>{i + 1}</Text>
                </View>
                <Body style={{ flex: 1, fontSize: 14 }}>{s}</Body>
              </Row>
            ))}
            <Spacer h={S.md} />
            <Btn title="Open full chat" variant="line" sm onPress={() => { setAskOpen(false); router.push(`/tutor/chat?chapter=${id}`); }} />
          </Card>
        ) : null}
      </Sheet>
    </>
  );
}
