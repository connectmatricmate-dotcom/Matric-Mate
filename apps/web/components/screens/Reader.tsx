'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@matricmate/core';
import type { Block, Chapter, ChapterContent, StringKey } from '@matricmate/core';
import { Btn, IconButton } from '@/components/ui/controls';
import { Bar, Card, Icon, Label, Pill, Skeleton } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';
import { Page } from '@/components/app/Page';

/** Arabic-script text needs the Nastaliq face; Nunito has no Urdu glyphs. */
const isUrduText = (s: string) => /[؀-ۿ]/.test(s);

function Prose({ text, size, className = '' }: { text: string; size: number; className?: string }) {
  if (isUrduText(text)) {
    return (
      <p lang="ur" dir="rtl" className={`urdu text-ink ${className}`} style={{ fontSize: size }}>
        {text}
      </p>
    );
  }
  return (
    <p className={`text-ink ${className}`} style={{ fontSize: size, lineHeight: 1.72 }}>
      {text}
    </p>
  );
}

/** One content block → its typographic treatment. */
function BlockView({ b, scale, labels }: { b: Block; scale: number; labels: { definition: string; example: string } }) {
  switch (b.kind) {
    case 'h':
      return isUrduText(b.text) ? (
        <h2 lang="ur" dir="rtl" className="urdu mt-4 mb-2 text-ink" style={{ fontSize: 20 * scale }}>
          {b.text}
        </h2>
      ) : (
        <h2 className="mt-4 mb-2 font-display text-ink" style={{ fontSize: 21 * scale }}>
          {b.text}
        </h2>
      );
    case 'p':
      return (
        <div className="mb-4">
          <Prose text={b.text} size={15.5 * scale} />
        </div>
      );
    case 'def':
      return (
        <Card flat tint="bg-tealtint" border="border-tealtint2" className="mb-4 border-l-4 border-l-teal">
          <Label className="text-teal">
            {labels.definition} · {b.term}
          </Label>
          <div className="mt-1">
            <Prose text={b.text} size={14.5 * scale} />
          </div>
        </Card>
      );
    case 'formula':
      return (
        <Card flat className="mb-4 text-center">
          <p className="font-display tracking-[0.05em] text-ink" style={{ fontSize: 24 * scale }}>
            {b.text}
          </p>
          {b.caption ? <p className="mt-1 text-[13px] text-ink2">{b.caption}</p> : null}
        </Card>
      );
    case 'ur':
      return (
        <p lang="ur" dir="rtl" className="urdu mb-4 text-ink2" style={{ fontSize: 16 * scale }}>
          {b.text}
        </p>
      );
    case 'list':
      return (
        <ul className="mb-4 flex flex-col gap-2">
          {b.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
              <span className="min-w-0 flex-1">
                <Prose text={it} size={14.5 * scale} />
              </span>
            </li>
          ))}
        </ul>
      );
    case 'example':
      return (
        <Card flat tint="bg-orangetint" border="border-orangetint" className="mb-4">
          <Label className="text-orangedark">{labels.example}</Label>
          <div className="mt-1">
            <Prose text={b.text} size={14.5 * scale} />
          </div>
        </Card>
      );
  }
}

const SUGGESTIONS: StringKey[] = ['reader.suggest1', 'reader.suggest2', 'reader.suggest3'];

export function Reader({ chapter, content }: { chapter: Chapter; content: ChapterContent }) {
  const { state, actions, derived } = useApp();
  const t = useT();
  const toast = useToast();
  const [idx, setIdx] = useState(0);
  const [askOpen, setAskOpen] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; steps: string[] } | null>(null);
  const [asking, setAsking] = useState(false);

  const id = chapter.id;
  // Urdu-medium students get the Urdu sections where the client has supplied them.
  const urduMedium = state.settings.contentMedium === 'ur';
  const sections = (urduMedium && content.sectionsUr) || content.sections;
  const section = sections[idx];
  const scale = [0.92, 1, 1.12][state.settings.fontScale];
  const total = sections.length || 1;

  function advance(dir: 1 | -1) {
    const next = idx + dir;
    if (next < 0 || next >= sections.length) return;
    if (section) actions.markSectionRead(section.id, id, next);
    setIdx(next);
    window.scrollTo({ top: 0 });
  }

  async function ask(prompt: string) {
    if (!derived.aiLeft) {
      toast(t('tutor.limitToast'));
      return;
    }
    if (!actions.consumeAi()) return;
    setAsking(true);
    setAnswer(null);
    setAnswer(await api.askTutor(prompt, chapter.title));
    setAsking(false);
  }

  return (
    <Page width="read">
      {/* reading chrome */}
      <div className="sticky top-[57px] z-20 -mx-4 mb-4 flex items-center gap-2 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur md:-mx-7 md:px-7">
        <Link
          href={`/learn/chapter/${id}`}
          aria-label={t('session.backToChapter')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-line bg-card text-ink hover:bg-paper"
        >
          <Icon name="back" size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-extrabold text-ink">{chapter.title}</p>
          <div className="mt-1.5">
            <Bar pct={((idx + 1) / total) * 100} tone="teal" h={4} />
          </div>
        </div>
        <button
          type="button"
          aria-label={t('reader.textSize', { size: t('reader.medium') })}
          onClick={() => {
            const next = ((state.settings.fontScale + 1) % 3) as 0 | 1 | 2;
            actions.setSettings({ fontScale: next });
            toast(t('reader.textSize', { size: [t('reader.small'), t('reader.medium'), t('reader.large')][next] }));
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center font-display text-[18px] text-teal hover:bg-tealtint"
        >
          Aa
        </button>
      </div>

      <article className="mx-auto max-w-[720px]">
        {section ? (
          <>
            <Label>{t('reader.section', { a: idx + 1, b: total })}</Label>
            <div className="h-2" />
            {urduMedium && !content.sectionsUr ? (
              <Card flat tint="bg-tealtint" border="border-tealtint2" className="mb-4">
                <p className="text-[13px] text-ink2">{t('reader.urduMediumNote')}</p>
              </Card>
            ) : null}
            {urduMedium && content.sectionsUr ? (
              <h2 lang="ur" dir="rtl" className="urdu mb-2 text-[19px] text-ink">
                {section.title}
              </h2>
            ) : null}
            {section.blocks.map((b, i) => (
              <BlockView key={i} b={b} scale={scale} labels={{ definition: t('reader.definition'), example: t('reader.example') }} />
            ))}
          </>
        ) : null}
      </article>

      {/* pager */}
      <div className="sticky bottom-0 mt-6 -mx-4 flex items-center gap-3 border-t border-line bg-card px-4 py-3 md:-mx-7 md:px-7">
        <IconButton icon="back" label={t('common.back')} onClick={() => advance(-1)} tone={idx === 0 ? 'plain' : 'card'} />
        <p className="flex-1 text-center text-[13px] font-extrabold text-ink2">{t('reader.section', { a: idx + 1, b: total })}</p>
        {idx + 1 >= total ? (
          <Btn
            title={t('reader.finish')}
            sm
            onClick={() => {
              if (section) actions.markSectionRead(section.id, id, idx);
              toast(t('reader.progressSaved'));
            }}
          />
        ) : (
          <IconButton icon="chevron" label={t('common.next')} tone="active" onClick={() => advance(1)} />
        )}
      </div>

      {/* ask AI */}
      <div className="pointer-events-none sticky bottom-[76px] z-10 flex justify-end">
        <span className="pointer-events-auto">
          <Btn title={t('reader.askAi')} icon="spark" sm onClick={() => setAskOpen(true)} className="rounded-full shadow-lg" />
        </span>
      </div>

      <Sheet open={askOpen} onClose={() => setAskOpen(false)} title={t('reader.askAiTitle')}>
        <div className="mb-4 flex flex-wrap gap-2">
          <Pill tone="teal">{chapter.title}</Pill>
          <Pill tone={derived.aiLeft ? 'grey' : 'red'}>{t('tutor.leftToday', { n: derived.aiLeft })}</Pill>
        </div>

        <div className="flex flex-col gap-2">
          {SUGGESTIONS.map((key) => (
            <button key={key} type="button" onClick={() => ask(`${t(key)}: ${section?.title ?? ''}`)} className="text-left">
              <Card flat className="py-3.5 transition-colors duration-200 hover:border-teal">
                <span className="text-[14.5px] text-ink">{t(key)}</span>
              </Card>
            </button>
          ))}
        </div>

        {asking ? (
          <Card flat className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-3.5 w-[70%]" />
            <Skeleton className="h-3.5 w-[90%]" />
            <Skeleton className="h-3.5 w-[60%]" />
          </Card>
        ) : answer ? (
          <Card flat className="mt-4">
            <p className="text-[14.5px] font-extrabold text-ink">{answer.text}</p>
            <ol className="mt-2 flex flex-col gap-2">
              {answer.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tealtint text-[11px] font-extrabold text-teal">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[14px] leading-[1.6] text-ink">{step}</span>
                </li>
              ))}
            </ol>
            <Link
              href={`/tutor/chat?chapter=${id}`}
              className="mt-4 inline-block text-[13px] font-extrabold text-teal hover:underline"
            >
              {t('reader.openChat')}
            </Link>
          </Card>
        ) : null}
      </Sheet>
    </Page>
  );
}
