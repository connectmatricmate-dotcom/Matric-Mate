'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, isUrduScript } from '@matricmate/core';
import type { Block, Chapter, ChapterContent, StringKey } from '@matricmate/core';
import { Btn, IconButton } from '@/components/ui/controls';
import { Card, Label, Pill, Skeleton } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useTutorQuota } from '@/lib/use-tutor-quota';
import { useApp, useT } from '@/lib/store';
import { Page } from '@/components/app/Page';
import { SessionHeader } from '@/components/app/SessionHeader';
import { Markdown } from '@/components/ui/Markdown';
import { LockedNotice } from '@/components/app/LockedNotice';

/** Arabic-script text needs the Nastaliq face; Nunito has no Urdu glyphs. */

function Prose({ text, size, className = '' }: { text: string; size: number; className?: string }) {
  if (isUrduScript(text)) {
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
      return isUrduScript(b.text) ? (
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
    case 'def': {
      // Urdu reads right to left, so the accent bar and the label move to
      // that side. A left bar beside right-aligned text reads as a mistake.
      const rtl = isUrduScript(b.text) || isUrduScript(b.term ?? '');
      return (
        <Card
          flat
          tint="bg-tealtint"
          border="border-tealtint2"
          className={`mb-4 ${rtl ? 'border-r-4 border-r-teal' : 'border-l-4 border-l-teal'}`}
        >
          <Label className={`text-teal ${rtl ? 'block text-right' : ''}`}>{labels.definition}</Label>
          {b.term ? <Prose text={b.term} size={14 * scale} /> : null}
          <div className="mt-1">
            <Prose text={b.text} size={14.5 * scale} />
          </div>
        </Card>
      );
    }
    case 'formula':
      return (
        <Card flat className="mb-4 text-center">
          <p className="font-display tracking-[0.05em] text-ink" style={{ fontSize: 24 * scale }}>
            {b.text}
          </p>
          {b.caption ? (
            <div className="mt-1 text-ink2">
              <Prose text={b.caption} size={13 * scale} />
            </div>
          ) : null}
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
            // An RTL line carries its bullet on the RIGHT; a left dot next to
            // right-aligned Urdu read as a layout mistake (client screenshot).
            <li key={i} className={`flex items-start gap-2.5 ${isUrduScript(it) ? 'flex-row-reverse' : ''}`}>
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
          <Label className={`text-orangedark ${isUrduScript(b.text) ? 'block text-right' : ''}`}>{labels.example}</Label>
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
  const [quota] = useTutorQuota();
  const aiLeft = quota?.remaining ?? derived.aiLeft;
  const t = useT();
  const toast = useToast();
  const [idx, setIdx] = useState(0);
  const [askOpen, setAskOpen] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; steps?: string[] } | null>(null);
  const [asking, setAsking] = useState(false);
  /** The last question asked in the sheet, so "continue in chat" opens on it
   *  instead of an empty thread that forgets what was being discussed. */
  const [asked, setAsked] = useState<string | null>(null);

  const id = chapter.id;
  // Urdu-medium students get the Urdu sections where the client has supplied them.
  const urduMedium = state.settings.contentMedium === 'ur';
  const sections = (urduMedium && content.sectionsUr) || content.sections;
  /**
   * Whether what we are about to render is actually Urdu.
   *
   * The note below used to fire on `!content.sectionsUr`, a field only the
   * bundled sample chapter carries. Real Urdu notes arrive in `sections`,
   * already filtered to the student's medium by the query, so the apology
   * showed on every translated chapter in the database.
   */
  const sectionsAreUrdu = sections.some((s) => isUrduScript(s.title));
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
    setAsked(prompt);
    setAsking(true);
    setAnswer(null);
    // The server enforces quota and plan; the answer says why if it can't.
    const res = await api.askTutor(prompt, { context: chapter.title });
    setAsking(false);
    if (res.reason) {
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
    setAnswer({ text: res.text, steps: res.steps });
    // Keep the local counter roughly in step with the server's.
    actions.consumeAi();
  }

  return (
    <Page width="read">
      {/* Same header as every other in-session screen: back, progress, one meta control. */}
      <SessionHeader
        backHref={`/learn/chapter/${id}`}
        backLabel={t('session.backToChapter')}
        pct={((idx + 1) / total) * 100}
        label={`${chapter.title} · ${t('reader.section', { a: idx + 1, b: total })}`}
        right={
          <button
            type="button"
            aria-label={t('account.readingSize')}
            onClick={() => {
              const next = ((state.settings.fontScale + 1) % 3) as 0 | 1 | 2;
              actions.setSettings({ fontScale: next });
              toast(t('reader.textSize', { size: [t('reader.small'), t('reader.medium'), t('reader.large')][next] }));
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] font-display text-[18px] text-teal transition-colors duration-200 hover:bg-tealtint"
          >
            Aa
          </button>
        }
      />

      {/* Same task frame as the practice screens: the notes read on paper of their own. */}
      <div className="mt-4 md:rounded-[22px] md:border md:border-line md:bg-card md:px-8 md:py-7 md:shadow-[0_5px_14px_var(--shadow-soft)]">
      <article>
        {/* No accessible sections means the plan wall, not an empty chapter:
            row level security serves nothing to an account without one. This
            rendered as a blank white page with a working Finish button, which
            is the worst way to tell somebody they need to subscribe. */}
        {!content.sections.length ? (
          <LockedNotice body={t('billing.lockedBody')} cta={t('states.unlock')} />
        ) : section ? (
          <>
            {urduMedium && !sectionsAreUrdu ? (
              <Card flat tint="bg-tealtint" border="border-tealtint2" className="mb-4">
                <p className="text-[13px] text-ink2">{t('reader.urduMediumNote')}</p>
              </Card>
            ) : null}
            {/* Gated on a bundled-sample field before, so a real Urdu chapter
                never showed its section heading. The title's own script is
                the honest test. */}
            {isUrduScript(section.title) ? (
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

      {/* ask AI: in flow at the end of the reading, never floating over it */}
      <div className="mt-5 flex justify-end">
        <Btn title={t('reader.askAi')} icon="spark" sm variant="line" onClick={() => setAskOpen(true)} />
      </div>
      </div>

      {/* pager. Hidden when there is nothing to page through, or it offers to
          save progress on a chapter the student cannot read. */}
      {content.sections.length ? (
      <div className="mt-4 flex items-center gap-3 rounded-[16px] border border-line bg-card px-4 py-3">
        <IconButton icon="back" label={t('common.back')} onClick={() => advance(-1)} disabled={idx === 0} tone="card" />
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
      ) : null}

      <Sheet open={askOpen} onClose={() => setAskOpen(false)} title={t('reader.askAiTitle')}>
        <div className="mb-4 flex flex-wrap gap-2">
          <Pill tone="teal">{chapter.title}</Pill>
          <Pill tone={aiLeft ? 'grey' : 'red'}>{t('tutor.leftToday', { n: aiLeft })}</Pill>
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
            <Markdown text={answer.text} className="text-[14.5px] leading-[1.65] text-ink" />
            <ol className="mt-2 flex flex-col gap-2">
              {answer.steps?.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tealtint text-[11px] font-extrabold text-teal">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-[14px] leading-[1.6] text-ink">{step}</span>
                </li>
              ))}
            </ol>
            <Link
              href={`/tutor/chat?chapter=${id}${asked ? `&q=${encodeURIComponent(asked)}` : ''}`}
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
