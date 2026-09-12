'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TUTOR_ACTION_LABEL, TUTOR_ACTION_ROUTE, api, chapterById, chapterName, isUrduScript, parseTutorActions, rateTutorAnswer, subjectById, subjectName, type ChatMessage, type StringKey, type TutorAction, type TutorImage } from '@matricmate/core';
import { namedWeakTopics } from '@/components/app/rails';
import { Btn, PillButton } from '@/components/ui/controls';
import { Empty, Icon, Pill, ScriptText, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { Markdown } from '@/components/ui/Markdown';
import { useApp, useLang, useT } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { quotaClock, useTutorQuota } from '@/lib/use-tutor-quota';
import { ChapterPicker } from '@/components/ui/ChapterPicker';

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
  if (!actions.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((a) => (
        <Link
          key={`${a.kind}-${a.chapterId}`}
          href={TUTOR_ACTION_ROUTE[a.kind](a.chapterId)}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-teal px-3.5 py-2 text-[12.5px] font-extrabold text-onbrand transition-[filter] duration-200 hover:brightness-110"
        >
          <Icon name="spark" size={13} className="shrink-0" />
          <span className="truncate">{t(TUTOR_ACTION_LABEL[a.kind] as StringKey)}</span>
          <span className="truncate font-normal opacity-85">· {a.chapterTitle}</span>
        </Link>
      ))}
    </div>
  );
}

/**
 * The chat before there is a chat.
 *
 * Two blocks pushed apart, not one column of everything: the greeting takes
 * the space at the top, and the things you can tap sit at the bottom next to
 * the box they fill in. The first version stacked a centred heading, centred
 * body copy and then a left-aligned list of tips, which read as broken, and
 * the tips repeated what the body copy already said.
 *
 * The starters are built from what we know about this student: the topic they
 * keep getting wrong, the chapter they had open last. Tapping one fills the
 * box and stops. Nothing we compose spends one of their fifty by itself.
 */
function EmptyChat({ onStarter }: { onStarter: (text: string) => void }) {
  const t = useT();
  const { lang } = useLang();
  const { state, derived } = useApp();

  const starters = useMemo(() => {
    const out: string[] = [];
    const weak = namedWeakTopics(state.attempts, lang)[0]?.topic;
    const lastChapter = state.lastChapterId ? chapterName(chapterById(state.lastChapterId), lang) : undefined;
    if (weak) out.push(t('tutor.starterWeak', { topic: weak }));
    if (lastChapter) out.push(t('tutor.starterChapter', { chapter: lastChapter }));
    const subject = subjectName(subjectById(derived.subjects[0] ?? ''), lang);
    if (subject) out.push(t('tutor.starterExam', { subject }));
    if (derived.subjects.length) out.push(t('tutor.starterPlan', { n: derived.subjects.length }));
    out.push(t('tutor.starterMarks'));
    return out.slice(0, 4);
  }, [state.attempts, state.lastChapterId, derived.subjects, lang, t]);

  return (
    <div className="flex min-h-full flex-col justify-between gap-8 py-4">
      <div className="flex flex-col items-center gap-4 px-4 pt-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-tealtint text-teal">
          <Icon name="spark" size={30} />
        </span>
        <div className="space-y-1.5">
          <h2 className="font-display text-[21px] text-ink">{t('tutor.emptyTitle')}</h2>
          <p className="mx-auto max-w-[440px] text-[13.5px] leading-[1.6] text-ink2">{t('tutor.emptyBody')}</p>
        </div>
      </div>

      {starters.length ? (
        <div className="space-y-2">
          <p className="text-[11.5px] font-extrabold uppercase tracking-[0.07em] text-ink3">{t('tutor.startersTitle')}</p>
          {starters.map((line) => (
            <button
              key={line}
              type="button"
              onClick={() => onStarter(line)}
              className="flex w-full items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 py-3 text-start transition-colors duration-200 hover:border-tealtint2 hover:bg-paper"
            >
              <span className="min-w-0 flex-1 text-[13px] leading-[1.5] text-ink">{line}</span>
              <Icon name="chevron" size={15} className="shrink-0 text-ink3" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChatScreen({
  initialQuestion,
  initialDraft,
  openPhoto,
  chapterId,
  chapterLabel,
  threadId: threadParam,
}: {
  initialQuestion?: string;
  /**
   * Prefilled into the box and left there.
   *
   * The difference between this and `initialQuestion` is the whole point: a
   * question the student typed somewhere else and meant to ask sends itself,
   * while a draft we composed for them waits to be read, changed and sent.
   * Nothing we write should spend one of their fifty on its own.
   */
  initialDraft?: string;
  /** Open the file picker on arrival, for the "Solve from a photo" tile. */
  openPhoto?: boolean;
  /** Set when the question came from a chapter: the tutor then answers
   *  from that chapter's own notes rather than from memory. */
  chapterId?: string;
  chapterLabel?: string;
  threadId?: string;
}) {
  const { state, actions, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const bottom = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialDraft ?? '');
  /**
   * The chapter this thread answers from, which the student can change. It
   * starts as whatever they arrived by and is set again by the picker, or
   * cleared (null). Until then it follows the page, so a language switch
   * re-renders the chip with the chapter's name in the new language.
   */
  const [picked, setPicked] = useState<{ id: string; label: string } | null | undefined>(undefined);
  const grounded = picked === undefined ? (chapterId ? { id: chapterId, label: chapterLabel ?? '' } : null) : picked;
  const groundedId = grounded?.id;
  const groundedLabel = grounded ? grounded.label || chapterName(chapterById(grounded.id), lang) : undefined;
  const [picking, setPicking] = useState(false);
  const [thinking, setThinking] = useState(false);
  /** The answer growing live while the tutor writes. Cleared on completion. */
  const [liveText, setLiveText] = useState('');
  /** A photo waiting in the composer, with a data URL for the preview chip. */
  const [photo, setPhoto] = useState<(TutorImage & { preview: string }) | null>(null);
  /** Thumbnails for photo questions sent this visit; history shows a marker. */
  const [sentPhotos, setSentPhotos] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  /** One vote per answer, kept so the buttons latch instead of only toasting. */
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
    void rateTutorAnswer(createClient(), { messageId, userId: uid, rating });
  };
  /**
   * The server owns the conversation. The tutor route mints the thread id on
   * the first answer; opening a saved chat passes it in and history is read
   * from Postgres under the student's own row-level security, which is why
   * the same chat also shows up in the Android app.
   */
  const [threadId, setThreadId] = useState<string | null>(threadParam ?? null);
  const [threadContext, setThreadContext] = useState<string | undefined>();
  const contextLabel = chapterLabel ?? threadContext;
  const [quota, setQuota] = useTutorQuota();
  const asked = useRef(false);

  /**
   * A saved thread's history, loaded once. New chats skip this entirely.
   *
   * With a state of its own, because an empty list meant three things: still
   * loading, failed, and a new chat. The greeting and starters flashed up
   * before every saved conversation, and a failed read stayed as a blank chat
   * that looked like it had lost the student's history.
   */
  const [history, setHistory] = useState<'loading' | 'ready' | 'failed'>(threadParam ? 'loading' : 'ready');
  const [historyAttempt, setHistoryAttempt] = useState(0);
  useEffect(() => {
    if (!threadParam) return;
    let alive = true;
    const supabase = createClient();
    (async () => {
      const [{ data: rows, error }, { data: meta }] = await Promise.all([
        // Each question and its answer are saved in one statement with one
        // timestamp, so `at` alone left the pair in either order. The
        // question sorts first ('user' after 'assistant', descending).
        supabase
          .from('chat_messages')
          .select('id,role,content,at')
          .eq('thread_id', threadParam)
          .order('at')
          .order('role', { ascending: false }),
        supabase.from('chat_threads').select('context_label').eq('id', threadParam).maybeSingle(),
      ]);
      if (!alive) return;
      if (error || !rows) {
        setHistory('failed');
        return;
      }
      setMessages(
        rows.map((r) => ({
          id: r.id as string,
          role: r.role === 'assistant' ? ('ai' as const) : ('user' as const),
          text: r.content as string,
          at: Date.parse(r.at as string),
        }))
      );
      setHistory('ready');
      if (meta?.context_label) setThreadContext(meta.context_label as string);
    })();
    return () => {
      alive = false;
    };
  }, [threadParam, historyAttempt]);

  const outOfQuestions = quota !== null && quota.remaining <= 0;

  async function send(text: string) {
    const clean = text.trim();
    // Not while the history is still coming: it replaces what is on screen
    // when it lands, and a question asked meanwhile would vanish under it.
    if ((!clean && !photo) || thinking || history !== 'ready') return;
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
    if (image) setSentPhotos((p) => ({ ...p, [mine.id]: image.preview }));
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
          weakTopics: namedWeakTopics(state.attempts, lang)
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
      // No answer was delivered, so the question must not sit in the chat
      // looking answered. Put it back in the box and say what happened.
      setMessages((m) => m.filter((x) => x.id !== mine.id));
      setInput(clean);
      if (image) setPhoto(image);
      if (res.quota) setQuota(res.quota);
      const note = {
        offline: t('tutor.offline'),
        quota: t('tutor.limitToast'),
        rate: t('tutor.slowDown'),
        plan: t('tutor.planNeeded'),
        refused: t('tutor.refused'),
        syllabus: t('tutor.notInSyllabus'),
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
    if (res.threadId) {
      setThreadId(res.threadId);
      /*
       * Put the conversation in the address, and take the question out of it.
       * A question that arrived as ?q= was asked again on every reload and on
       * Back from wherever an answer's button led, which spent another of the
       * student's fifty and started a second thread. Replaced, not pushed, and
       * through the history API, so the page is not fetched again.
       */
      if (!threadParam) {
        const params = new URLSearchParams({ thread: res.threadId });
        if (groundedId) params.set('chapter', groundedId);
        window.history.replaceState(null, '', `/tutor/chat?${params.toString()}`);
      }
    }
    if (res.quota) setQuota(res.quota);
    // Mirror into the local counter so rails stay roughly right between
    // server fetches. The server remains the authority.
    actions.consumeAi();
  }

  /**
   * A picked file, downscaled on a canvas so a 12 MP photo does not ride up
   * as ten megabytes of base64. JPEG at 0.8 keeps printed and written text
   * perfectly readable for the model.
   */
  async function attachPhoto(file: File) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setPhoto({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg', preview: dataUrl });
    } catch {
      toast(t('states.errorTitle'));
    }
  }

  // A question passed in the URL is asked once, on arrival.
  useEffect(() => {
    if (initialQuestion && !asked.current && messages.length === 0) {
      asked.current = true;
      void send(initialQuestion);
    }
  }, [initialQuestion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, thinking]);

  /* Arriving from the "Solve from a photo" tile opens the picker for them.
     A click, not a navigation, so it has to be triggered once on arrival. */
  useEffect(() => {
    if (!openPhoto) return;
    const timer = setTimeout(() => fileInput.current?.click(), 200);
    return () => clearTimeout(timer);
  }, [openPhoto]);

  return (
    /**
     * A chat owns its viewport: a full-height column with the header on top,
     * the messages scrolling in the middle, and the composer pinned to the
     * bottom. Height = viewport minus the 56px shell header, minus the phone
     * tab bar.
     */
    <div className="-mx-4 -mt-6 -mb-28 flex h-[calc(100dvh-3.5rem-58px-env(safe-area-inset-bottom))] flex-col md:-mx-8 md:-mb-16 md:h-[calc(100dvh-3.5rem)]">
      <div className="border-b border-line bg-paper px-4 py-2 md:px-8">
        <div className="mx-auto flex w-full max-w-[820px] items-center gap-2.5">
        <Link
          href="/tutor"
          aria-label={t('common.back')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-line bg-card text-ink hover:bg-paper"
        >
          <Icon name="back" size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold text-ink">{t('tutor.title')}</p>
          {contextLabel ? <p className="truncate text-[13px] text-ink2">{t('tutor.context', { label: contextLabel })}</p> : null}
        </div>
        {quota ? (
          <div className="flex flex-col items-end gap-0.5">
            <Pill tone={outOfQuestions ? 'red' : 'grey'}>
              {t('tutor.quotaPill', { n: quota.remaining, limit: quota.limit })}
            </Pill>
            {outOfQuestions ? (
              <span className="text-[11px] text-ink3">{t('tutor.resetsAt', { time: quotaClock(quota.resetAt) })}</span>
            ) : null}
          </div>
        ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 md:px-8">
        <div
          className={`mx-auto flex w-full max-w-[820px] flex-col gap-4 py-5 ${
            /* An empty chat has to fill the column, or there is nothing for
               the greeting and the starters to be pushed apart within. */
            messages.length === 0 && !thinking && history === 'ready' ? 'min-h-full' : ''
          }`}
        >
        {history === 'loading' ? (
          // Shaped like the conversation that is coming: a question on the
          // right, an answer on the left.
          <div className="flex flex-col gap-4" aria-hidden>
            <Skeleton className="h-14 w-3/4 self-end" />
            <Skeleton className="h-28 w-[85%] self-start" />
            <Skeleton className="h-12 w-2/3 self-end" />
          </div>
        ) : history === 'failed' ? (
          <Empty
            icon="alert"
            title={t('states.errorTitle')}
            sub={t('states.errorBody')}
            cta={
              <Btn
                title={t('common.retry')}
                sm
                variant="line"
                onClick={() => {
                  setHistory('loading');
                  setHistoryAttempt((n) => n + 1);
                }}
              />
            }
          />
        ) : messages.length === 0 && !thinking ? (
          <EmptyChat onStarter={setInput} />
        ) : null}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div
              key={m.id}
              className="max-w-[84%] self-end rounded-[18px] rounded-ee-[6px] bg-teal px-4 py-3 text-[14px] leading-[1.6] text-onbrand wrap-anywhere"
            >
              {sentPhotos[m.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sentPhotos[m.id]} alt="" className="mb-2 max-h-44 rounded-[10px]" />
              ) : null}
              {/* A question typed in Urdu comes back in Nastaliq, right to
                  left, rather than in the Latin face. */}
              <ScriptText text={m.text} className="text-[14px] leading-[1.6] text-onbrand" urduClassName="text-[13.5px] text-onbrand" />
            </div>
          ) : (
            <div
              key={m.id}
              className="max-w-[92%] self-start rounded-[18px] rounded-es-[6px] border border-line bg-card p-4 wrap-anywhere"
            >
              {/* Markdown-aware: the model sometimes marks up its answer,
                  and students should read headings and lists, not asterisks. */}
              {/* In the student's language: the chapter names on the buttons
                  came out English under an Urdu answer. */}
              <Markdown text={parseTutorActions(m.text, false, lang).text} className="text-[13.5px] leading-[1.65] text-ink" />
              <AnswerActions actions={parseTutorActions(m.text, false, lang).actions} />
              {m.steps?.length ? (
                <ol className="mt-2 flex flex-col gap-2">
                  {m.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tealtint text-[11px] font-extrabold text-teal">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 text-[13.5px] leading-[1.65] text-ink">{step}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={feedback[m.id] === 'up'}
                  aria-label={t('tutor.rateHelpful')}
                  onClick={() => {
                    setFeedback((f) => ({ ...f, [m.id]: 'up' }));
                    rate(m.id, 'up');
                    toast(t('tutor.helpful'));
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200 md:h-10 md:w-10 ${
                    feedback[m.id] === 'up' ? 'bg-tealtint text-teal' : 'bg-grey text-ink2 hover:text-ink'
                  }`}
                >
                  <Icon name="thumbsUp" size={16} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  aria-pressed={feedback[m.id] === 'down'}
                  aria-label={t('tutor.rateNotHelpful')}
                  onClick={() => {
                    setFeedback((f) => ({ ...f, [m.id]: 'down' }));
                    rate(m.id, 'down');
                    toast(t('tutor.notHelpful'));
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200 md:h-10 md:w-10 ${
                    feedback[m.id] === 'down' ? 'bg-redtint text-red' : 'bg-grey text-ink2 hover:text-ink'
                  }`}
                >
                  <Icon name="thumbsDown" size={16} strokeWidth={2.2} />
                </button>
                {/* Only offered when the answer is NOT already in Urdu:
                    asking for Urdu on an Urdu reply spends a question to
                    get the same thing back. */}
                {isUrduScript(m.text) ? null : (
                  <PillButton tone="teal" onClick={() => send(t('tutor.reExplainUrdu'))}>
                    {t('tutor.inUrdu')}
                  </PillButton>
                )}
                {/* Copy the answer: students paste these into their notes. */}
                <button
                  type="button"
                  aria-label={t('tutor.copyAnswer')}
                  onClick={() => {
                    void navigator.clipboard?.writeText(m.text);
                    toast(t('tutor.copied'));
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-grey text-ink2 transition-colors duration-200 hover:text-ink md:h-10 md:w-10"
                >
                  <Icon name="doc" size={16} strokeWidth={2.2} />
                </button>
              </div>
              {/* Follow-ups on the newest answer only. One tap continues the
                  thread in the direction students actually go next, and the
                  chapter context rides along with it. */}
              {m.id === messages[messages.length - 1]?.id && !thinking ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <span className="w-full text-[11px] font-extrabold uppercase tracking-[0.07em] text-ink3">
                    {t('tutor.askFollowUp')}
                  </span>
                  {(['followUpSimpler', 'followUpExample', 'followUpExam'] as const).map((k) => (
                    <PillButton key={k} tone="grey" onClick={() => send(t(`tutor.${k}`))}>
                      {t(`tutor.${k}`)}
                    </PillButton>
                  ))}
                </div>
              ) : null}
            </div>
          )
        )}

        {thinking && liveText ? (
          <div className="max-w-[92%] self-start rounded-[18px] rounded-es-[6px] border border-line bg-card p-4 wrap-anywhere">
            {/* `true`: a tag half-written by the model must not flash as raw
                brackets before it turns into a button. */}
            <Markdown text={parseTutorActions(liveText, true, lang).text} className="text-[13.5px] leading-[1.65] text-ink" />
          </div>
        ) : thinking ? (
          <div
            role="status"
            aria-label={t('tutor.thinking')}
            className="self-start rounded-[18px] rounded-es-[6px] border border-line bg-card px-4 py-[15px]"
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ink3" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-ink3 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-ink3 [animation-delay:300ms]" />
            </span>
          </div>
        ) : null}
        <div ref={bottom} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="border-t border-line bg-card px-4 py-3 md:px-8"
      >
        <div className="mx-auto w-full max-w-[820px]">
          {/* What the answer will be drawn from, said out loud and removable.
              The chapter used to be invisible: arriving from a chapter's Ask
              AI button silently grounded the thread and nothing said so. */}
          {groundedId ? (
            <span className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-tealtint py-1.5 ps-2.5 pe-1.5 text-[11.5px] font-extrabold text-teal">
              <Icon name="book" size={13} className="shrink-0" />
              <span className="truncate">{t('tutor.chapterAttached', { chapter: groundedLabel ?? '' })}</span>
              {/* A 40px target that does not make the chip taller: the negative
                  margin gives its height back to the row. */}
              <button
                type="button"
                aria-label={t('tutor.chapterClear')}
                onClick={() => setPicked(null)}
                className="-my-2.5 -me-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200 hover:bg-tealtint2"
              >
                <Icon name="close" size={13} />
              </button>
            </span>
          ) : null}
        </div>
        <ChapterPicker
          open={picking}
          onClose={() => setPicking(false)}
          onPick={({ chapter, topic }) => {
            setPicking(false);
            setPicked({ id: chapter.id, label: chapterName(chapter, lang) });
            // A topic is a starting question; a whole chapter is only context,
            // because "explain the whole of unit 4" is not a question anybody
            // wants answered in one go.
            if (topic) setInput((current) => (current.trim() ? current : t('tutor.explainDraft', { chapter: topic })));
          }}
        />
        <div className="mx-auto flex w-full max-w-[820px] items-center gap-2.5">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void attachPhoto(f);
            e.target.value = '';
          }}
        />
        {photo ? (
          <button
            type="button"
            aria-label={t('common.cancel')}
            title={t('tutor.photoAttached')}
            onClick={() => setPhoto(null)}
            className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[12px] border border-line"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.preview} alt="" className="h-full w-full object-cover" />
          </button>
        ) : (
          <button
            type="button"
            aria-label={t('tutor.photoTitle')}
            onClick={() => fileInput.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-grey text-ink2 transition-colors duration-200 hover:text-ink"
          >
            <Icon name="camera" size={19} />
          </button>
        )}
        {/* The discoverable half of the chapter picker. Typing @ does the
            same thing, but nothing teaches you to type @. */}
        <button
          type="button"
          aria-label={t('tutor.pickChapterTitle')}
          title={t('tutor.pickChapterTitle')}
          onClick={() => setPicking(true)}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
            groundedId ? 'bg-tealtint text-teal' : 'bg-grey text-ink2 hover:text-ink'
          }`}
        >
          <Icon name="book" size={19} />
        </button>
        {/* .field-shell owns the focus ring; a bare outline-none input erased it */}
        <div
          className={`field-shell flex min-h-11 min-w-0 flex-1 items-center rounded-full border-[1.5px] border-line px-4 py-0.5 transition-[border-color,box-shadow] duration-200 ${
            outOfQuestions ? 'bg-grey' : 'bg-paper'
          }`}
        >
          <input
            value={input}
            onChange={(e) => {
              /*
               * Typing @ opens the chapter picker, the way it does in every
               * chat app a student already uses. The @ itself is dropped: it
               * is a gesture, not something they meant to write. Only at the
               * start of a word, so an email address typed into the tutor
               * does not hijack the screen.
               */
              const next = e.target.value;
              if (next.length > input.length && /(^|\s)@$/.test(next)) {
                setInput(next.slice(0, -1));
                setPicking(true);
                return;
              }
              setInput(next);
            }}
            disabled={outOfQuestions}
            placeholder={
              outOfQuestions && quota
                ? t('tutor.limitInputHint', { time: quotaClock(quota.resetAt) })
                : t('tutor.placeholder')
            }
            aria-label={t('tutor.placeholder')}
            lang={isUrduScript(input) ? 'ur' : undefined}
            dir={isUrduScript(input) ? 'rtl' : undefined}
            /*
             * A fixed height, so the field does not jump on the first Urdu
             * letter, and Nastaliq at the size .urdu-inline used to give it
             * (1.22 times the 16px around it) with room for its tall ink. Now
             * that the class yields to utilities, the old 15px beside it won
             * and Urdu came out smaller than the Latin it replaced. Latin is
             * 16px on a phone, where anything smaller makes iOS zoom the page
             * on focus and leave it zoomed.
             */
            className={`h-9 w-full bg-transparent text-ink outline-none placeholder:text-ink3 disabled:cursor-not-allowed ${
              isUrduScript(input) ? 'font-urdu text-[19.5px] leading-9' : 'text-[16px] md:text-[14px]'
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={(!input.trim() && !photo) || thinking || outOfQuestions || history !== 'ready'}
          aria-label={t('tutor.send')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal text-onbrand transition-colors duration-200 hover:bg-tealdark disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Icon name="send" size={19} />
        </button>
        </div>
      </form>
    </div>
  );
}
