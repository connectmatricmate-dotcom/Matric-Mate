/**
 * Class recipes shared by the server-rendered and client-rendered variants of a
 * control, so a link-button and a button-button can never drift apart.
 *
 * No 'use client' here on purpose — this file must stay importable from Server
 * Components.
 */

export type BtnVariant = 'primary' | 'orange' | 'ghost' | 'line' | 'green' | 'danger' | 'whatsapp';
export type Tone = 'teal' | 'orange' | 'green' | 'red' | 'grey';

const VARIANTS: Record<BtnVariant, string> = {
  primary: 'bg-teal text-white hover:bg-tealdark',
  orange: 'bg-orange text-white hover:bg-orangedark',
  green: 'bg-green text-white hover:brightness-95',
  danger: 'bg-red text-white hover:brightness-95',
  whatsapp: 'bg-whatsapp text-white hover:brightness-95',
  ghost: 'bg-transparent text-teal hover:bg-tealtint',
  line: 'bg-card text-teal border-[1.5px] border-tealtint2 hover:border-teal',
};

export function buttonClasses({
  variant = 'primary',
  sm,
  lg,
  disabled,
  className = '',
}: {
  variant?: BtnVariant;
  sm?: boolean;
  lg?: boolean;
  disabled?: boolean;
  className?: string;
} = {}) {
  return [
    // 44px minimum touch target, press cue, ~200ms ease-out — see the motion rule
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-[16px] font-display',
    'transition-[background-color,border-color,transform] duration-200 ease-out active:scale-[0.98]',
    sm ? 'px-4 py-2.5 text-[14px]' : lg ? 'px-7 py-4 text-[17px]' : 'px-5 py-3.5 text-[16px]',
    VARIANTS[variant],
    disabled ? 'pointer-events-none cursor-not-allowed opacity-45' : 'cursor-pointer',
    className,
  ].join(' ');
}

const TONES: Record<Tone, string> = {
  teal: 'bg-tealtint text-teal',
  orange: 'bg-orangetint text-orangedark',
  green: 'bg-greentint text-green',
  red: 'bg-redtint text-red',
  grey: 'bg-grey text-ink2',
};

export function pillClasses(tone: Tone = 'teal', interactive = false, className = '') {
  return [
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-extrabold',
    TONES[tone],
    interactive ? 'cursor-pointer transition-colors duration-200 hover:brightness-95' : '',
    className,
  ].join(' ');
}

export function itemClasses(interactive: boolean, last?: boolean) {
  return [
    'flex w-full items-center gap-3 py-3.5 text-left',
    last ? '' : 'border-b border-line',
    interactive ? 'cursor-pointer transition-colors duration-200 hover:bg-paper' : '',
  ].join(' ');
}
