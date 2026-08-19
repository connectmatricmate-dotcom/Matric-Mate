'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, isUrduScript, rateTutorAnswer, type ChatMessage, type TutorImage, weakTopics } from '@matricmate/core';
import { PillButton } from '@/components/ui/controls';
import { Card, Icon, Pill, ScriptText } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { Markdown } from '@/components/ui/Markdown';
import { useApp, useT } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { quotaClock, useTutorQuota } from '@/lib/use-tutor-quota';

export function ChatScreen({
  initialQuestion,
  chapterId,
  chapterLabel,
  threadId: threadParam,
}: {
  initialQuestion?: string;
  /** Set when the question came from a chapter: the tutor then answers
   *  from that chapter's own notes rather than from memory. */
  chapterId?: string;
  chapterLabel?: string;
  threadId?: string;
}) {
  const { state, actions, derived } = useApp();
  const t = useT();
  const toast = useToast();
  const bottom = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
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
  const [contextLabel, setContextLabel] = useState<string | undefined>(chapterLabel);
  const [quota, setQuota] = useTutorQuota();
  const asked = useRef(false);

  /** A saved thread's history, loaded once. New chats skip this entirely. */
  useEffect(() => {
    if (!threadParam) return;
    let alive = true;
    const supabase = createClient();
    (async () => {
      const [{ data: rows }, { data: meta }] = await Promise.all([
        supabase.from('chat_messages').select('id,role,content,at').eq('thread_id', threadParam).order('at'),
        supabase.from('chat_threads').select('context_label').eq('id', threadParam).maybeSingle(),
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
    })();
    return () => {
      alive = false;
    };
  }, [threadParam]);

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
        chapterId,
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
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4 py-5">
        {messages.length === 0 && !thinking ? (
          <Card flat tint="bg-tealtint" border="border-tealtint2">
            <p className="text-[14.5px] text-ink">{t('tutor.starter')}</p>
          </Card>
        ) : null}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div
              key={m.id}
              className="max-w-[84%] self-end rounded-[18px] rounded-ee-[6px] bg-teal px-4 py-3 text-[14px] leading-[1.6] text-onbrand"
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
              className="max-w-[92%] self-start rounded-[18px] rounded-es-[6px] border border-line bg-card p-4"
            >
              {/* Markdown-aware: the model sometimes marks up its answer,
                  and students should read headings and lists, not asterisks. */}
              <Markdown text={m.text} className="text-[13.5px] leading-[1.65] text-ink" />
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
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  aria-pressed={feedback[m.id] === 'up'}
                  aria-label={t('tutor.rateHelpful')}
                  onClick={() => {
                    setFeedback((f) => ({ ...f, [m.id]: 'up' }));
                    rate(m.id, 'up');
                    toast(t('tutor.helpful'));
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
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
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
                    feedback[m.id] === 'down' ? 'bg-redtint text-red' : 'bg-grey text-ink2 hover:text-ink'
                  }`}
                >
                  <Icon name="thumbsDown" size={16} strokeWidth={2.2} />
                </button>
                {/* Only offered when the answer is NOT already in Urdu:
                    asking for Urdu on an Urdu reply spends a question to
                    get the same thing back. */}
                {isUrduScript(m.text) ? null : (
                  <PillButton tone="teal" className="min-h-10" onClick={() => send(t('tutor.reExplainUrdu'))}>
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
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-grey text-ink2 transition-colors duration-200 hover:text-ink"
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
                    <PillButton key={k} tone="grey" className="min-h-9" onClick={() => send(t(`tutor.${k}`))}>
                      {t(`tutor.${k}`)}
                    </PillButton>
                  ))}
                </div>
              ) : null}
            </div>
          )
        )}

        {thinking && liveText ? (
          <div className="max-w-[92%] self-start rounded-[18px] rounded-es-[6px] border border-line bg-card p-4">
            <Markdown text={liveText} className="text-[13.5px] leading-[1.65] text-ink" />
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
        {/* .field-shell owns the focus ring; a bare outline-none input erased it */}
        <div
          className={`field-shell flex min-w-0 flex-1 items-center rounded-full border-[1.5px] border-line px-4 py-2.5 transition-[border-color,box-shadow] duration-200 ${
            outOfQuestions ? 'bg-grey' : 'bg-paper'
          }`}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={outOfQuestions}
            placeholder={
              outOfQuestions && quota
                ? t('tutor.limitInputHint', { time: quotaClock(quota.resetAt) })
                : t('tutor.placeholder')
            }
            aria-label={t('tutor.placeholder')}
            lang={isUrduScript(input) ? 'ur' : undefined}
            dir={isUrduScript(input) ? 'rtl' : undefined}
            className={`w-full bg-transparent text-ink outline-none placeholder:text-ink3 disabled:cursor-not-allowed ${
              isUrduScript(input) ? 'urdu-inline text-[15px]' : 'text-[14px]'
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={(!input.trim() && !photo) || thinking || outOfQuestions}
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
