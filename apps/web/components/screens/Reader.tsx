'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { api, chapterName, isOneLanguageSubject, isUrduScript } from '@matricmate/core';
import type { Block, Chapter, ChapterContent, StringKey } from '@matricmate/core';
import { Btn, IconButton } from '@/components/ui/controls';
import { Card, Empty, Label, LinkBtn, Pill, ScriptText, Skeleton } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useTutorQuota } from '@/lib/use-tutor-quota';
import { useApp, useLang, useT } from '@/lib/store';
import { Page } from '@/components/app/Page';
import { SessionHeader } from '@/components/app/SessionHeader';
import { Markdown } from '@/components/ui/Markdown';
import { LockedNotice } from '@/components/app/LockedNotice';

/** A caller that already chose an alignment keeps it. */
const HAS_ALIGN = /(^|\s)text-(left|center|right|start|end|justify)(?=\s|$)/;

/**
 * Every run of notes text carries its own script's direction and language.
 *
 * Arabic-script text needs the Nastaliq face (Nunito has no Urdu glyphs) and
 * runs right to left. English needs saying too: inside an Urdu account the
 * page is right to left, and the English subject's notes, which are English
 * for every student, came out right-aligned with their full stops on the
 * wrong end of the line.
 */
function Prose({ text, size, className = '' }: { text: string; size: number; className?: string }) {
  if (isUrduScript(text)) {
    return (
      <p lang="ur" dir="rtl" className={`urdu text-ink ${className}`} style={{ fontSize: size }}>
        {text}
      </p>
    );
  }
  return (
    <p lang="en" dir="ltr" className={`text-ink ${HAS_ALIGN.test(className) ? '' : 'text-start'} ${className}`} style={{ fontSize: size, lineHeight: 1.72 }}>
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
        <h2 lang="en" dir="ltr" className="mt-4 mb-2 text-start font-display leading-[1.3] text-ink" style={{ fontSize: 21 * scale }}>
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
      /* The card takes the direction of what it holds, so the accent bar and
         the label sit where its lines start. Picking a physical left or right
         bar by script was right in one interface and backwards in the other. */
      const rtl = isUrduScript(b.text) || isUrduScript(b.term ?? '');
      return (
        <div dir={rtl ? 'rtl' : 'ltr'} className="mb-4">
          <Card flat tint="bg-tealtint" border="border-tealtint2" className="border-s-4 border-s-teal">
            <Label className="block text-start text-teal">{labels.definition}</Label>
            {b.term ? <Prose text={b.term} size={14 * scale} /> : null}
            <div className="mt-1">
              <Prose text={b.text} size={14.5 * scale} />
            </div>
          </Card>
        </div>
      );
    }
    case 'formula':
      return (
        <Card flat className="mb-4 text-center">
          {/* Always left to right, even in an Urdu account: a formula that
              starts with a digit reordered itself under RTL. And allowed to
              break, since a long one has no spaces to wrap at. */}
          <p dir="ltr" className="font-display tracking-[0.05em] text-ink wrap-anywhere" style={{ fontSize: 24 * scale }}>
            {b.text}
          </p>
          {b.caption ? (
            <div className="mt-1 text-ink2">
              <Prose text={b.caption} size={13 * scale} className="text-center" />
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
            // Each item carries its own direction, so the bullet sits where
            // its line starts. A reversed row only worked in the English
            // interface; in the Urdu one it put the dot on the far side.
            <li key={i} dir={isUrduScript(it) ? 'rtl' : 'ltr'} className="flex items-start gap-2.5">
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
        <div dir={isUrduScript(b.text) ? 'rtl' : 'ltr'} className="mb-4">
          <Card flat tint="bg-orangetint" border="border-orangetint">
            <Label className="block text-start text-orangedark">{labels.example}</Label>
            <div className="mt-1">
              <Prose text={b.text} size={14.5 * scale} />
            </div>
          </Card>
        </div>
      );
  }
}

const SUGGESTIONS: StringKey[] = ['reader.suggest1', 'reader.suggest2', 'reader.suggest3'];

export function Reader({
  chapter,
  content,
  paid,
  startSection = 0,
}: {
  chapter: Chapter;
  content: ChapterContent;
  /** Whether the account has a plan, from the server. */
  paid: boolean;
  startSection?: number;
}) {
  const { state, actions, derived } = useApp();
  const [quota] = useTutorQuota();
  const aiLeft = quota?.remaining ?? derived.aiLeft;
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const [rawIdx, setIdx] = useState(startSection);
  const [askOpen, setAskOpen] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; steps?: string[]; threadId?: string } | null>(null);
  const [asking, setAsking] = useState(false);
  /** The last question asked in the sheet, so "continue in chat" opens on it
   *  instead of an empty thread that forgets what was being discussed. */
  const [asked, setAsked] = useState<string | null>(null);
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

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
  /* Urdu and English are taught in their own language to every student, and
     Punjab's Islamiyat in Urdu, so their notes are never "waiting for an Urdu
     translation". The note used to tell every Urdu-medium student that about
     all 29 English chapters. */
  const oneLanguage = isOneLanguageSubject(id, chapter.board);
  /* Clamped against what the chapter actually has: a link can name a section
     that is not there, and the number came off a query string. */
  const idx = Math.min(rawIdx, Math.max(0, sections.length - 1));
  const section = sections[idx];
  const scale = [0.92, 1, 1.12][state.settings.fontScale];
  const total = sections.length || 1;

  function advance(dir: 1 | -1) {
    const next = idx + dir;
    if (next < 0 || next >= sections.length) return;
    // Only forward movement records progress, the same rule the Android reader
    // follows. Recording on the way back rewound the dashboard's "carry on
    // from" pointer to wherever the student happened to re-read.
    if (section && dir === 1) actions.markSectionRead(section.id, id, next);
    setIdx(next);
    window.scrollTo({ top: 0 });
  }

  async function ask(prompt: string) {
    setAsked(prompt);
    setAsking(true);
    setAnswer(null);
    /* The server enforces quota and plan; the answer says why if it can't.
       The chapter and the student ride along, as they do from the chat: the
       route grounds its answer in this chapter's notes and writes in the
       student's language only when told them, and this sent neither, so every
       answer here came back in English and from general memory. */
    const res = await api.askTutor(prompt, {
      context: chapter.title,
      chapterId: id,
      profile: {
        name: state.user?.name,
        medium: state.settings.contentMedium,
        language: state.settings.language,
        subjects: derived.subjects,
      },
    });
    setAsking(false);
    if (res.reason) {
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
    setAnswer({ text: res.text, steps: res.steps, threadId: res.threadId });
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
        label={`${chapterName(chapter, lang)} · ${t('reader.section', { a: idx + 1, b: total })}`}
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
        {/* No sections means one of three things, told apart. No plan is the
            plan wall: row level security serves nothing to an account
            without one (the layout turns those away on a fresh load; this
            covers a plan that ran out while the app was open). With a plan,
            counts that promise sections which did not arrive is a read worth
            retrying, and no sections at all is notes not written yet. This
            showed the Upgrade button to paying students in every case. */}
        {!content.sections.length ? (
          !paid ? (
            <LockedNotice body={t('billing.lockedBody')} cta={t('states.unlock')} />
          ) : chapter.sectionCount > 0 ? (
            <Card flat tint="bg-redtint" border="border-red">
              <p className="text-[13.5px] font-extrabold text-red">{t('states.errorTitle')}</p>
              <p className="mt-0.5 text-[13px] text-ink2">{t('states.errorBody')}</p>
              {/* A refresh, which asks the server for the notes again. */}
              <Btn
                title={t('common.retry')}
                variant="line"
                sm
                className="mt-3"
                loading={retrying}
                onClick={() => startRetry(() => router.refresh())}
              />
            </Card>
          ) : (
            <Empty
              icon="book"
              title={t('reader.noNotesTitle')}
              sub={t('reader.noNotesBody')}
              cta={<LinkBtn title={t('session.backToChapter')} href={`/learn/chapter/${id}`} variant="line" sm />}
            />
          )
        ) : section ? (
          <>
            {urduMedium && !sectionsAreUrdu && !oneLanguage ? (
              <Card flat tint="bg-tealtint" border="border-tealtint2" className="mb-4">
                <p className="text-[13px] text-ink2 rtl:leading-[1.9]">{t('reader.urduMediumNote')}</p>
              </Card>
            ) : null}
            {/* The section's own title, in whichever script it is written.
                Only Urdu titles used to render, so 427 English sections opened
                on a bare paragraph. Skipped when the notes open on the same
                words as a heading, which some do, rather than print it twice. */}
            {section.title && !(section.blocks[0]?.kind === 'h' && section.blocks[0].text.trim() === section.title.trim()) ? (
              isUrduScript(section.title) ? (
                <h2 lang="ur" dir="rtl" className="urdu mb-2 text-[19px] text-ink">
                  {section.title}
                </h2>
              ) : (
                <h2 lang="en" dir="ltr" className="mb-2 text-start font-display text-[20px] leading-[1.3] text-ink">
                  {section.title}
                </h2>
              )
            ) : null}
            {section.blocks.map((b, i) => (
              <BlockView key={i} b={b} scale={scale} labels={{ definition: t('reader.definition'), example: t('reader.example') }} />
            ))}
          </>
        ) : null}
      </article>

      {/* ask AI: in flow at the end of the reading, never floating over it */}
      {section ? (
        <div className="mt-5 flex justify-end">
          <Btn title={t('reader.askAi')} icon="spark" sm variant="line" onClick={() => setAskOpen(true)} />
        </div>
      ) : null}
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
          <Pill tone="teal">{chapterName(chapter, lang)}</Pill>
          <Pill tone={aiLeft ? 'grey' : 'red'}>{t('tutor.leftToday', { n: aiLeft })}</Pill>
        </div>

        <div className="flex flex-col gap-2">
          {/* Off while a question is out: a second tap used to send a second
              question and spend a second one of the day's allowance. */}
          {SUGGESTIONS.map((key) => (
            <button
              key={key}
              type="button"
              disabled={asking}
              onClick={() => ask(`${t(key)}: ${section?.title ?? ''}`)}
              className="w-full text-start disabled:cursor-not-allowed disabled:opacity-60"
            >
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
                <li key={i} dir={isUrduScript(step) ? 'rtl' : 'ltr'} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tealtint text-[11px] font-extrabold text-teal">
                    {i + 1}
                  </span>
                  <ScriptText text={step} className="min-w-0 flex-1 text-[14px] leading-[1.6] text-ink" urduClassName="min-w-0 flex-1 text-[14px] text-ink" />
                </li>
              ))}
            </ol>
            {/* To the conversation this answer was saved in. It passed the
                question on as `q`, which the chat sends by itself on arrival,
                so carrying on in the chat asked the same thing a second time:
                one more of the day's fifty spent, and a duplicate thread. */}
            <Link
              href={
                answer.threadId
                  ? `/tutor/chat?thread=${answer.threadId}&chapter=${id}`
                  : `/tutor/chat?chapter=${id}${asked ? `&draft=${encodeURIComponent(asked)}` : ''}`
              }
              className="mt-2 inline-flex min-h-11 items-center text-[13px] font-extrabold text-teal hover:underline"
            >
              {t('reader.openChat')}
            </Link>
          </Card>
        ) : null}
      </Sheet>
    </Page>
  );
}
