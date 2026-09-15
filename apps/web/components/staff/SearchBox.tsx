'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/ui/primitives';

/**
 * Find somebody in a long staff list: type part of a name, an email, a mobile
 * number or a school, press Search. A plain GET form, so the search is in the
 * address (the back button and a refresh keep it) and the list is filtered on
 * the server. Controlled, so a search that found nobody still shows what was
 * typed; Clear appears once there is a search to clear.
 */
export function SearchBox({ action, initial, placeholder }: { action: string; initial: string; placeholder: string }) {
  const [q, setQ] = useState(initial);
  return (
    <form action={action} role="search" className="flex flex-wrap items-center gap-2">
      <label className="min-w-0 flex-1 basis-[220px]">
        <span className="sr-only">Search</span>
        <span className="field-shell flex items-center gap-2 rounded-[14px] border-[1.5px] border-line bg-card px-3.5 py-2.5 transition-[border-color,box-shadow] duration-200">
          <Icon name="search" size={17} className="shrink-0 text-ink3" />
          <input
            name="q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            // 16px on a phone, where iOS Safari zooms into anything smaller.
            className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3 md:text-[14px]"
          />
        </span>
      </label>
      <button
        type="submit"
        disabled={!q.trim() && !initial}
        className="inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full bg-teal px-5 text-[13px] font-extrabold text-onbrand transition-[filter] duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Search
      </button>
      {initial ? (
        <Link
          href={action}
          className="inline-flex h-11 shrink-0 items-center rounded-full border border-line bg-card px-4 text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:border-teal hover:text-teal"
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}
