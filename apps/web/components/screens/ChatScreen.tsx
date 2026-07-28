'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { type ChatMessage, api } from '@matricmate/core';
import { IconButton, PillButton } from '@/components/ui/controls';
import { Card, Icon, Pill } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';
import { Page } from '@/components/app/Page';

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
  // Minted on the first message, not during render, a thread that is never
  // sent shouldn't claim an id, and reading the clock while rendering is impure.
  const id = useRef(existing?.id ?? '');
  const contextLabel = chapterLabel ?? existing?.contextLabel;
  const asked = useRef(false);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || thinking) return;
    if (!derived.aiLeft) {
      toast(t('tutor.limitToast'));
      return;
    }
    if (!actions.consumeAi()) return;
    if (!id.current) id.current = `t-${Date.now()}`;

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
    <Page width="focus">
      <div className="sticky top-[57px] z-20 -mx-4 flex items-center gap-2.5 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur md:-mx-7 md:px-7">
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

      <div className="flex flex-col gap-4 py-5">
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
                <PillButton tone="grey" onClick={() => toast(t('tutor.helpful'))}>
                  <span aria-label="Helpful">👍</span>
                </PillButton>
                <PillButton tone="grey" onClick={() => toast(t('tutor.notHelpful'))}>
                  <span aria-label="Not helpful">👎</span>
                </PillButton>
                <PillButton tone="teal" onClick={() => send(t('tutor.reExplainUrdu'))}>
                  {t('tutor.inUrdu')}
                </PillButton>
              </div>
            </div>
          )
        )}

        {thinking ? (
          <div className="self-start rounded-[18px] border border-line bg-card px-4 py-3 text-[13px] text-ink2">
            {t('tutor.thinking')}
          </div>
        ) : null}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-0 -mx-4 flex items-center gap-2.5 border-t border-line bg-card px-4 py-3 md:-mx-7 md:px-7"
      >
        <IconButton icon="camera" label={t('tutor.photoSoon')} onClick={() => toast(t('tutor.photoSoon'))} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('tutor.placeholder')}
          aria-label={t('tutor.placeholder')}
          className="min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-paper px-4 py-2.5 text-[14px] text-ink outline-none transition-colors duration-200 placeholder:text-ink3 focus:border-teal"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          aria-label="Send"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors duration-200 ${
            input.trim() ? 'bg-teal hover:bg-tealdark' : 'bg-ink3'
          }`}
        >
          <Icon name="send" size={19} />
        </button>
      </form>
    </Page>
  );
}
