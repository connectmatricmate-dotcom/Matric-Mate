import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../src/components/Icon';
import { IconButton, Pill, Row, Screen, ScriptText, Small, Tap, Text, TextInput, TypingDots, useRevealed, useToast } from '../../src/components/ui';
import { useKeyboardOverlap } from '../../src/core/keyboard';
import { ChapterPicker } from '../../src/components/ChapterPicker';
import {
  ChatMessage,
  TUTOR_ACTION_LABEL,
  TUTOR_ACTION_ROUTE,
  api,
  chapterById,
  chapterName,
  isUrduScript,
  parseTutorActions,
  rateTutorAnswer,
  subjectById,
  subjectName,
  weakTopics,
  type ChapterChoice,
  type TutorAction,
  type TutorImage,
} from '@matricmate/core';
import { aiFailureKey } from '../../src/components/aiFailure';
import { useAsync } from '../../src/core/useAsync';
import type { StringKey } from '../../src/i18n';
import { supabase } from '../../src/lib/supabase';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, R, S, isWeb, rowDir, textStart, urdu } from '../../src/theme';
import { Markdown } from '../../src/components/Markdown';
import { useQuota } from '../../src/core/useQuota';
import { AiLocked } from '../../src/components/AiLocked';
import { ReportAi } from '../../src/components/ReportAi';

/** The longest side of a photo sent to the tutor: the size Claude reads images
 *  at best, and a few hundred kilobytes once saved at 70%. */
const PHOTO_LONG_SIDE = 1568;

/** "21:00" style local clock time out of the server's reset instant. */
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });  // 24h clock, same in both languages

/**
 * The answer as it is being written.
 *
 * Its own component so the reveal timer lives and dies with the bubble: it
 * exists only while an answer is in flight, and nothing has to remember to
 * stop it.
 */
function LiveAnswer({ text }: { text: string }) {
  const shown = useRevealed(text);
  // `true`: a tag half-written by the model must not flash as raw brackets in
  // the middle of the answer before it turns into a button.
  const { text: prose } = parseTutorActions(shown, true);
  return (
    <View
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
      <Markdown text={prose} size={13.5} />
    </View>
  );
}

/**
 * The buttons the tutor can put under an answer.
 *
 * "You should revise Kinematics" used to be the end of it, and the student had
 * to go and find Kinematics. The model names a chapter and a verb, core turns
 * that into a route, and this draws it. Labels come from our own strings, so
 * an Urdu-medium student gets Urdu buttons under an Urdu answer whatever the
 * model happened to write in.
 */
function AnswerActions({ actions }: { actions: TutorAction[] }) {
  const t = useT();
  const { lang } = useLang();
  if (!actions.length) return null;
  return (
    <Row gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap' }}>
      {actions.map((a) => (
        <Tap key={`${a.kind}-${a.chapterId}`} onPress={() => router.push(TUTOR_ACTION_ROUTE[a.kind](a.chapterId) as never)}>
          <View
            style={{
              flexDirection: rowDir(),
              alignItems: 'center',
              gap: 6,
              backgroundColor: C.teal,
              borderRadius: R.pill,
              paddingVertical: 9,
              paddingHorizontal: 14,
              maxWidth: 260,
            }}
          >
            <Icon name="spark" size={13} color={C.onBrand} />
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.bodyBold, fontSize: 12.5, color: C.onBrand }}>
              {t(TUTOR_ACTION_LABEL[a.kind] as StringKey)}
            </Text>
            {/* The chapter's name in today's language, looked up again at
                render: a chip parsed before a language switch kept the old one. */}
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.body, fontSize: 11.5, color: C.onBrand, opacity: 0.85 }}>
              · {chapterName(chapterById(a.chapterId), lang) || a.chapterTitle}
            </Text>
          </View>
        </Tap>
      ))}
    </Row>
  );
}

/**
 * The chat before there is a chat.
 *
 * This was a tinted card holding one sentence, "Ask anything: a concept, a
 * question, or explain this simply", floating at the top of an otherwise blank
 * screen. It read as a message the tutor had sent, which it is not, and it sat
 * a long way from the box it was talking about. An empty state should look
 * like an empty state and should teach the three things worth knowing here.
 */
function EmptyChat({ onStarter }: { onStarter: (text: string) => void }) {
  const t = useT();
  const { lang } = useLang();
  const { state, derived, contentKey } = useApp();

  /**
   * The questions a student does not think to ask.
   *
   * Built from what we already know about them rather than from a fixed list:
   * the topic they keep getting wrong, the chapter they had open last, the
   * subject they are carrying. A generic "ask me anything" teaches nothing;
   * "Help me fix Momentum, where do I keep going wrong" is the question that
   * turns a tutor into a tutor.
   *
   * Tapping one asks it, the way a follow-up chip does: the tap is the
   * student choosing to spend one of their fifty. Nothing is ever sent without
   * a tap. It used to only fill the box, which on a one-line field showed the
   * last few words, so the card looked like it had done nothing.
   */
  const starters = useMemo(() => {
    const out: string[] = [];
    const weak = weakTopics(state.attempts)[0]?.topic;
    if (weak) out.push(t('tutor.starterWeak', { topic: weak }));
    const lastChapter = state.lastChapterId ? chapterName(chapterById(state.lastChapterId), lang) : undefined;
    if (lastChapter) out.push(t('tutor.starterChapter', { chapter: lastChapter }));
    const subject = subjectName(subjectById(derived.subjects[0] ?? ''), lang);
    if (subject) out.push(t('tutor.starterExam', { subject }));
    if (derived.subjects.length === 1 && subject) out.push(t('tutor.starterPlanOne', { subject }));
    else if (derived.subjects.length) out.push(t('tutor.starterPlan', { n: derived.subjects.length }));
    out.push(t('tutor.starterMarks'));
    return out.slice(0, 4);
    // contentKey is not read here and has to be listed: chapterById and
    // weakTopics read the chapter index, which fills in underneath.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.attempts, state.lastChapterId, derived.subjects, lang, t, contentKey]);

  /*
   * Two blocks, pushed apart, rather than one column of everything.
   *
   * The first version stacked a centred heading, centred body copy and then a
   * left-aligned list, which read as broken: two alignments in one block with
   * nothing between them, and then half a screen of nothing above the
   * composer. The greeting belongs in the space at the top. The things you can
   * tap belong at the bottom, next to the thumb and the composer. The three
   * tips that used to sit in the middle are gone: the body copy already said
   * all three, so they were the same sentence twice.
   */
  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: S.lg }}>
      <View style={{ alignItems: 'center', gap: S.md, paddingHorizontal: S.md, paddingTop: S.xl }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 22,
            backgroundColor: C.tealTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="spark" size={30} color={C.teal} />
        </View>
        <View style={{ gap: 6, alignItems: 'center' }}>
          <Text style={{ fontFamily: F.display, fontSize: 20, color: C.ink, textAlign: 'center' }}>
            {t('tutor.emptyTitle')}
          </Text>
          <Small style={{ textAlign: 'center' }}>{t('tutor.emptyBody')}</Small>
        </View>
      </View>

      {starters.length ? (
        <View style={{ gap: S.sm, marginTop: S.xl }}>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 11.5, letterSpacing: 0.7, color: C.ink3, textAlign: textStart() }}>
            {t('tutor.startersTitle').toUpperCase()}
          </Text>
          {starters.map((line) => (
            <Tap key={line} onPress={() => onStarter(line)}>
              <View
                style={{
                  flexDirection: rowDir(),
                  alignItems: 'center',
                  gap: S.sm,
                  backgroundColor: C.card,
                  borderWidth: 1,
                  borderColor: C.line,
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 13,
                }}
              >
                <Text
                  style={[
                    {
                      flex: 1,
                      fontFamily: F.body,
                      fontSize: 13,
                      lineHeight: 19,
                      color: C.ink,
                      textAlign: textStart(),
                    },
                    // A line with Urdu in it, which is every line in the Urdu
                    // interface and a weak topic's name in the English one,
                    // needs Nastaliq's leading: at 19 the lines overlapped
                    // and lost their tails.
                    isUrduScript(line) ? { ...urdu(13), flex: 1 } : null,
                  ]}
                >
                  {line}
                </Text>
                <Icon name="chevron" size={15} color={C.ink3} />
              </View>
            </Tap>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * AI, so not in Basic: the lock in its place (see AiLocked). Decided before
 * the screen's own hooks run, so it never starts a request it cannot make.
 */
export default function ChatGate() {
  const { derived } = useApp();
  if (derived.access.active && !derived.access.ai) return <AiLocked titleKey="tutor.title" />;
  return <Chat />;
}

function Chat() {
  const { q, chapter, thread, draft, photo: wantPhoto } = useLocalSearchParams<{
    q?: string;
    chapter?: string;
    thread?: string;
    /** Prefilled into the box and left there. Never sent for them: see the
     *  note on ENTRIES in the tutor tab about questions spent on a tap. */
    draft?: string;
    /** Open the camera on arrival, for the "Solve from a photo" tile. */
    photo?: string;
  }>();
  const { state, actions, derived, contentKey } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardOverlap();
  const scroller = useRef<ScrollView | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  /** A saved thread's history: loading, loaded, or failed with a retry. */
  const [history, setHistory] = useState<'loading' | 'ready' | 'failed'>(thread ? 'loading' : 'ready');
  const [historyTry, setHistoryTry] = useState(0);
  /**
   * A draft arrives in the box and is left alone.
   *
   * The difference between this and `?q=` is the whole point of the change:
   * `q` is a question the student typed somewhere else and meant to ask, so it
   * sends itself. A draft is a starting point we wrote for them, so it waits
   * to be read, changed, and sent by them. Nothing we compose should ever
   * spend one of their fifty questions on its own.
   */
  const [input, setInput] = useState(draft ? String(draft) : '');
  const [thinking, setThinking] = useState(false);
  /** The answer growing live while the tutor writes. Cleared on completion. */
  const [liveText, setLiveText] = useState('');
  /** A photo waiting in the composer, plus its uri for the preview chip. */
  const [photo, setPhoto] = useState<(TutorImage & { uri: string }) | null>(null);
  /** Thumbnails for photo questions sent this visit; history shows a marker. */
  const [sentPhotos, setSentPhotos] = useState<Record<string, string>>({});
  /**
   * The server owns the conversation now. threadId is minted by the tutor
   * route on the first answer and echoed back; opening a saved chat passes
   * the id in and the history is read from Postgres under the student's own
   * row-level security, so the same chat shows up on the website too.
   */
  const [threadId, setThreadId] = useState<string | null>(thread ?? null);
  /** Which answers the student rated, so the pill can show it back. */
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});

  /**
   * The rating goes to the server, not just to local state. It used to do
   * neither: the button latched, the toast said "noted", and nothing was.
   * Only real answers can be rated, so a message id the server never
   * minted is skipped rather than written as a dangling row.
   */
  const rate = (messageId: string, rating: 'up' | 'down') => {
    const uid = state.user?.id;
    if (!uid || !/^[0-9a-f-]{36}$/i.test(messageId)) return;
    void rateTutorAnswer(supabase, { messageId, userId: uid, rating });
  };
  /** The label a saved thread was stored with, for a thread with no chapter attached now. */
  const [threadLabel, setThreadLabel] = useState<string | undefined>(undefined);
  /**
   * The chapter this thread is answering from, which the student can change.
   * It starts as whatever route they arrived by and is set again by the
   * picker, so the tutor reads that chapter's published notes rather than
   * reciting the syllabus in general.
   */
  const [groundedId, setGroundedId] = useState<string | undefined>(chapter);
  /*
   * Its name, read for this screen and put in the student's language at
   * render. It was looked up once, synchronously, when the screen opened: a
   * Class 10 or Punjab chapter the index had not loaded yet had no name, so
   * the label was blank, and a name picked in English stayed English after a
   * switch to Urdu.
   */
  const groundedRow = useAsync(
    () => (groundedId ? api.getChapter(groundedId) : Promise.resolve(undefined)),
    [groundedId ?? '', contentKey],
  );
  const [pickedChoice, setPickedChoice] = useState<ChapterChoice | null>(null);
  const groundedName = groundedId
    ? chapterName(
        groundedRow.data ?? chapterById(groundedId) ?? (pickedChoice?.id === groundedId ? pickedChoice : undefined),
        lang,
      )
    : '';
  const contextLabel = (groundedId ? groundedName : '') || threadLabel || undefined;
  const [picking, setPicking] = useState(false);
  /** The server's count, not a local guess. Null until the first fetch lands. */
  const quota = useQuota();

  /**
   * A saved thread's history. New chats skip this entirely.
   *
   * Paged, because a select stops at a thousand rows without saying so and a
   * long thread lost its newest messages. Merged in front of anything already
   * on screen rather than replacing it, so a question sent before the history
   * landed is not wiped. And it says when it could not load, with a retry,
   * instead of quietly showing an empty chat.
   */
  useEffect(() => {
    if (!thread) return;
    let alive = true;
    const PAGE = 500;
    (async () => {
      try {
        const rows: { id: string; role: string; content: string; at: string }[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from('chat_messages')
            .select('id,role,content,at')
            .eq('thread_id', thread)
            .order('at')
            .order('id')
            .range(from, from + PAGE - 1);
          if (error) throw error;
          const page = (data ?? []) as typeof rows;
          rows.push(...page);
          if (page.length < PAGE) break;
        }
        const { data: meta } = await supabase.from('chat_threads').select('context_label').eq('id', thread).maybeSingle();
        if (!alive) return;
        const loaded: ChatMessage[] = rows.map((r) => ({
          id: r.id,
          role: r.role === 'assistant' ? ('ai' as const) : ('user' as const),
          text: r.content,
          at: Date.parse(r.at),
        }));
        const known = new Set(loaded.map((m) => m.id));
        setMessages((now) => [...loaded, ...now.filter((m) => !known.has(m.id))]);
        if (meta?.context_label) setThreadLabel(meta.context_label as string);
        setHistory('ready');
      } catch {
        if (alive) setHistory('failed');
      }
    })();
    return () => {
      alive = false;
    };
  }, [thread, historyTry]);

  const outOfQuestions = quota !== null && quota.remaining <= 0;

  async function send(text: string) {
    // Without the invisible direction marks translate() puts round a name
    // from the other script: right for display, but a starter or a topic
    // draft carried them into the question, the saved thread and the prompt.
    const clean = text.replace(/[\u2066-\u2069]/g, '').trim();
    if ((!clean && !photo) || thinking) return;
    if (outOfQuestions) {
      // Kept in the box, not dropped: a question that arrived from another
      // screen used to vanish here, and it is still the question they want
      // answered once the allowance comes back.
      if (clean) setInput(clean);
      toast(t('tutor.limitToast'));
      return;
    }
    const image = photo;
    const mine: ChatMessage = {
      id: `m-${Date.now()}`,
      role: 'user',
      text: clean || t('tutor.photoQuestion'),
      at: Date.now(),
    };
    setMessages((m) => [...m, mine]);
    if (image) setSentPhotos((p) => ({ ...p, [mine.id]: image.uri }));
    setInput('');
    setPhoto(null);
    setThinking(true);
    setLiveText('');

    const res = await api.askTutor(
      clean,
      {
        threadId,
        context: contextLabel,
        chapterId: groundedId,
        image: image ? { data: image.data, mediaType: image.mediaType } : undefined,
        profile: {
          name: state.user?.name,
          medium: state.settings.contentMedium,
          language: state.settings.language,
          subjects: derived.subjects,
          weakTopics: weakTopics(state.attempts)
            .slice(0, 3)
            .map((w) => w.topic),
        },
      },
      // The answer streams in; the growing text renders as a live bubble.
      (textSoFar) => setLiveText(textSoFar),
    );
    setThinking(false);
    setLiveText('');

    if (res.reason) {
      // The question never reached an answer, so it must not sit in the chat
      // looking answered. Put it back in the box and say what happened.
      setMessages((m) => m.filter((x) => x.id !== mine.id));
      setInput(clean);
      if (image) setPhoto(image);
      toast(t(aiFailureKey(res.reason)));
      return;
    }

    /* The server's own row id when we have it, so the thumbs on this answer
       can actually be recorded. A local id falls back to unratable, which is
       what every answer used to be. */
    const reply: ChatMessage = {
      id: res.messageId ?? `m-${Date.now()}-ai`,
      role: 'ai',
      text: res.text,
      steps: res.steps,
      at: Date.now(),
    };
    setMessages((m) => [...m, reply]);
    if (res.threadId) setThreadId(res.threadId);
    // Mirror into the local counter so the tutor tab's ring stays roughly
    // right between server fetches. The server remains the authority.
    actions.consumeAi();
  }

  /** Snap or pick a photo of a question, scaled to the size the tutor reads
   *  (see PHOTO_LONG_SIDE); the server enforces the hard size wall. */
  async function attachPhoto(fromCamera: boolean) {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        // Said out loud: a refused permission used to make the camera button
        // do nothing at all, which reads as a broken button.
        if (!perm.granted) {
          toast(t('tutor.cameraDenied'));
          return;
        }
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: 'images' });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.uri) return;
      /* Scaled down before it is sent. A phone photo straight from the camera
         at 60% quality was several megabytes of base64, past the 4.5 MB a
         request to the website may carry, so the question never arrived. */
      const context = ImageManipulator.manipulate(asset.uri);
      if (Math.max(asset.width, asset.height) > PHOTO_LONG_SIDE) {
        context.resize(asset.width >= asset.height ? { width: PHOTO_LONG_SIDE } : { height: PHOTO_LONG_SIDE });
      }
      const image = await context.renderAsync();
      const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
      // Both hold native memory until released, a full-size photo's worth.
      image.release();
      context.release();
      if (!saved.base64) return;
      setPhoto({ data: saved.base64, mediaType: 'image/jpeg', uri: saved.uri });
    } catch {
      toast(t('states.errorTitle'));
    }
  }

  function pickPhotoSource() {
    Alert.alert(t('tutor.photoTitle'), undefined, [
      { text: t('tutor.photoCamera'), onPress: () => void attachPhoto(true) },
      { text: t('tutor.photoGallery'), onPress: () => void attachPhoto(false) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
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
    if (wantPhoto !== '1') return;
    const timer = setTimeout(() => pickPhotoSource(), 250);
    return () => clearTimeout(timer);
    // Once, on arrival, and never again on a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantPhoto]);

  useEffect(() => {
    const timer = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages.length, thinking]);

  /**
   * Follow the answer down the screen while it is being written.
   *
   * Without this the streaming worked and nobody could tell: the live bubble
   * grew below the fold, the view stayed where it was, and the whole answer
   * seemed to appear at once the moment it finished and the list scrolled.
   */
  useEffect(() => {
    if (!liveText) return;
    const timer = setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 30);
    return () => clearTimeout(timer);
  }, [liveText]);

  return (
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
          // An empty chat has to fill the viewport, or there is nothing for
          // the greeting and the starters to be pushed apart within.
          messages.length === 0 && !thinking && { flexGrow: 1 },
          isWeb && { maxWidth: 760, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* A saved thread on its way is not an empty chat: the greeting and
            the starters used to show over a conversation that was loading. */}
        {history === 'loading' && messages.length === 0 ? (
          <View style={{ paddingVertical: S.xl, alignItems: 'center' }}>
            <TypingDots />
          </View>
        ) : history === 'failed' ? (
          <View style={{ alignItems: 'center', gap: S.sm, paddingVertical: S.md }}>
            <Small style={{ textAlign: 'center' }}>{t('states.errorTitle')}</Small>
            <Pill
              tone="teal"
              onPress={() => {
                setHistory('loading');
                setHistoryTry((n) => n + 1);
              }}
            >
              {t('common.retry')}
            </Pill>
          </View>
        ) : messages.length === 0 && !thinking ? (
          // Asked on the tap, like the follow-up chips. It only filled the
          // box, which on a one-line field showed the last few words, so a
          // card with an arrow on it looked like it had done nothing.
          <EmptyChat onStarter={(line) => void send(line)} />
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
              {sentPhotos[m.id] ? (
                <Image
                  source={{ uri: sentPhotos[m.id] }}
                  style={{ width: 180, height: 135, borderRadius: 10, marginBottom: 8 }}
                  resizeMode="cover"
                />
              ) : null}
              <ScriptText text={m.text} size={14} color={C.onBrand} />
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
              {/* Markdown-aware: the model sometimes marks up its answer,
                  and students should read headings and lists, not asterisks. */}
              <Markdown text={parseTutorActions(m.text, false, lang).text} size={13.5} />
              <AnswerActions actions={parseTutorActions(m.text, false, lang).actions} />
              {m.steps?.map((step, i) => (
                <Row key={i} gap={S.sm} style={{ marginTop: S.sm, alignItems: 'flex-start' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 99, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: C.teal }}>{i + 1}</Text>
                  </View>
                  {/* In its own script's face and leading: a step in Urdu at
                      a 22 line height overlapped the one below it. */}
                  <ScriptText text={step} size={13.5} style={{ flex: 1 }} />
                </Row>
              ))}
              <Row gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap' }}>
                {/* Latching, like the website: a rating you cannot see you
                    gave is a rating people give twice. */}
                <Pill
                  tone={feedback[m.id] === 'up' ? 'teal' : 'grey'}
                  onPress={() => {
                    setFeedback((f) => ({ ...f, [m.id]: 'up' }));
                    rate(m.id, 'up');
                    toast(t('tutor.helpful'));
                  }}
                >
                  👍
                </Pill>
                <Pill
                  tone={feedback[m.id] === 'down' ? 'red' : 'grey'}
                  onPress={() => {
                    setFeedback((f) => ({ ...f, [m.id]: 'down' }));
                    rate(m.id, 'down');
                    toast(t('tutor.notHelpful'));
                  }}
                >
                  👎
                </Pill>
                {/* Google Play: every AI answer can be reported in the app. */}
                <ReportAi variant="pill" surface="tutor" refId={m.id} excerpt={parseTutorActions(m.text, false, lang).text} />
                {/* Only when the answer is NOT already Urdu: asking for
                    Urdu on an Urdu reply spends a question for nothing. */}
                {isUrduScript(m.text) ? null : (
                  <Pill tone="teal" onPress={() => send(t('tutor.reExplainUrdu'))}>
                    {t('tutor.inUrdu')}
                  </Pill>
                )}
                <Pill
                  tone="grey"
                  onPress={() => {
                    // The answer as the student read it: the raw text carries
                    // the [[practice:...]] tags the buttons are built from.
                    Clipboard.setStringAsync(parseTutorActions(m.text, false, lang).text);
                    toast(t('tutor.copied'));
                  }}
                >
                  {t('tutor.copyAnswer')}
                </Pill>
              </Row>
              {/* Follow-ups on the newest answer only. One tap continues
                  the thread the way students actually go next, and the
                  chapter context rides along with it. */}
              {m.id === messages[messages.length - 1]?.id && !thinking ? (
                <View style={{ marginTop: S.md, borderTopWidth: 1, borderTopColor: C.line, paddingTop: S.md, gap: S.sm }}>
                  <Text style={{ fontFamily: F.bodyBold, fontSize: 11, letterSpacing: 0.7, color: C.ink3 }}>
                    {t('tutor.askFollowUp').toUpperCase()}
                  </Text>
                  <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
                    {(['followUpSimpler', 'followUpExample', 'followUpExam'] as const).map((k) => (
                      <Pill key={k} tone="grey" onPress={() => send(t(`tutor.${k}`))}>
                        {t(`tutor.${k}`)}
                      </Pill>
                    ))}
                  </Row>
                </View>
              ) : null}
            </View>
          )
        )}

        {thinking && liveText ? (
          <LiveAnswer text={liveText} />
        ) : thinking ? (
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: S.sm,
              backgroundColor: C.card,
              borderWidth: 1,
              borderColor: C.line,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderRadius: 18,
              borderBottomLeftRadius: 6,
            }}
          >
            <TypingDots />
            <Small>{t('tutor.thinking')}</Small>
          </View>
        ) : null}
      </ScrollView>

      {photo ? (
        <Row style={{ paddingHorizontal: S.md, paddingVertical: 6, backgroundColor: C.card }} gap={S.sm}>
          <Image source={{ uri: photo.uri }} style={{ width: 44, height: 44, borderRadius: 8 }} resizeMode="cover" />
          <Small style={{ flex: 1 }}>{t('tutor.photoAttached')}</Small>
          <IconButton icon="close" onPress={() => setPhoto(null)} />
        </Row>
      ) : null}

      {/* What the answer will be drawn from, said out loud and removable. The
          chapter used to be invisible: arriving from a chapter's Ask AI button
          silently grounded the whole thread and nothing on screen said so. */}
      {groundedId ? (
        <Row style={{ paddingHorizontal: S.md, paddingBottom: 6 }} gap={S.sm}>
          <View
            style={{
              flexDirection: rowDir(),
              alignItems: 'center',
              gap: 6,
              backgroundColor: C.tealTint,
              borderRadius: R.pill,
              paddingVertical: 6,
              paddingStart: 10,
              paddingEnd: 6,
              maxWidth: '100%',
            }}
          >
            <Icon name="book" size={13} color={C.teal} />
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.bodyBold, fontSize: 11.5, color: C.teal }}>
              {t('tutor.chapterAttached', { chapter: contextLabel ?? '' })}
            </Text>
            <Tap
              onPress={() => {
                setGroundedId(undefined);
                setThreadLabel(undefined);
              }}
              hit
            >
              <Icon name="close" size={13} color={C.teal} />
            </Tap>
          </View>
        </Row>
      ) : null}

      <ChapterPicker
        visible={picking}
        onClose={() => setPicking(false)}
        onPick={({ chapter: picked, topic }) => {
          setPicking(false);
          setGroundedId(picked.id);
          // Named from the choice until the chapter row arrives, and in the
          // student's language either way: this used to be the English title.
          setPickedChoice(picked);
          // A topic is a starting question; a whole chapter is only context,
          // because "explain the whole of Chemistry unit 4" is not a question
          // anybody wants answered in one go.
          if (topic) setInput((current) => (current.trim() ? current : t('tutor.explainDraft', { chapter: topic }).replace(/[\u2066-\u2069]/g, '')));
        }}
      />
      <Row
        style={{
          paddingHorizontal: S.md,
          paddingTop: S.sm,
          // The gesture pill is behind the keyboard while typing, so clearing
          // it then would only be a dead strip between the box and the keys.
          paddingBottom: keyboard > 0 ? S.sm : Math.max(insets.bottom, S.md),
          borderTopWidth: 1,
          borderTopColor: C.line,
          backgroundColor: C.card,
        }}
        gap={S.sm}
      >
        <IconButton icon="camera" onPress={pickPhotoSource} />
        {/* The discoverable half of the chapter picker. Typing @ does the
            same thing, but nothing on a phone teaches you to type @. */}
        <IconButton icon="book" onPress={() => setPicking(true)} />
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
            onChangeText={(next) => {
              /*
               * Typing @ opens the chapter picker, the way it does in every
               * chat app a fourteen-year-old already uses. The @ itself is
               * dropped: it is a gesture, not something they meant to write,
               * and it would otherwise reach the model as a stray character.
               * Only at the start of a word, so an email address typed into
               * the tutor does not hijack the screen.
               */
              if (next.length > input.length && /(^|\s)@$/.test(next)) {
                setInput(next.slice(0, -1));
                setPicking(true);
                return;
              }
              setInput(next);
            }}
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
              // The student's own question, typed in the script they read in.
              { fontFamily: F.body, fontSize: 14, color: C.ink, paddingVertical: 0, textAlign: textStart() },
              // Composed in the script being typed: an Urdu question reads
              // right to left in Nastaliq as it is written, not after send.
              isUrduScript(input) ? { ...urdu(14), paddingVertical: 0 } : null,
              isWeb && ({ outlineStyle: 'none' } as object),
            ]}
          />
        </View>
        <Tap onPress={() => send(input)} label={t('tutor.send')}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 99,
              backgroundColor: (input.trim() || photo) && !outOfQuestions ? C.teal : C.ink3,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="send" size={19} color={C.onBrand} />
          </View>
        </Tap>
      </Row>
    </Screen>
  );
}
