'use client';

/**
 * Web UI kit. Deliberately mirrors apps/mobile/src/components/ui.tsx — same
 * component names, same props, same visual result — so the two apps stay
 * recognisably one product without sharing renderer-specific code.
 */
import Link from 'next/link';
import React from 'react';
import { ICON_PATHS, IconName } from '@matricmate/core';

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
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
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

/* ---------------------------------------------------------------- text */

export function Ur({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span lang="ur" dir="rtl" className={`urdu ${className}`}>
      {children}
    </span>
  );
}

export function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2 ${className}`}>{children}</span>
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

/* -------------------------------------------------------------- controls */

type BtnVariant = 'primary' | 'orange' | 'ghost' | 'line' | 'green' | 'danger' | 'whatsapp';

const BTN_STYLES: Record<BtnVariant, string> = {
  primary: 'bg-teal text-white hover:bg-tealdark',
  orange: 'bg-orange text-white hover:bg-orangedark',
  green: 'bg-green text-white',
  danger: 'bg-red text-white',
  whatsapp: 'bg-whatsapp text-white',
  ghost: 'bg-transparent text-teal hover:bg-tealtint',
  line: 'bg-card text-teal border-[1.5px] border-tealtint2 hover:border-teal',
};

export function Btn({
  title,
  href,
  onClick,
  variant = 'primary',
  icon,
  sm,
  lg,
  disabled,
  loading,
  className = '',
  type = 'button',
}: {
  title: string;
  href?: string;
  onClick?: () => void;
  variant?: BtnVariant;
  icon?: IconName;
  sm?: boolean;
  lg?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const cls = [
    'inline-flex items-center justify-center gap-2 rounded-[16px] font-display transition-colors',
    sm ? 'px-4 py-2.5 text-[14px]' : lg ? 'px-7 py-4 text-[17px]' : 'px-5 py-3.5 text-[16px]',
    BTN_STYLES[variant],
    disabled || loading ? 'pointer-events-none opacity-45' : '',
    className,
  ].join(' ');

  const inner = (
    <>
      {icon ? <Icon name={icon} size={sm ? 16 : 18} /> : null}
      {loading ? '…' : title}
    </>
  );

  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={cls}>
      {inner}
    </button>
  );
}

type Tone = 'teal' | 'orange' | 'green' | 'red' | 'grey';
const PILL_STYLES: Record<Tone, string> = {
  teal: 'bg-tealtint text-teal',
  orange: 'bg-orangetint text-orangedark',
  green: 'bg-greentint text-green',
  red: 'bg-redtint text-red',
  grey: 'bg-grey text-ink2',
};

export function Pill({
  children,
  tone = 'teal',
  icon,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: IconName;
  onClick?: () => void;
  className?: string;
}) {
  const cls = `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-extrabold ${PILL_STYLES[tone]} ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {icon ? <Icon name={icon} size={12} strokeWidth={2.4} /> : null}
      {children}
    </button>
  ) : (
    <span className={cls}>
      {icon ? <Icon name={icon} size={12} strokeWidth={2.4} /> : null}
      {children}
    </span>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: string; urdu?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex gap-1 rounded-[13px] bg-grey p-1 ${className}`} role="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={[
              'flex-1 rounded-[10px] px-4 py-2 text-[13px] font-extrabold transition-colors',
              on ? 'bg-card text-teal shadow-sm' : 'text-ink2 hover:text-ink',
              o.urdu ? 'font-urdu leading-[2]' : '',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = 'text',
  error,
  hint,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: IconName;
  type?: 'text' | 'email' | 'password' | 'tel';
  error?: string;
  hint?: string;
  id?: string;
}) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-3">
      <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] font-extrabold text-ink2">
        {label}
      </label>
      <div
        className={`flex items-center gap-2 rounded-[14px] border-[1.5px] bg-card px-3.5 py-3 focus-within:border-teal ${
          error ? 'border-red' : 'border-line'
        }`}
      >
        {icon ? <Icon name={icon} size={18} className="text-ink3" /> : null}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink3"
        />
      </div>
      {error ? <p className="mt-1 text-[12px] font-bold text-red">{error}</p> : null}
      {hint && !error ? <p className="mt-1 text-[12px] text-ink2">{hint}</p> : null}
    </div>
  );
}

export function Check({ on, round, size = 26 }: { on: boolean; round?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={[
        'inline-flex shrink-0 items-center justify-center transition-colors',
        round ? 'rounded-full' : 'rounded-[9px]',
        on ? 'bg-teal text-white' : 'border-2 border-[#CBD8D3]',
      ].join(' ')}
    >
      {on ? <Icon name="check" size={size * 0.62} strokeWidth={3} /> : null}
    </span>
  );
}

export function Toggle({ on, onClick, label }: { on: boolean; onClick?: () => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-teal' : 'bg-[#D7E0DB]'}`}
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[23px]' : 'left-[3px]'}`}
      />
    </button>
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
      <svg width={size} height={size} className="absolute -rotate-90">
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
      <div className="font-display text-[22px] text-ink">{value}</div>
      <div className="text-[11.5px] font-extrabold text-ink2">{label}</div>
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mt-6 mb-2 flex items-baseline justify-between">
      <h2 className="font-display text-[17px] text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Item({
  title,
  sub,
  icon,
  emoji,
  tone = 'teal',
  right,
  href,
  onClick,
  pct,
  last,
  urduTitle,
}: {
  title: string;
  sub?: string;
  icon?: IconName;
  emoji?: string;
  tone?: Tone;
  right?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  pct?: number;
  last?: boolean;
  urduTitle?: boolean;
}) {
  const bg = { teal: 'bg-tealtint text-teal', orange: 'bg-orangetint text-orangedark', green: 'bg-greentint text-green', red: 'bg-redtint text-red', grey: 'bg-grey text-ink2' }[tone];
  const inner = (
    <>
      {emoji || icon ? (
        <span className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] ${bg}`}>
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
      {right ?? ((href || onClick) && <Icon name="chevron" size={18} className="text-ink3" />)}
    </>
  );

  const cls = `flex w-full items-center gap-3 py-3.5 text-left ${last ? '' : 'border-b border-line'} ${
    href || onClick ? 'hover:bg-paper' : ''
  }`;

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
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

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[12px] bg-[#EAF0EC] ${className}`} />;
}
