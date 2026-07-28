/**
 * Server-safe primitives — no hooks, no event handlers, no 'use client'.
 *
 * Anything a page can render without interactivity lives here, so a page that
 * imports Card or Icon does not drag the whole UI kit into the client bundle.
 * Interactive versions live in ./controls.
 *
 * These mirror apps/mobile/src/components/ui.tsx by name and behaviour.
 */
import Link from 'next/link';
import React from 'react';
import { ICON_PATHS, IconName } from '@matricmate/core';
import { Tone, buttonClasses, itemClasses, pillClasses } from './styles';
import type { BtnVariant } from './styles';

/* ------------------------------------------------------------------ icon */

export function Icon({
  name,
  size = 20,
  className = '',
  strokeWidth = 1.9,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden focusable="false">
      <path
        d={ICON_PATHS[name]}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ text */

export function Ur({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span lang="ur" dir="rtl" className={`urdu ${className}`}>
      {children}
    </span>
  );
}

export function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2 ${className}`}>{children}</span>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[17px] text-ink">{children}</h2>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------- surfaces */

export function Card({
  children,
  className = '',
  flat,
  tint,
  border,
  as: As = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  flat?: boolean;
  tint?: string;
  border?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <As
      className={[
        'rounded-[16px] border p-4',
        tint ?? 'bg-card',
        border ?? 'border-line',
        flat ? '' : 'shadow-[0_5px_14px_rgba(15,80,100,0.07)]',
        className,
      ].join(' ')}
    >
      {children}
    </As>
  );
}

/* ------------------------------------------------- non-interactive chrome */

export function Pill({
  children,
  tone = 'teal',
  icon,
  className = '',
}: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: IconName;
  className?: string;
}) {
  return (
    <span className={pillClasses(tone, false, className)}>
      {icon ? <Icon name={icon} size={12} strokeWidth={2.4} /> : null}
      {children}
    </span>
  );
}

/** A button-styled link. Server-safe, so marketing pages ship no JS for their CTAs. */
export function LinkBtn({
  title,
  href,
  variant = 'primary',
  icon,
  sm,
  lg,
  className = '',
}: {
  title: string;
  href: string;
  variant?: BtnVariant;
  icon?: IconName;
  sm?: boolean;
  lg?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClasses({ variant, sm, lg, className })}>
      {icon ? <Icon name={icon} size={sm ? 16 : 18} /> : null}
      {title}
    </Link>
  );
}

export function Check({ on, round, size = 26 }: { on: boolean; round?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={[
        'inline-flex shrink-0 items-center justify-center transition-colors duration-200',
        round ? 'rounded-full' : 'rounded-[9px]',
        on ? 'bg-teal text-white' : 'border-2 border-[#CBD8D3]',
      ].join(' ')}
    >
      {on ? <Icon name="check" size={size * 0.62} strokeWidth={3} /> : null}
    </span>
  );
}

/* ------------------------------------------------------------ indicators */

export function Bar({ pct, tone = 'orange', h = 7 }: { pct: number; tone?: 'orange' | 'teal' | 'green' | 'red'; h?: number }) {
  const bg = { orange: 'bg-orange', teal: 'bg-teal', green: 'bg-green', red: 'bg-red' }[tone];
  return (
    <div className="overflow-hidden rounded-full bg-[#EAF0EC]" style={{ height: h }}>
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Ring({
  pct,
  size = 54,
  stroke = 7,
  color = 'var(--color-teal)',
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EAF0EC" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.max(0, Math.min(100, pct)) / 100)}
        />
      </svg>
      <span className="relative flex flex-col items-center leading-none">{children}</span>
    </div>
  );
}

export function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-card px-4 py-3">
      <div className="font-display text-[22px] tabular-nums text-ink">{value}</div>
      <div className="text-[11.5px] font-extrabold text-ink2">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------- list rows */

const TONE_CHIP: Record<Tone, string> = {
  teal: 'bg-tealtint text-teal',
  orange: 'bg-orangetint text-orangedark',
  green: 'bg-greentint text-green',
  red: 'bg-redtint text-red',
  grey: 'bg-grey text-ink2',
};

export function ItemBody({
  title,
  sub,
  icon,
  emoji,
  tone = 'teal',
  right,
  pct,
  urduTitle,
  interactive,
}: {
  title: string;
  sub?: string;
  icon?: IconName;
  emoji?: string;
  tone?: Tone;
  right?: React.ReactNode;
  pct?: number;
  urduTitle?: boolean;
  interactive?: boolean;
}) {
  return (
    <>
      {emoji || icon ? (
        <span className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] ${TONE_CHIP[tone]}`}>
          {emoji ? <span className="text-[19px]">{emoji}</span> : <Icon name={icon!} size={20} />}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        {urduTitle ? <Ur>{title}</Ur> : <span className="block text-[14.5px] font-extrabold text-ink">{title}</span>}
        {sub ? <span className="mt-0.5 block text-[13px] text-ink2">{sub}</span> : null}
        {pct != null ? (
          <span className="mt-2 block">
            <Bar pct={pct} tone="teal" />
          </span>
        ) : null}
      </span>
      {right ?? (interactive ? <Icon name="chevron" size={18} className="text-ink3" /> : null)}
    </>
  );
}

/** Static or link row. For a row that runs a handler, use ItemButton from ./controls. */
export function Item(
  props: React.ComponentProps<typeof ItemBody> & { href?: string; last?: boolean }
) {
  const { href, last, ...body } = props;
  if (href) {
    return (
      <Link href={href} className={itemClasses(true, last)}>
        <ItemBody {...body} interactive />
      </Link>
    );
  }
  return (
    <div className={itemClasses(false, last)}>
      <ItemBody {...body} />
    </div>
  );
}

/* -------------------------------------------------------------- feedback */

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[12px] bg-[#EAF0EC] ${className}`} />;
}

export function Empty({
  emoji = '📭',
  title,
  sub,
  cta,
}: {
  emoji?: string;
  title: string;
  sub?: string;
  cta?: React.ReactNode;
}) {
  return (
    <Card flat className="flex flex-col items-center py-7 text-center">
      <span className="text-[34px]">{emoji}</span>
      <h3 className="mt-1.5 font-display text-[17px] text-ink">{title}</h3>
      {sub ? <p className="mt-1 max-w-sm text-[13px] text-ink2">{sub}</p> : null}
      {cta ? <div className="mt-3">{cta}</div> : null}
    </Card>
  );
}
