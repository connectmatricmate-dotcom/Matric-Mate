'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Empty, Icon, Item, Skeleton } from '@/components/ui/primitives';
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
        if (error) break;
        const page = (data as ThreadRow[]) ?? [];
        all.push(...page);
        if (page.length < PAGE) break;
      }
      if (alive) setRows(all);
    })();
    return () => {
      alive = false;
    };
  }, [state.user?.id]);

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
        <label className="mb-4 flex items-center gap-2 rounded-full border-[1.5px] border-line bg-card px-4 py-2.5">
          <Icon name="search" size={17} className="shrink-0 text-ink3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tutor.searchChats')}
            aria-label={t('tutor.searchChats')}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink3"
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label={t('common.cancel')} className="shrink-0 text-ink3">
              <Icon name="close" size={16} />
            </button>
          ) : null}
        </label>
      ) : null}

      {rows === null ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !hits.length ? (
        <Empty
          icon="spark"
          title={query ? t('tutor.noChatMatch') : t('tutor.noChatsTitle')}
          sub={query ? undefined : t('tutor.noChatsBody')}
        />
      ) : (
        <Card flat className="py-0">
          {hits.map((thread, i) => (
            <Link key={thread.id} href={`/tutor/chat?thread=${thread.id}`} className="block">
              <Item
                title={thread.title}
                sub={`${thread.context_label ?? ''} ${formatDate(thread.updated_at, lang, { day: 'numeric', month: 'short' })}`.trim()}
                icon="spark"
                last={i === hits.length - 1}
              />
            </Link>
          ))}
        </Card>
      )}
    </Page>
  );
}
