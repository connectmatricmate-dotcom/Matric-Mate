import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bar,
  Body,
  Btn,
  Card,
  Chevron,
  Empty,
  ErrorState,
  H2,
  IconButton,
  Label,
  Pill,
  Row,
  Screen,
  ScriptText,
  Sheet,
  Skeleton,
  Small,
  Spacer,
  Tap,
  Text,
  Ur,
  useToast,
} from '../../../src/components/ui';
import { api, Block, chapterName, isUrduScript, parseTutorActions, subjectMedium, weakTopics } from '@matricmate/core';
import { aiFailureKey } from '../../../src/components/aiFailure';
import { LockedNotice } from '../../../src/components/LockedNotice';
import { useAsync } from '../../../src/core/useAsync';
import { useOnline } from '../../../src/core/connectivity';
import { useLang, useT } from '../../../src/i18n';
import type { StringKey } from '../../../src/i18n';
import { localChapter } from '../../../src/core/downloads';
import { useApp } from '../../../src/store/app';
import { C, F, S, isRTL, isWeb } from '../../../src/theme';
import { Markdown } from '../../../src/components/Markdown';
import { useQuota } from '../../../src/core/useQuota';

/** Arabic-script text needs the Nastaliq face; Nunito has no Urdu glyphs. */

/**
 * Body text in whichever script it's written in, and in that script's face:
 * English notes in the Urdu interface keep the Latin face, because in
 * Nastaliq this line height cut their descenders off (see F.latin). `bold`
 * picks the bold of the same script; a Latin bold face on an Urdu term threw
 * it out of Nastaliq altogether.
 */
function Prose({ text, size, bold, style }: { text: string; size: number; bold?: boolean; style?: object }) {
  if (isUrduScript(text)) {
    return (
      <Ur size={size} style={[bold ? { fontFamily: F.urduBold } : null, style]}>
        {text}
      </Ur>
    );
  }
  return (
    <Text
      style={[
        { fontFamily: bold ? F.latin.bodyBold : F.latin.bodyReg, fontSize: size, lineHeight: size * 1.72, color: C.ink },
        style,
      ]}
    >
      {text}
    </Text>
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
        // An English heading keeps the Latin face and the left edge in the
        // Urdu interface too, like the prose under it. Its line height scales
        // with the reading size: at "Large" the fixed one crowded the text.
        <H2
          style={{
            marginTop: S.md,
            marginBottom: S.sm,
            fontFamily: F.latin.display,
            fontSize: 21 * scale,
            lineHeight: Math.round(27 * scale),
            textAlign: 'left',
          }}
        >
          {b.text}
        </H2>
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
          {b.term ? <Prose text={b.term} size={14 * scale} bold /> : null}
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
  const { id, section: startAt } = useLocalSearchParams<{ id: string; section?: string }>();
  const { state, actions, derived, contentKey } = useApp();
  // One number app-wide; the local counter under-counts a paper by two.
  const quota = useQuota();
  const aiLeft = quota?.remaining ?? derived.aiLeft;
  const t = useT();
  const { lang } = useLang();
  const online = useOnline();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  // contentKey in both: a language, class or board switch reaches an open reader.
  const { data: fetchedChapter } = useAsync(() => api.getChapter(id), [id, contentKey]);
  /* Offline the catalogue has no Class 10 chapter to give, so the sticky header
     would have no name. The row saved with the download has one. */
  const chapter = fetchedChapter ?? localChapter(id) ?? undefined;
  const { data: content, loading, error, reload } = useAsync(() => api.getChapterContent(id), [id, contentKey]);
  const board = state.onboarding?.board ?? 'fbise';
  /**
   * Where the reader opens.
   *
   * Straight to the top of the chapter unless somebody said otherwise:
   * `?section=` is how the dashboard's "Carry on with {chapter}" button means
   * carry on rather than start again. Read once, on mount, so it cannot fight
   * the student's own paging afterwards.
   */
  const [rawIdx, setIdx] = useState(() => Math.max(0, Math.trunc(Number(startAt)) || 0));
  const [askOpen, setAskOpen] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; steps?: string[] } | null>(null);
  const [asking, setAsking] = useState(false);
  /** Which suggestion the answer on show is for, so its chip can say so. */
  const [askedKey, setAskedKey] = useState<StringKey | null>(null);
  /** The server's thread for questions asked from this reader, once there is one. */
  const [threadId, setThreadId] = useState<string | null>(null);
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
  /**
   * The "Urdu notes are on the way" line, only where they are. English, Urdu
   * and Punjab Islamiyat are written in one language for every student, so on
   * an English chapter the note apologised for a translation that is never
   * coming, on every chapter of the subject.
   */
  const urduPending = urduMedium && !sectionsAreUrdu && subjectMedium(id, board, 'ur') === 'ur';
  /* Clamped against what actually loaded: a link can name a section this
     chapter does not have, and the content arrives after the first render. */
  const idx = Math.min(rawIdx, Math.max(0, sections.length - 1));
  const section = sections[idx];
  /** Settled and nothing to show: a failed read, no download offline, or a chapter with no notes. */
  const empty = !loading && !sections.length;
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
    // An answer belongs to the section it was asked about. Kept, it opened on
    // the next section still explaining the previous one.
    setAnswer(null);
    setAskedKey(null);
  }

  async function ask(key: StringKey) {
    // One question at a time: a second tap while the first was out sent it
    // again and spent a second one of the day's allowance.
    if (asking) return;
    const prompt = `${t(key)}: ${section?.title ?? ''}`;
    setAskedKey(key);
    setAsking(true);
    setAnswer(null);
    try {
      // The server enforces quota and plan; the answer says why if it can't.
      // The chapter id grounds the answer in this chapter's own notes, and the
      // profile carries the student's language: without them the tutor
      // answered in English from the syllabus in general.
      const res = await api.askTutor(prompt, {
        context: chapter ? chapterName(chapter, lang) : undefined,
        chapterId: id,
        threadId,
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
      if (!aliveRef.current) return;
      if (res.reason) {
        toast(t(aiFailureKey(res.reason)));
        return;
      }
      setAnswer({ text: res.text, steps: res.steps });
      // The conversation now exists on the server, so "Open full chat" opens
      // it rather than asking the same question again at the cost of another
      // of the day's questions.
      if (res.threadId) setThreadId(res.threadId);
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
            {/* The chapter name in the student's own language, in the face
                that script needs: this is the reader's only title. */}
            <ScriptText text={chapter ? chapterName(chapter, lang) : ''} face="bodyBold" size={13.5} lines={1} />
            <View style={{ marginTop: 6 }}>
              <Bar pct={readPct} tone="teal" h={4} />
            </View>
          </View>
          <Tap
            label={t('a11y.textSize')}
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
          {loading && !section ? (
            <View style={{ gap: S.md }}>
              <Skeleton w="40%" h={12} />
              <Skeleton w="80%" h={22} />
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} h={14} />
              ))}
            </View>
          ) : empty ? (
            /*
             * Nothing to read, said plainly. The content read never throws, so
             * the error branch that used to be here could not render: offline
             * on a chapter that was not downloaded, after a language switch,
             * or on a slow first read, the page went blank under "Section 1
             * of 1" and Finish said "Progress saved" having saved nothing.
             */
            !online ? (
              <ErrorState title={t('offline.title')} sub={t('offline.sub')} retry={t('common.retry')} onRetry={reload} />
            ) : !state.premium.active ? (
              // Without a plan the database answers with nothing, which is
              // not the same as a chapter with no notes.
              <LockedNotice variant="locked" />
            ) : chapter && chapter.sectionCount > 0 ? (
              <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
            ) : (
              <Empty
                emoji="📖"
                title={t('reader.noNotesTitle')}
                sub={t('reader.noNotesBody')}
                // Back down to the chapter when it is underneath, rather than a second copy of it on top.
                cta={<Btn title={t('session.backToChapter')} variant="line" sm onPress={() => router.dismissTo(`/learn/chapter/${id}`)} />}
              />
            )
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
              {urduPending ? (
                <Card flat tint={C.tealTint} style={{ marginBottom: S.md }}>
                  <Small>{t('reader.urduMediumNote')}</Small>
                </Card>
              ) : null}
              {/* The section's own title, in whichever script it is written
                  in. Only Urdu titles used to show, so an English chapter
                  never named its sections. Skipped when the section opens
                  with the same words as a heading, so it is not said twice. */}
              {section.title && !(section.blocks[0]?.kind === 'h' && section.blocks[0].text.trim() === section.title.trim()) ? (
                isUrduScript(section.title) ? (
                  <View style={{ marginBottom: S.sm }}>
                    <Ur size={19}>{section.title}</Ur>
                  </View>
                ) : (
                  <H2
                    style={{
                      marginBottom: S.sm,
                      fontFamily: F.latin.display,
                      fontSize: 21 * scale,
                      lineHeight: Math.round(27 * scale),
                      textAlign: 'left',
                    }}
                  >
                    {section.title}
                  </H2>
                )
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
          // The far edge from where the text starts, which swaps in Urdu.
          <View style={{ position: 'absolute', ...(isRTL() ? { left: S.lg } : { right: S.lg }), bottom: 92 + insets.bottom }}>
            <Btn title={t('reader.askAi')} icon="spark" sm onPress={() => setAskOpen(true)} style={{ borderRadius: 99 }} />
          </View>
        ) : null}

        {/* No paging and no Finish over a chapter with nothing in it. */}
        {section ? (
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
              <IconButton icon="back" tone="card" label={t('a11y.previousSection')} onPress={() => advance(-1)} />
            </View>
            <Text style={{ flex: 1, textAlign: 'center', fontFamily: F.bodyBold, fontSize: 13, color: C.ink2 }}>
              {t('reader.section', { a: idx + 1, b: total })}
            </Text>
            {idx + 1 >= total ? (
              <Btn
                title={t('reader.finish')}
                sm
                onPress={() => {
                  actions.markSectionRead(section.id, id, idx);
                  toast(t('reader.progressSaved'));
                  router.back();
                }}
              />
            ) : (
              <Tap onPress={() => advance(1)} label={t('a11y.nextSection')}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
                  <Chevron size={19} color={C.onBrand} />
                </View>
              </Tap>
            )}
          </Row>
        ) : null}
      </Screen>

      <Sheet visible={askOpen} onClose={() => setAskOpen(false)} title={t('reader.askAiTitle')}>
        <Row gap={S.sm} style={{ marginBottom: S.md, flexWrap: 'wrap' }}>
          {chapter ? (
            <Pill tone="teal" lines={1}>
              {chapterName(chapter, lang)}
            </Pill>
          ) : null}
          <Pill tone={aiLeft ? 'grey' : 'red'}>{t('tutor.leftToday', { n: aiLeft })}</Pill>
        </Row>
        {/*
         * Before a question: three big choices. After one: the same three as
         * a row of chips, and the answer straight under them.
         *
         * The answer used to land below the three full-size cards, which on a
         * phone put its first lines at the bottom edge and cut the rest off
         * mid-sentence. It did scroll, but nothing said so, and it read as
         * text overflowing the sheet. Now it starts in view, and the chips
         * stay at the top where a second question is one tap away.
         */}
        {asking || answer ? (
          <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
            {SUGGESTIONS.map((key) => (
              <Pill key={key} tone={key === askedKey ? 'teal' : 'grey'} onPress={asking ? undefined : () => ask(key)}>
                {t(key)}
              </Pill>
            ))}
          </Row>
        ) : (
          <View style={{ gap: S.sm }}>
            {SUGGESTIONS.map((key) => (
              <Tap key={key} onPress={() => ask(key)}>
                <Card flat style={{ paddingVertical: 14 }}>
                  <Body>{t(key)}</Body>
                </Card>
              </Tap>
            ))}
          </View>
        )}
        {asking ? (
          <Card flat style={{ marginTop: S.md, gap: 8 }}>
            <Skeleton w="70%" h={13} />
            <Skeleton w="90%" h={13} />
            <Skeleton w="60%" h={13} />
          </Card>
        ) : answer ? (
          <Card flat style={{ marginTop: S.md }}>
            {/* The tutor ends some answers with button tags ([[practice:phy-3]]).
                The chat turns them into buttons; here they printed as code,
                so they are taken out, and "Open full chat" shows them as
                buttons in the same thread. */}
            <Markdown text={parseTutorActions(answer.text, false, lang).text} size={14} />
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
                // The thread this answer is already in. Re-sending the
                // question through ?q= asked it twice and spent two.
                router.push(`/tutor/chat?chapter=${id}${threadId ? `&thread=${threadId}` : ''}`);
              }}
            />
          </Card>
        ) : null}
      </Sheet>
    </>
  );
}
