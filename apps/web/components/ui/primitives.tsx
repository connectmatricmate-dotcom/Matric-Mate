/**
 * Server-safe primitives, no hooks, no event handlers, no 'use client'.
 *
 * Anything a page can render without interactivity lives here, so a page that
 * imports Card or Icon does not drag the whole UI kit into the client bundle.
 * Interactive versions live in ./controls.
 *
 * These mirror apps/mobile/src/components/ui.tsx by name and behaviour.
 */
import Link from 'next/link';
import React from 'react';
import { IconName } from '@matricmate/core';
import {
  AlertTriangle,
  ArrowRight,
  Atom,
  Award,
  Bell,
  BookOpen,
  BookText,
  Calculator,
  Calendar,
  Camera,
  Check as CheckGlyph,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  Dna,
  Download,
  Eye,
  EyeOff,
  Feather,
  FileText,
  Flame,
  FlaskConical,
  Globe,
  GraduationCap,
  Headphones,
  HelpCircle,
  House,
  Inbox,
  KeyRound,
  Landmark,
  Languages,
  Layers,
  Leaf,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Mic,
  Monitor,
  Moon,
  MoonStar,
  MoreHorizontal,
  PartyPopper,
  Pause,
  Pencil,
  Phone,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  User,
  WalletCards,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { LinkBtnIcon, NavChevron } from './link-status';
import { Tone, buttonClasses, itemClasses, pillClasses } from './styles';
import type { BtnVariant } from './styles';

/* ------------------------------------------------------------------ icon */

export function Icon({
  name,
  size = 20,
  className = '',
  strokeWidth = 1.9,
  label,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  /** Accessible name for an icon that stands alone. Without it the icon is
   * decoration and hidden from screen readers, which is the right default. */
  label?: string;
}) {
  const Glyph = GLYPHS[name];
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  );
}

/** Same contract as the Android app: a missing mapping is a compile error. */
const GLYPHS: Record<IconName, LucideIcon> = {
  home: House,
  book: BookOpen,
  book2: BookText,
  target: Target,
  spark: Sparkles,
  chart: TrendingUp,
  user: User,
  bell: Bell,
  flame: Flame,
  back: ChevronLeft,
  chevron: ChevronRight,
  close: X,
  play: Play,
  pause: Pause,
  download: Download,
  check: CheckGlyph,
  lock: Lock,
  search: Search,
  camera: Camera,
  mic: Mic,
  send: Send,
  doc: FileText,
  clock: Clock,
  gear: Settings,
  card: CreditCard,
  share: Share2,
  trash: Trash2,
  plus: Plus,
  dots: MoreHorizontal,
  eye: Eye,
  eyeOff: EyeOff,
  wifiOff: WifiOff,
  refresh: RefreshCw,
  edit: Pencil,
  logout: LogOut,
  help: HelpCircle,
  headphones: Headphones,
  cards: WalletCards,
  mail: Mail,
  phone: Phone,
  calendar: Calendar,
  key: KeyRound,
  award: Award,
  layers: Layers,
  arrowRight: ArrowRight,
  quill: Feather,
  flask: FlaskConical,
  calc: Calculator,
  leaf: Leaf,
  globe: Globe,
  moon: Moon,
  bolt: Zap,
  star: Star,
  whatsapp: MessageCircle,
  alert: AlertTriangle,
  crown: Crown,
  thumbsUp: ThumbsUp,
  thumbsDown: ThumbsDown,
  menu: Menu,
  inbox: Inbox,
  receipt: Receipt,
  gradCap: GraduationCap,
  party: PartyPopper,
  phy: Atom,
  chem: FlaskConical,
  bio: Dna,
  math: Calculator,
  eng: Languages,
  urd: Feather,
  isl: MoonStar,
  pst: Landmark,
  cs: Monitor,
};

/* ------------------------------------------------------------------ text */

/**
 * Urdu text. Inline by default, most Urdu in this app is a subject name or a
 * chapter title sitting next to English, and that needs Latin leading and an
 * optical baseline nudge. Pass `block` for actual Urdu prose, which wants the
 * generous Nastaliq leading and right alignment. See globals.css.
 */
export function Ur({
  children,
  className = '',
  block,
}: {
  children: React.ReactNode;
  className?: string;
  block?: boolean;
}) {
  return (
    <span lang="ur" dir="rtl" className={`${block ? 'urdu' : 'urdu-inline'} ${className}`}>
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

/**
 * A button-styled link. Server-safe; the only client part is the tiny icon
 * slot, which swaps to a spinner while the navigation is in flight.
 * `disabled` renders a non-focusable placeholder, because a Link dimmed with
 * pointer-events-none still activates from the keyboard.
 */
export function LinkBtn({
  title,
  href,
  variant = 'primary',
  icon,
  sm,
  lg,
  disabled,
  className = '',
}: {
  title: string;
  href: string;
  variant?: BtnVariant;
  icon?: IconName;
  sm?: boolean;
  lg?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  if (disabled) {
    return (
      <span aria-disabled className={buttonClasses({ variant, sm, lg, disabled: true, className })}>
        {icon ? <Icon name={icon} size={sm ? 16 : 18} /> : null}
        {title}
      </span>
    );
  }
  return (
    <Link href={href} className={buttonClasses({ variant, sm, lg, className })}>
      <LinkBtnIcon icon={icon} size={sm ? 16 : 18} />
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
        on ? 'bg-teal text-white' : 'border-2 border-mute',
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
    <div className="overflow-hidden rounded-full bg-track" style={{ height: h }}>
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
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-track)" strokeWidth={stroke} fill="none" />
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
  /* Same rule as the Android tile: tiles that share a row share a height. */
  return (
    <div className="flex h-full min-h-[74px] flex-col justify-center rounded-[16px] border border-line bg-card px-4 py-3">
      <div className="truncate font-display text-[22px] leading-tight tabular-nums text-ink">{value}</div>
      <div className="truncate text-[11.5px] font-extrabold text-ink2">{label}</div>
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
      {right ?? (interactive ? <NavChevron /> : null)}
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
  return <div className={`animate-pulse rounded-[12px] bg-track ${className}`} />;
}

/**
 * Empty states draw from the same icon family as everything else. The emoji
 * that used to sit here was the one place the design system endorsed a second
 * icon language.
 */
export function Empty({
  icon = 'inbox',
  title,
  sub,
  cta,
}: {
  icon?: IconName;
  title: string;
  sub?: string;
  cta?: React.ReactNode;
}) {
  return (
    <Card flat className="flex flex-col items-center py-7 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tealtint text-teal">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="mt-2.5 font-display text-[17px] text-ink">{title}</h3>
      {sub ? <p className="mt-1 max-w-sm text-[13px] text-ink2">{sub}</p> : null}
      {cta ? <div className="mt-3">{cta}</div> : null}
    </Card>
  );
}
