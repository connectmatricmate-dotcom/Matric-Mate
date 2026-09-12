'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { RowsSkeleton } from '@/components/app/skeletons';
import { Btn } from '@/components/ui/controls';
import { Card, Empty, Icon, Item } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { useApp, useLang, useT } from '@/lib/store';

/**
 * Every conversation the student has ever had with the tutor.
 *
 * The tutor page shows the five most recent, which is right for a launchpad,
 * but a chat older than five was unreachable and these are not disposable. A
 * student works through a hard chapter with the tutor in September and wants
 * it back in March, the week before the paper.
 *
 * Read under the student's own row-level security, so a conversation started
 * on the phone is here and one started here is on the phone.
 */

type ThreadRow = { id: string; title: string; context_label: string | null; updated_at: string };

/** Paged, because `select()` stops at a thousand rows without saying so. */
const PAGE = 100;

export function AllChatsView() {
  const { state } = useApp();
  const t = useT();
  const { lang } = useLang();
  const [rows, setRows] = useState<ThreadRow[] | null>(null);
  /** A failed read is not an empty history. It used to show as "no chats". */
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const all: ThreadRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('chat_threads')
          .select('id,title,context_label,updated_at')
          .order('updated_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) {
          if (alive) setFailed(true);
          break;
        }
        const page = (data as ThreadRow[]) ?? [];
        all.push(...page);
        if (page.length < PAGE) break;
      }
      if (alive) setRows(all);
    })();
    return () => {
      alive = false;
    };
  }, [state.user?.id, attempt]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!rows) return [];
    if (!q) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(q) || (r.context_label ?? '').toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <Page width="focus">
      <PageHead back="/tutor" backLabel={t('tutor.title')} title={t('tutor.allChatsTitle')} sub={t('tutor.allChatsSub')} />

      {rows && rows.length > 6 ? (
        // field-shell draws the focus ring on the pill itself; without it the
        // global outline landed on the bare input, square, inside the round.
        <label className="field-shell mb-4 flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-line bg-card ps-4 pe-1.5 transition-[border-color,box-shadow] duration-200">
          <Icon name="search" size={17} className="shrink-0 text-ink3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tutor.searchChats')}
            aria-label={t('tutor.searchChats')}
            // 16px on a phone: under that, iOS zooms the page on focus and
            // leaves it zoomed.
            className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-ink outline-none placeholder:text-ink3 md:text-[14px]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('common.cancel')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink3 transition-colors duration-200 hover:bg-paper hover:text-ink"
            >
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </label>
      ) : null}

      {rows === null ? (
        <RowsSkeleton rows={3} />
      ) : failed && rows.length === 0 ? (
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
                setRows(null);
                setFailed(false);
                setAttempt((n) => n + 1);
              }}
            />
          }
        />
      ) : !hits.length ? (
        <Empty
          icon="spark"
          title={query ? t('tutor.noChatMatch') : t('tutor.noChatsTitle')}
          sub={query ? undefined : t('tutor.noChatsBody')}
        />
      ) : (
        <Card flat className="py-0">
          {/* Item's own link, which brings its hover and chevron. A Link
              around a static Item had neither. */}
          {hits.map((thread, i) => (
            <Item
              key={thread.id}
              href={`/tutor/chat?thread=${thread.id}`}
              title={thread.title}
              sub={[thread.context_label, formatDate(thread.updated_at, lang, { day: 'numeric', month: 'short' })].filter(Boolean).join(' · ')}
              icon="spark"
              last={i === hits.length - 1}
            />
          ))}
        </Card>
      )}
    </Page>
  );
}
