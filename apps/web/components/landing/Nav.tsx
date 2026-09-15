'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon, LinkBtn, Wordmark } from '@/components/ui';

// Three, not five. "For parents" and the FAQ are places you arrive at by
// scrolling, not destinations you go looking for, they stay in the footer.
// Absolute hrefs, so the same bar works on /pricing and /terms where an
// in-page anchor would go nowhere.
const LINKS = [
  { href: '/#inside', label: 'What’s inside' },
  { href: '/#papers', label: 'Past papers' },
  { href: '/pricing', label: 'Pricing' },
];

export function Nav({ bare = false }: { bare?: boolean } = {}) {
  const [open, setOpen] = useState(false);

  /*
   * Opened from the Android app (the terms and the account-deletion page):
   * the wordmark and nothing to go on to. Google Play treats an app that
   * leads to a page with pricing on it as leading to a purchase outside Play,
   * and every link here reaches the pricing page in a tap or two.
   */
  if (bare) {
    return (
      <header data-chrome className="border-b border-line bg-glass">
        <div className="mx-auto flex max-w-[1100px] items-center px-5 py-3.5">
          <Wordmark priority />
        </div>
      </header>
    );
  }

  return (
    // data-chrome keeps the bar off paper: see the print rules in globals.css.
    <header data-chrome className="sticky top-0 z-50 border-b border-line bg-glass backdrop-blur">
      {/* Three tracks, so the links are centred on the page rather than pushed
          along by whatever the logo and the buttons happen to measure. */}
      <nav className="mx-auto flex max-w-[1100px] items-center justify-between gap-6 px-5 py-3.5 md:grid md:grid-cols-[1fr_auto_1fr]">
        {/* The Wordmark primitive, not the bare image: the teal half of the
            artwork disappears on the dark theme's glass without its plate. */}
        <Link href="/" className="inline-flex min-h-11 shrink-0 items-center justify-self-start" aria-label="MatricMate home">
          <Wordmark priority />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="inline-flex min-h-11 items-center text-[14.5px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 justify-self-end md:flex">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center text-[14.5px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
          >
            Log in
          </Link>
          <LinkBtn title="Create account" href="/signup" sm />
        </div>

        {/* -me-2 keeps the glyph on the bar's end edge while the box stays 44px. */}
        <button
          type="button"
          className="-me-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[14px] text-ink transition-colors duration-200 hover:bg-grey md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Menu"
        >
          <Icon name={open ? 'close' : 'menu'} size={24} />
        </button>
      </nav>

      {open ? (
        <div className="border-t border-line bg-card px-5 py-3 md:hidden">
          {/* Full-width rows, 44px tall: this is the only way round the site on
              a phone, and bare text links left a finger a 24px target. The
              negative margin keeps the words aligned with the bar above while
              the hover wash reaches past them. */}
          <ul className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="-mx-2 flex min-h-11 items-center rounded-[12px] px-2 text-[16px] font-extrabold text-ink transition-colors duration-200 hover:bg-grey"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <LinkBtn title="Log in" href="/login" variant="line" sm className="flex-1" />
            <LinkBtn title="Create account" href="/signup" sm className="flex-1" />
          </div>
        </div>
      ) : null}
    </header>
  );
}
