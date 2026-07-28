'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Icon, LinkBtn } from '@/components/ui';

const LINKS = [
  { href: '#inside', label: 'What’s inside' },
  { href: '#papers', label: 'Past papers' },
  { href: '#parents', label: 'For parents' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur">
      <nav className="mx-auto flex max-w-[1100px] items-center gap-6 px-5 py-3.5">
        <Link href="/" className="shrink-0" aria-label="MatricMate home">
          <Image src="/brand/wordmark.png" alt="MatricMate" width={148} height={29} priority />
        </Link>

        <ul className="ml-2 hidden flex-1 items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="text-[13.5px] font-extrabold text-ink2 transition-colors hover:text-teal">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          <Link href="/login" className="text-[13.5px] font-extrabold text-ink2 hover:text-teal">
            Log in
          </Link>
          <LinkBtn title="Start free" href="/signup" sm />
        </div>

        <button
          type="button"
          className="ml-auto md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Menu"
        >
          <Icon name={open ? 'close' : 'dots'} size={24} className="text-ink" />
        </button>
      </nav>

      {open ? (
        <div className="border-t border-line bg-card px-5 py-4 md:hidden">
          <ul className="flex flex-col gap-3">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="text-[15px] font-extrabold text-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <LinkBtn title="Log in" href="/login" variant="line" sm className="flex-1" />
            <LinkBtn title="Start free" href="/signup" sm className="flex-1" />
          </div>
        </div>
      ) : null}
    </header>
  );
}
