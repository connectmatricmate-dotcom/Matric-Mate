import { useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../../src/components/Icon';
import { IconButton, Pill, Row, Screen, ScriptText, Small, Tap, TypingDots, useRevealed, useToast } from '../../src/components/ui';
import { useKeyboardOverlap } from '../../src/core/keyboard';
import { ChapterPicker } from '../../src/components/ChapterPicker';
import { ChatMessage, api, chapterById, isUrduScript, rateTutorAnswer, weakTopics } from '@matricmate/core';
import type { TutorImage } from '@matricmate/core';
import { supabase } from '../../src/lib/supabase';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, R, S, isWeb, rowDir, textStart, urdu } from '../../src/theme';
import { Markdown } from '../../src/components/Markdown';
import { useQuota } from '../../src/core/useQuota';

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
      <Markdown text={shown} size={13.5} />
    </View>
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
function EmptyChat() {
  const t = useT();
  const tips: { icon: IconName; key: 'tutor.emptyTip1' | 'tutor.emptyTip2' | 'tutor.emptyTip3' }[] = [
    { icon: 'globe', key: 'tutor.emptyTip1' },
    { icon: 'camera', key: 'tutor.emptyTip2' },
    { icon: 'book', key: 'tutor.emptyTip3' },
  ];
  return (
    <View style={{ alignItems: 'center', paddingTop: S.xl, paddingHorizontal: S.md, gap: S.md }}>
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
        <Small style={{ textAlign: 'center', lineHeight: 20 }}>{t('tutor.emptyBody')}</Small>
      </View>
      <View style={{ gap: S.sm, alignSelf: 'stretch', marginTop: S.sm }}>
        {tips.map((tip) => (
          <Row key={tip.key} gap={S.sm} style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                backgroundColor: C.card,
                borderWidth: 1,
                borderColor: C.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={tip.icon} size={15} color={C.ink2} />
            </View>
            <Small style={{ flex: 1, fontSize: 12.5 }}>{t(tip.key)}</Small>
          </Row>
        ))}
      </View>
    </View>
  );
}

export default function Chat() {
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
  const { state, actions, derived } = useApp();
  const t = useT();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardOverlap();
  const scroller = useRef<ScrollView | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
  const [contextLabel, setContextLabel] = useState<string | undefined>(
    chapter ? chapterById(chapter)?.title : undefined
  );
  /**
   * The chapter this thread is answering from, which the student can change.
   * It starts as whatever route they arrived by and is set again by the
   * picker, so the tutor reads that chapter's published notes rather than
   * reciting the syllabus in general.
   */
  const [groundedId, setGroundedId] = useState<string | undefined>(chapter);
  const [picking, setPicking] = useState(false);
  /** The server's count, not a local guess. Null until the first fetch lands. */
  const quota = useQuota();

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
    if ((!clean && !photo) || thinking) return;
    if (outOfQuestions) {
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

  /** Snap or pick a photo of a question. Compressed by the picker; the
   *  server enforces the hard size wall. */
  async function attachPhoto(fromCamera: boolean) {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: true, mediaTypes: 'images' });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.base64) return;
      const mediaType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      setPhoto({ data: asset.base64, mediaType, uri: asset.uri });
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
          isWeb && { maxWidth: 760, width: '100%', alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && !thinking ? <EmptyChat /> : null}

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
              <Markdown text={m.text} size={13.5} />
              {m.steps?.map((step, i) => (
                <Row key={i} gap={S.sm} style={{ marginTop: S.sm, alignItems: 'flex-start' }}>
                  <View style={{ width: 20, height: 20, borderRadius: 99, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: C.teal }}>{i + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, fontFamily: F.body, fontSize: 13.5, lineHeight: 22, color: C.ink }}>{step}</Text>
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
                    Clipboard.setStringAsync(m.text);
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
              {t('tutor.chapterAttached', { chapter: contextLabel ?? chapterById(groundedId)?.title ?? '' })}
            </Text>
            <Tap
              onPress={() => {
                setGroundedId(undefined);
                setContextLabel(undefined);
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
          setContextLabel(picked.title);
          // A topic is a starting question; a whole chapter is only context,
          // because "explain the whole of Chemistry unit 4" is not a question
          // anybody wants answered in one go.
          if (topic) setInput((current) => (current.trim() ? current : t('tutor.explainDraft', { chapter: topic })));
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
        <Tap onPress={() => send(input)}>
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
