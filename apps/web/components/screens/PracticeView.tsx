'use client';

import Link from 'next/link';
import type { IconName, StringKey } from '@matricmate/core';
import { Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { ConfidenceRail, TutorBudgetRail, WeakRail } from '@/components/app/rails';
import { Card, Empty, Icon, Item, Pill } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

const MODES: { label: StringKey; sub: StringKey; icon: IconName; href: string; accent?: boolean }[] = [
  { label: 'practice.mcqs', sub: 'practice.mcqsSub', icon: 'target', href: '/session/setup' },
  { label: 'practice.flashcards', sub: 'practice.flashcardsSub', icon: 'cards', href: '/session/flashcards' },
  { label: 'practice.blanks', sub: 'practice.blanksSub', icon: 'edit', href: '/session/blanks' },
  { label: 'practice.shortQ', sub: 'practice.shortQSub', icon: 'quill', href: '/session/shortq' },
  { label: 'practice.papers', sub: 'practice.papersSub', icon: 'doc', href: '/session/papers' },
  { label: 'practice.toppers', sub: 'practice.toppersSub', icon: 'award', href: '/session/topper-papers' },
  { label: 'practice.exam', sub: 'practice.examSub', icon: 'clock', href: '/session/exam-intro', accent: true },
];

export function PracticeView() {
  const { state } = useApp();
  const t = useT();
  const recent = state.results.slice(0, 5);

  return (
    <Page>
      <PageHead
        title={t('practice.title')}
        sub={t('practice.sub')}
        eyebrow={t('practice.answered', { n: state.attempts.length })}
      />

      <Split>
        <Work className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {MODES.map((m) => (
              <Link key={m.label} href={m.href}>
                <Card
                  border={m.accent ? 'border-orange' : undefined}
                  className="flex h-full flex-col gap-2 transition-colors duration-200 hover:border-teal"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-[13px] ${
                      m.accent ? 'bg-orangetint text-orangedark' : 'bg-tealtint text-teal'
                    }`}
                  >
                    <Icon name={m.icon} size={20} />
                  </span>
                  <span className="mt-0.5 text-[14.5px] font-extrabold text-ink">{t(m.label)}</span>
                  <span className="text-[12.5px] leading-[1.5] text-ink2">{t(m.sub)}</span>
                </Card>
              </Link>
            ))}
          </div>

          <Link href="/tutor/ai-test" className="block">
            <Card
              border="border-tealtint2"
              className="flex items-center gap-3 border-dashed transition-colors duration-200 hover:border-teal"
            >
              <Icon name="spark" className="shrink-0 text-orangedark" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-extrabold text-ink">{t('practice.aiTest')}</span>
                <span className="block text-[13px] text-ink2">{t('practice.aiTestSub')}</span>
              </span>
              <Icon name="chevron" size={18} className="shrink-0 text-ink3" />
            </Card>
          </Link>

          <div>
            <h2 className="mb-2 font-display text-[16px] text-ink">{t('practice.recent')}</h2>
            {recent.length === 0 ? (
              <Empty icon="target" title={t('practice.noneTitle')} sub={t('practice.noneBody')} />
            ) : (
              <Card flat className="py-0">
                {recent.map((r, i) => (
                  <Item
                    key={r.id}
                    title={r.label}
                    sub={`${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${r.score}/${r.total} · +${r.xp} XP`}
                    icon={r.mode === 'exam' ? 'clock' : 'target'}
                    tone={r.mode === 'exam' ? 'orange' : 'teal'}
                    last={i === recent.length - 1}
                    right={
                      <Pill tone={r.score / r.total >= 0.7 ? 'green' : 'red'}>{`${Math.round((r.score / r.total) * 100)}%`}</Pill>
                    }
                  />
                ))}
              </Card>
            )}
          </div>
        </Work>

        <Rail>
          <WeakRail />
          <ConfidenceRail />
          <TutorBudgetRail />
        </Rail>
      </Split>
    </Page>
  );
}
