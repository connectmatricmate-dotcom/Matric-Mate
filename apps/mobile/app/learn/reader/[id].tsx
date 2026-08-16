import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../../src/components/Icon';
import {
  Bar,
  Body,
  Btn,
  Card,
  ErrorState,
  H2,
  IconButton,
  Label,
  Pill,
  Row,
  Screen,
  Sheet,
  Skeleton,
  Small,
  Spacer,
  Tap,
  Ur,
  useToast,
} from '../../../src/components/ui';
import { api , Block, isUrduScript } from '@matricmate/core';
import { useAsync } from '../../../src/core/useAsync';
import { useOnline } from '../../../src/core/connectivity';
import { useT } from '../../../src/i18n';
import type { StringKey } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { C, F, S, isWeb } from '../../../src/theme';
import { Markdown } from '../../../src/components/Markdown';

/** Arabic-script text needs the Nastaliq face; Nunito has no Urdu glyphs. */

/** Body text in whichever script it's written in. */
function Prose({ text, size, style }: { text: string; size: number; style?: object }) {
  if (isUrduScript(text)) {
    return (
      <Ur size={size} style={style}>
        {text}
      </Ur>
    );
  }
  return (
    <Text style={[{ fontFamily: F.bodyReg, fontSize: size, lineHeight: size * 1.72, color: C.ink }, style]}>{text}</Text>
  );
}

/** One content block → its typographic treatment. */
function BlockView({ b, scale, labels }: { b: Block; scale: number; labels: { definition: string; example: string } }) {
  switch (b.kind) {
    case 'h':
      return isUrduScript(b.text) ? (
        <View style={{ marginTop: S.md, marginBottom: S.sm }}>
          <Ur size={20 * scale}>{b.text}</Ur>
        </View>
      ) : (
        <H2 style={{ marginTop: S.md, marginBottom: S.sm, fontSize: 21 * scale }}>{b.text}</H2>
      );
    case 'p':
      return (
        <View style={{ marginBottom: S.md }}>
          <Prose text={b.text} size={15.5 * scale} />
        </View>
      );
    case 'def': {
      // Urdu reads right to left, so the accent bar and the label move to
      // that side. A left bar beside right-aligned text reads as a mistake.
      const rtl = isUrduScript(b.text) || isUrduScript(b.term ?? '');
      return (
        <Card
          flat
          tint={C.tealTint}
          style={{
            ...(rtl
              ? { borderRightWidth: 4, borderRightColor: C.teal }
              : { borderLeftWidth: 4, borderLeftColor: C.teal }),
            marginBottom: S.md,
          }}
        >
          <Label style={{ color: C.teal, textAlign: rtl ? 'right' : 'left' }}>{labels.definition}</Label>
          {b.term ? <Prose text={b.term} size={14 * scale} style={{ fontFamily: F.bodyBold }} /> : null}
          <View style={{ marginTop: 4 }}>
            <Prose text={b.text} size={14.5 * scale} />
          </View>
        </Card>
      );
    }
    case 'formula':
      return (
        <Card flat style={{ alignItems: 'center', marginBottom: S.md }}>
          <Text style={{ fontFamily: F.display, fontSize: 24 * scale, letterSpacing: 1.2, color: C.ink }}>{b.text}</Text>
          {b.caption ? <Prose text={b.caption} size={13 * scale} style={{ color: C.ink2, marginTop: 4 }} /> : null}
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
            <Row
              key={i}
              gap={S.sm}
              // An RTL line carries its bullet on the RIGHT; a left dot next
              // to right-aligned Urdu read as a layout mistake.
              style={{ alignItems: 'flex-start', flexDirection: isUrduScript(it) ? 'row-reverse' : 'row' }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 99, backgroundColor: C.teal, marginTop: 9 }} />
              <View style={{ flex: 1 }}>
                <Prose text={it} size={14.5 * scale} />
              </View>
            </Row>
          ))}
        </View>
      );
    case 'example':
      // The border is load-bearing, not decoration. On some Android devices
      // a rounded, tinted, borderless card intermittently painted no children
      // at all (blank peach boxes over real content); bordered cards next to
      // them never did, because a border forces the non-clipping draw path.
      // It also matches the MCQ explanation card, which already wears one.
      return (
        <Card flat tint={C.orangeTint} border={C.orange} style={{ marginBottom: S.md }}>
          <Label style={{ color: C.orangeDark, textAlign: isUrduScript(b.text) ? 'right' : 'left' }}>
            {labels.example}
          </Label>
          <View style={{ marginTop: 4 }}>
            <Prose text={b.text} size={14.5 * scale} />
          </View>
        </Card>
      );
  }
}

const SUGGESTIONS: StringKey[] = ['reader.suggest1', 'reader.suggest2', 'reader.suggest3'];

export default function Reader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions, derived } = useApp();
  const t = useT();
  const online = useOnline();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { data: chapter } = useAsync(() => api.getChapter(id), [id]);
  const { data: content, loading, error, reload } = useAsync(() => api.getChapterContent(id), [id]);
  const [idx, setIdx] = useState(0);
  const [askOpen, setAskOpen] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; steps?: string[] } | null>(null);
  const [asking, setAsking] = useState(false);
  /** The last question asked in the sheet, so "continue in chat" opens on
   *  it instead of an empty thread. */
  const [asked, setAsked] = useState<string | null>(null);
  // True while this screen is mounted; ask() checks it before setState after
  // its await, because the student may have left mid-request.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Urdu-medium students get the Urdu sections where the client has supplied them.
  const urduMedium = state.settings.contentMedium === 'ur';
  const sections = (urduMedium && content?.sectionsUr) || content?.sections || [];
  /**
   * Whether what we are about to render is actually Urdu. The note below used
   * to fire on a field only the bundled sample carries, so it apologised on
   * every translated chapter in the database.
   */
  const sectionsAreUrdu = sections.some((s) => isUrduScript(s.title));
  const section = sections[idx];
  const scale = [0.92, 1, 1.12][state.settings.fontScale];
  const total = sections.length || 1;
  const readPct = useMemo(() => ((idx + 1) / total) * 100, [idx, total]);

  function advance(dir: 1 | -1) {
    const next = idx + dir;
    if (next < 0 || next >= sections.length) return;
    // Only forward movement records progress. Recording on the way back
    // rewound the dashboard's "continue from" pointer to wherever the student
    // happened to re-read, losing their real position.
    if (section && dir === 1) actions.markSectionRead(section.id, id, next);
    setIdx(next);
  }

  async function ask(prompt: string) {
    setAsked(prompt);
    setAsking(true);
    setAnswer(null);
    try {
      // The server enforces quota and plan; the answer says why if it can't.
      const res = await api.askTutor(prompt, { context: chapter?.title });
      if (!aliveRef.current) return;
      if (res.reason) {
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
      setAnswer({ text: res.text, steps: res.steps });
      // Keep the local counter roughly in step with the server's.
      actions.consumeAi();
    } catch {
      if (aliveRef.current) toast(t('states.errorTitle'));
    } finally {
      if (aliveRef.current) setAsking(false);
    }
  }

  return (
    <>
      <Screen scroll={false} padded={false}>
        <Row style={{ paddingHorizontal: S.md, paddingBottom: S.sm, borderBottomWidth: 1, borderBottomColor: C.line }} gap={S.sm}>
          <IconButton icon="back" onPress={() => router.back()} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }} numberOfLines={1}>
              {chapter?.title ?? ''}
            </Text>
            <View style={{ marginTop: 6 }}>
              <Bar pct={readPct} tone="teal" h={4} />
            </View>
          </View>
          <Tap
            onPress={() => {
              const next = ((state.settings.fontScale + 1) % 3) as 0 | 1 | 2;
              actions.setSettings({ fontScale: next });
              toast(t('reader.textSize', { size: [t('reader.small'), t('reader.medium'), t('reader.large')][next] }));
            }}
          >
            <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: F.display, fontSize: 18, color: C.teal }}>Aa</Text>
            </View>
          </Tap>
        </Row>

        <ScrollView
          contentContainerStyle={[
            { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 120 },
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
          ) : error && !section ? (
            <ErrorState
              title={t('states.errorTitle')}
              sub={t('states.errorBody')}
              retry={t('common.retry')}
              onRetry={reload}
            />
          ) : section ? (
            <>
              <Label>{t('reader.section', { a: idx + 1, b: total })}</Label>
              <Spacer h={S.sm} />
              {urduMedium && !sectionsAreUrdu ? (
                <Card flat tint={C.tealTint} style={{ marginBottom: S.md }}>
                  <Small>{t('reader.urduMediumNote')}</Small>
                </Card>
              ) : null}
              {/* Gated on a bundled-sample field before, so a real Urdu
                  chapter never showed its section heading. */}
              {isUrduScript(section.title) ? (
                <View style={{ marginBottom: S.sm }}>
                  <Ur size={19}>{section.title}</Ur>
                </View>
              ) : null}
              {section.blocks.map((b, i) => (
                <BlockView
                  key={i}
                  b={b}
                  scale={scale}
                  labels={{ definition: t('reader.definition'), example: t('reader.example') }}
                />
              ))}
            </>
          ) : null}
        </ScrollView>

        {/* The tutor is the one thing on this screen that cannot work from disk. */}
        {online ? (
          <View style={{ position: 'absolute', right: S.lg, bottom: 92 + insets.bottom }}>
            <Btn title={t('reader.askAi')} icon="spark" sm onPress={() => setAskOpen(true)} style={{ borderRadius: 99 }} />
          </View>
        ) : null}

        <Row
          style={{
            paddingHorizontal: S.lg,
            paddingTop: S.md,
            paddingBottom: Math.max(insets.bottom, S.md),
            borderTopWidth: 1,
            borderTopColor: C.line,
            backgroundColor: C.card,
          }}
          gap={S.md}
        >
          <View style={{ opacity: idx === 0 ? 0.4 : 1 }}>
            <IconButton icon="back" tone="card" onPress={() => advance(-1)} />
          </View>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.bodyBold, fontSize: 13, color: C.ink2 }}>
            {t('reader.section', { a: idx + 1, b: total })}
          </Text>
          {idx + 1 >= total ? (
            <Btn
              title={t('reader.finish')}
              sm
              onPress={() => {
                if (section) actions.markSectionRead(section.id, id, idx);
                toast(t('reader.progressSaved'));
                router.back();
              }}
            />
          ) : (
            <Tap onPress={() => advance(1)}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chevron" size={19} color="#fff" />
              </View>
            </Tap>
          )}
        </Row>
      </Screen>

      <Sheet visible={askOpen} onClose={() => setAskOpen(false)} title={t('reader.askAiTitle')}>
        <Row gap={S.sm} style={{ marginBottom: S.md, flexWrap: 'wrap' }}>
          {chapter ? <Pill tone="teal">{chapter.title}</Pill> : null}
          <Pill tone={derived.aiLeft ? 'grey' : 'red'}>{t('tutor.leftToday', { n: derived.aiLeft })}</Pill>
        </Row>
        <View style={{ gap: S.sm }}>
          {SUGGESTIONS.map((key) => (
            <Tap key={key} onPress={() => ask(`${t(key)}: ${section?.title ?? ''}`)}>
              <Card flat style={{ paddingVertical: 14 }}>
                <Body>{t(key)}</Body>
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
            <Markdown text={answer.text} size={14} />
            {answer.steps?.map((step, i) => (
              <Row key={i} gap={S.sm} style={{ marginTop: S.sm, alignItems: 'flex-start' }}>
                <View style={{ width: 20, height: 20, borderRadius: 99, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: C.teal }}>{i + 1}</Text>
                </View>
                <Body style={{ flex: 1, fontSize: 14 }}>{step}</Body>
              </Row>
            ))}
            <Spacer h={S.md} />
            <Btn
              title={t('reader.openChat')}
              variant="line"
              sm
              onPress={() => {
                setAskOpen(false);
                router.push(`/tutor/chat?chapter=${id}${asked ? `&q=${encodeURIComponent(asked)}` : ''}`);
              }}
            />
          </Card>
        ) : null}
      </Sheet>
    </>
  );
}
