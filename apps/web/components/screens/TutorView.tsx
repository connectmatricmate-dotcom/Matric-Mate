'use client';

import Link from 'next/link';
import type { IconName, StringKey } from '@matricmate/core';
import { Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { TutorBudgetRail, WeakRail } from '@/components/app/rails';
import { Card, Empty, Icon, Item } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

const ENTRIES: { label: StringKey; sub: StringKey; icon: IconName; prompt: string }[] = [
  { label: 'tutor.askDoubt', sub: 'tutor.askDoubtSub', icon: 'spark', prompt: '' },
  { label: 'tutor.explainTopic', sub: 'tutor.explainTopicSub', icon: 'book', prompt: 'Explain Newton’s second law simply' },
  {
    label: 'tutor.solveQuestion',
    sub: 'tutor.solveQuestionSub',
    icon: 'calc',
    prompt: 'A 5 kg body is pushed with 20 N. Find its acceleration.',
  },
  { label: 'tutor.conceptClarity', sub: 'tutor.conceptClaritySub', icon: 'help', prompt: 'What is inertia? Give an example.' },
];

export function TutorView() {
  const { state, derived } = useApp();
  const t = useT();

  return (
    <Page>
      <PageHead title={t('tutor.title')} sub={t('tutor.sub')} eyebrow={t('tutor.leftToday', { n: derived.aiLeft })} />

      <Split>
        <Work className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ENTRIES.map((e) => (
              <Link key={e.label} href={e.prompt ? `/tutor/chat?q=${encodeURIComponent(e.prompt)}` : '/tutor/chat'}>
                <Card className="flex h-full items-start gap-3 transition-colors duration-200 hover:border-teal">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-tealtint text-teal">
                    <Icon name={e.icon} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-extrabold text-ink">{t(e.label)}</span>
                    <span className="block text-[12.5px] leading-[1.5] text-ink2">{t(e.sub)}</span>
                  </span>
                </Card>
              </Link>
            ))}
          </div>

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

          {derived.aiLeft === 0 ? (
            <Card flat tint="bg-redtint" border="border-red">
              <p className="text-[13.5px] font-extrabold text-red">{t('tutor.limitTitle')}</p>
              <p className="mt-0.5 text-[13px] text-ink2">
                {t('tutor.limitBody', { n: derived.aiLimit })}
                {state.premium.active ? '' : ` ${t('tutor.limitPremium')}`}
              </p>
            </Card>
          ) : null}

          <div>
            <h2 className="mb-2 font-display text-[16px] text-ink">{t('tutor.recentChats')}</h2>
            {state.threads.length === 0 ? (
              <Empty emoji="💬" title={t('tutor.noChatsTitle')} sub={t('tutor.noChatsBody')} />
            ) : (
              <Card flat className="py-0">
                {state.threads.slice(0, 8).map((thread, i) => (
                  <Item
                    key={thread.id}
                    href={`/tutor/chat?thread=${thread.id}`}
                    title={thread.title}
                    sub={`${thread.contextLabel ?? ''} ${new Date(thread.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`.trim()}
                    icon="spark"
                    last={i === Math.min(7, state.threads.length - 1)}
                  />
                ))}
              </Card>
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
