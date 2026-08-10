'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Icon, LinkBtn } from '@/components/ui';

// Three, not five. "For parents" and the FAQ are places you arrive at by
// scrolling, not destinations you go looking for, they stay in the footer.
// Absolute hrefs, so the same bar works on /pricing and /terms where an
// in-page anchor would go nowhere.
const LINKS = [
  { href: '/#inside', label: 'What’s inside' },
  { href: '/#papers', label: 'Past papers' },
  { href: '/pricing', label: 'Pricing' },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur">
      {/* Three tracks, so the links are centred on the page rather than pushed
          along by whatever the logo and the buttons happen to measure. */}
      <nav className="mx-auto flex max-w-[1100px] items-center justify-between gap-6 px-5 py-3.5 md:grid md:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="shrink-0 justify-self-start" aria-label="MatricMate home">
          <Image src="/brand/wordmark.png" alt="MatricMate" width={136} height={27} priority />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-[14.5px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 justify-self-end md:flex">
          <Link
            href="/login"
            className="text-[14.5px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
          >
            Log in
          </Link>
          <LinkBtn title="Create account" href="/signup" sm />
        </div>

        {/* -mr-2 keeps the glyph on the bar's right edge while the box stays 44px. */}
        <button
          type="button"
          className="-mr-2 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[14px] text-ink transition-colors duration-200 hover:bg-grey md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Menu"
        >
          <Icon name={open ? 'close' : 'menu'} size={24} />
        </button>
      </nav>

      {open ? (
        <div className="border-t border-line bg-card px-5 py-4 md:hidden">
          <ul className="flex flex-col gap-3">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="text-[16px] font-extrabold text-ink"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <LinkBtn title="Log in" href="/login" variant="line" sm className="flex-1" />
            <LinkBtn title="Create account" href="/signup" sm className="flex-1" />
          </div>
        </div>
      ) : null}
    </header>
  );
}
