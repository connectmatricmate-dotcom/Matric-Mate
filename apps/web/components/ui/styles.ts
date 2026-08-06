/**
 * Class recipes shared by the server-rendered and client-rendered variants of a
 * control, so a link-button and a button-button can never drift apart.
 *
 * No 'use client' here on purpose, this file must stay importable from Server
 * Components.
 */

export type BtnVariant = 'primary' | 'orange' | 'ghost' | 'line' | 'green' | 'danger' | 'whatsapp';
export type Tone = 'teal' | 'orange' | 'green' | 'red' | 'grey';

const VARIANTS: Record<BtnVariant, string> = {
  primary: 'bg-teal text-white hover:bg-tealdark',
  // Ink on orange, not white: white sat at 2.3:1 and washed out in daylight.
  // Ink reads at 5:1 and both colours come straight from the logo.
  orange: 'bg-orange text-ink hover:brightness-95',
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
    // 44px minimum touch target, press cue, ~200ms ease-out, see the motion rule
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-[16px] font-display',
    // `filter` is in the list because half the variants hover via brightness.
    'transition-[background-color,border-color,transform,filter] duration-200 ease-out active:scale-[0.98]',
    sm ? 'px-4 py-2.5 text-[14px]' : lg ? 'px-7 py-4 text-[18px]' : 'px-5 py-3.5 text-[16px]',
    VARIANTS[variant],
    // No pointer-events-none: it suppresses the element's own cursor, so a
    // disabled control showed the parent's plain arrow instead of not-allowed.
    // Real buttons already ignore clicks via the disabled attribute.
    disabled ? 'cursor-not-allowed opacity-45 active:scale-100' : 'cursor-pointer',
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
    'inline-flex items-center gap-1.5 rounded-full font-extrabold',
    // A pill that is a BUTTON needs a finger-sized target; a pill that is a
    // status chip stays compact. Same look, different hit area.
    interactive
      ? 'min-h-10 cursor-pointer px-3.5 text-[13px] transition-colors duration-200 hover:brightness-95'
      : 'px-3 py-1 text-[12px]',
    TONES[tone],
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
