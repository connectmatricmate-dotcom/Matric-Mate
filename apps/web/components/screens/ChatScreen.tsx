'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { type ChatMessage, api } from '@matricmate/core';
import { PillButton } from '@/components/ui/controls';
import { Card, Icon, Pill } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';

export function ChatScreen({
  initialQuestion,
  chapterLabel,
  threadId,
}: {
  initialQuestion?: string;
  chapterLabel?: string;
  threadId?: string;
}) {
  const { state, actions, derived } = useApp();
  const t = useT();
  const toast = useToast();
  const bottom = useRef<HTMLDivElement>(null);

  const existing = threadId ? state.threads.find((x) => x.id === threadId) : undefined;
  const [messages, setMessages] = useState<ChatMessage[]>(existing?.messages ?? []);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  /** One vote per answer, kept so the buttons latch instead of only toasting. */
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  // Minted on the first message, not during render, a thread that is never
  // sent shouldn't claim an id, and reading the clock while rendering is impure.
  const id = useRef(existing?.id ?? '');
  const contextLabel = chapterLabel ?? existing?.contextLabel;
  const asked = useRef(false);

  // A saved thread opened before the store hydrates finds no messages on the
  // first render. Backfilled during render once the threads arrive, never over
  // a live chat. The thread id follows along inside send().
  if (existing && messages.length === 0 && !thinking && existing.messages.length) {
    setMessages(existing.messages);
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || thinking) return;
    if (!derived.aiLeft) {
      toast(t('tutor.limitToast'));
      return;
    }
    if (!actions.consumeAi()) return;
    // The ref seeds before hydration, so a saved thread's id may arrive late.
    if (!id.current) id.current = existing?.id ?? `t-${Date.now()}`;

    const mine: ChatMessage = { id: `m-${Date.now()}`, role: 'user', text: clean, at: Date.now() };
    const history = [...messages, mine];
    setMessages(history);
    setInput('');
    setThinking(true);

    const res = await api.askTutor(clean, contextLabel);
    const reply: ChatMessage = { id: `m-${Date.now()}-ai`, role: 'ai', text: res.text, steps: res.steps, at: Date.now() };
    const next = [...history, reply];
    setThinking(false);
    setMessages(next);
    actions.saveThread({
      id: id.current,
      title: clean.length > 42 ? `${clean.slice(0, 42)}…` : clean,
      contextLabel,
      messages: next,
      at: Date.now(),
    });
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
     * bottom. The previous sticky-in-flow layout put the composer wherever the
     * content happened to end, so a short chat crammed against the top of an
     * empty page and the type box drifted downward as messages arrived.
     * Height = viewport minus the 56px shell header, minus the phone tab bar.
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
        <Pill tone={derived.aiLeft ? 'grey' : 'red'}>{t('tutor.leftToday', { n: derived.aiLeft })}</Pill>
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
              className="max-w-[84%] self-end rounded-[18px] rounded-br-[6px] bg-teal px-4 py-3 text-[14px] leading-[1.6] text-white"
            >
              {m.text}
            </div>
          ) : (
            <div
              key={m.id}
              className="max-w-[92%] self-start rounded-[18px] rounded-bl-[6px] border border-line bg-card p-4"
            >
              <p className="text-[13.5px] font-extrabold leading-[1.5] text-ink">{m.text}</p>
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
                    toast(t('tutor.notHelpful'));
                  }}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
                    feedback[m.id] === 'down' ? 'bg-redtint text-red' : 'bg-grey text-ink2 hover:text-ink'
                  }`}
                >
                  <Icon name="thumbsDown" size={16} strokeWidth={2.2} />
                </button>
                <PillButton tone="teal" className="min-h-10" onClick={() => send(t('tutor.reExplainUrdu'))}>
                  {t('tutor.inUrdu')}
                </PillButton>
              </div>
            </div>
          )
        )}

        {thinking ? (
          <div
            role="status"
            aria-label={t('tutor.thinking')}
            className="self-start rounded-[18px] rounded-bl-[6px] border border-line bg-card px-4 py-[15px]"
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
        {/* No camera button: a control whose only behaviour was announcing its
            own absence ("photo questions arrive later") is noise, not a feature.
            It returns with the live tutor in M3. */}
        {/* .field-shell owns the focus ring; a bare outline-none input erased it */}
        <div className="field-shell flex min-w-0 flex-1 items-center rounded-full border-[1.5px] border-line bg-paper px-4 py-2.5 transition-[border-color,box-shadow] duration-200">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('tutor.placeholder')}
            aria-label={t('tutor.placeholder')}
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-ink3"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          aria-label={t('tutor.send')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal text-white transition-colors duration-200 hover:bg-tealdark disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Icon name="send" size={19} />
        </button>
        </div>
      </form>
    </div>
  );
}
