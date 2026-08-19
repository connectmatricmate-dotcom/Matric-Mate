'use client';

import { formatDate } from '@matricmate/core';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { IconName, StringKey } from '@matricmate/core';
import { Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { TutorBudgetRail, WeakRail } from '@/components/app/rails';
import { Btn } from '@/components/ui/controls';
import { Card, Empty, Icon, Item } from '@/components/ui/primitives';
import { ChapterPicker } from '@/components/ui/ChapterPicker';
import { useApp, useLang, useT } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { useTutorQuota } from '@/lib/use-tutor-quota';

type ThreadRow = { id: string; title: string; context_label: string | null; updated_at: string };

/**
 * Three ways in, and not one of them spends a question.
 *
 * There were four, and three carried a hardcoded prompt that was sent the
 * instant you clicked the tile: "Explain a topic" asked about Newton's second
 * law, whoever you were. A Class 10 biology student clicking it got a physics
 * answer to a question they had not asked, in English however they had set the
 * app, and it cost them one of their fifty for the day. The fourth, "Make it
 * simple", opened the same chat as the first: four doors into one room.
 *
 * Now each tile opens the composer in a different state and the student
 * presses send. Same three as the Android app, deliberately.
 */
const ENTRIES: { key: 'ask' | 'explain' | 'photo'; label: StringKey; sub: StringKey; icon: IconName }[] = [
  { key: 'ask', label: 'tutor.askDoubt', sub: 'tutor.askDoubtSub', icon: 'spark' },
  { key: 'explain', label: 'tutor.explainTopic', sub: 'tutor.explainTopicSub', icon: 'book' },
  { key: 'photo', label: 'tutor.solveQuestion', sub: 'tutor.solveQuestionSub', icon: 'camera' },
];

export function TutorView() {
  const { derived } = useApp();
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const t = useT();
  const { lang } = useLang();

  // The server's numbers, with the local mirror as the pre-fetch fallback.
  const [quota] = useTutorQuota();
  const left = quota ? quota.remaining : derived.aiLeft;
  const limit = quota ? quota.limit : derived.aiLimit;

  /**
   * Recent chats come from Postgres, where the tutor route saves every
   * conversation, so a chat started on the phone shows up here too. RLS only
   * returns the signed-in student's own threads.
   */
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  /** A failed read is not an empty history: see the branch below. */
  const [threadsFailed, setThreadsFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    createClient()
      .from('chat_threads')
      .select('id,title,context_label,updated_at')
      .order('updated_at', { ascending: false })
      .limit(8)
      .then(({ data, error }) => {
        if (!alive) return;
        setThreadsFailed(!!error);
        if (data) setThreads(data as ThreadRow[]);
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  return (
    <Page>
      <PageHead title={t('tutor.title')} sub={t('tutor.sub')} eyebrow={t('tutor.leftToday', { n: left })} />

      <Split>
        <Work className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ENTRIES.map((e) => {
              const body = (
                <Card className="flex h-full items-start gap-3 text-start transition-colors duration-200 hover:border-teal">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-tealtint text-teal">
                    <Icon name={e.icon} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-extrabold text-ink">{t(e.label)}</span>
                    <span className="block text-[12.5px] leading-[1.5] text-ink2">{t(e.sub)}</span>
                  </span>
                </Card>
              );
              // The chapter one opens a dialog rather than navigating, so it is
              // a button. The other two are real destinations and stay links,
              // which keeps middle-click and open-in-new-tab working.
              return e.key === 'explain' ? (
                <button key={e.key} type="button" onClick={() => setPicking(true)} className="block h-full w-full">
                  {body}
                </button>
              ) : (
                <Link key={e.key} href={e.key === 'photo' ? '/tutor/chat?photo=1' : '/tutor/chat'} className="block h-full">
                  {body}
                </Link>
              );
            })}
          </div>

          {/* Picking a chapter prefills the box and stops. Nothing is sent
              until the student sends it, and the chapter rides along as
              context so the answer comes out of their own notes. */}
          <ChapterPicker
            open={picking}
            onClose={() => setPicking(false)}
            onPick={({ chapter, topic }) => {
              setPicking(false);
              const draft = t('tutor.explainDraft', { chapter: topic ?? chapter.title });
              router.push(`/tutor/chat?chapter=${chapter.id}&draft=${encodeURIComponent(draft)}`);
            }}
          />

          <Link href="/tutor/ai-test" className="block">
            <Card border="border-orange" className="flex items-center gap-3 transition-colors duration-200 hover:brightness-[0.99]">
              <Icon name="spark" className="shrink-0 text-orangedark" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-extrabold text-ink">{t('tutor.makeTest')}</span>
                <span className="block text-[13px] text-ink2">{t('tutor.makeTestSub')}</span>
              </span>
              <Icon name="chevron" size={18} className="shrink-0 text-ink3" />
            </Card>
          </Link>

          <Link href="/tutor/paper" className="block">
            <Card border="border-teal" className="flex items-center gap-3 transition-colors duration-200 hover:brightness-[0.99]">
              <Icon name="doc" className="shrink-0 text-teal" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-extrabold text-ink">{t('tutor.paperTitle')}</span>
                <span className="block text-[13px] text-ink2">{t('tutor.paperSub')}</span>
              </span>
              <Icon name="chevron" size={18} className="shrink-0 text-ink3" />
            </Card>
          </Link>

          {left === 0 ? (
            <Card flat tint="bg-redtint" border="border-red">
              <p className="text-[13.5px] font-extrabold text-red">{t('tutor.limitTitle')}</p>
              <p className="mt-0.5 text-[13px] text-ink2">
                {limit === 0 ? t('tutor.limitPremium') : t('tutor.limitBody', { n: limit })}
              </p>
            </Card>
          ) : null}

          <div>
            <h2 className="mb-2 font-display text-[16px] text-ink">{t('tutor.recentChats')}</h2>
            {threadsFailed && threads.length === 0 ? (
              /* Telling a student with a month of conversations that they have
                 none, and giving them nothing to press, is the wrong half of
                 this pair. */
              <Empty
                icon="alert"
                title={t('states.errorTitle')}
                sub={t('states.errorBody')}
                cta={<Btn title={t('common.retry')} sm variant="line" onClick={() => setAttempt((n) => n + 1)} />}
              />
            ) : threads.length === 0 ? (
              /* Was the WhatsApp glyph, left behind when that channel was
                 removed. Nothing here has been about WhatsApp for a while. */
              <Empty icon="spark" title={t('tutor.noChatsTitle')} sub={t('tutor.noChatsBody')} />
            ) : (
              <>
                <Card flat className="py-0">
                  {threads.slice(0, 5).map((thread, i, shown) => (
                    <Item
                      key={thread.id}
                      href={`/tutor/chat?thread=${thread.id}`}
                      title={thread.title}
                      sub={`${thread.context_label ?? ''} ${formatDate(thread.updated_at, lang, { day: 'numeric', month: 'short' })}`.trim()}
                      icon="spark"
                      last={i === shown.length - 1}
                    />
                  ))}
                </Card>
                {/* Only when there is more to see. A link to a list of the
                    same five you are already looking at is a small lie. */}
                {threads.length > 5 ? (
                  <Link
                    href="/tutor/chats"
                    className="mt-2.5 inline-flex min-h-11 items-center gap-1 text-[13px] font-extrabold text-teal transition-colors duration-200 hover:brightness-90"
                  >
                    {t('tutor.viewAllChats')}
                    <Icon name="chevron" size={16} />
                  </Link>
                ) : null}
              </>
            )}
          </div>

          <p className="text-center text-[12px] text-ink3">{t('tutor.disclaimer')}</p>
        </Work>

        <Rail>
          <TutorBudgetRail />
          <WeakRail />
        </Rail>
      </Split>
    </Page>
  );
}
