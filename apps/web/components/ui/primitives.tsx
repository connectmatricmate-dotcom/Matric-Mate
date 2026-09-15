/**
 * Server-safe primitives, no hooks, no event handlers, no 'use client'.
 *
 * Anything a page can render without interactivity lives here, so a page that
 * imports Card or Icon does not drag the whole UI kit into the client bundle.
 * Interactive versions live in ./controls.
 *
 * These mirror apps/mobile/src/components/ui.tsx by name and behaviour.
 */
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';
import { IconName, isUrduScript } from '@matricmate/core';
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

/** Glyphs that mean "forward" or "back" and must flip with the reading order. */
const DIRECTIONAL = new Set<IconName>(['chevron', 'back', 'arrowRight']);

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
      /**
       * An arrow is a direction, not a decoration. In a right-to-left page a
       * chevron pointing right points back the way the student came, so the
       * directional glyphs are mirrored by one CSS rule keyed on this marker
       * rather than by a conditional at each of the dozen call sites.
       */
      data-dir={DIRECTIONAL.has(name) ? '' : undefined}
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

/** A caller that already chose an alignment keeps it. */
const HAS_ALIGN = /(^|\s)text-(left|center|right|start|end|justify)(?=\s|$)/;

/**
 * Content text that follows its own script. Urdu-medium questions, options
 * and answers arrive as Urdu strings; rendered in the Latin faces they
 * degrade into broken glyph soup. Mirrors the Android ScriptText.
 *
 * English gets its own direction too. Inside an Urdu account the page is
 * right to left, and an English sentence laid out in it ends with its full
 * stop on the wrong side.
 */
export function ScriptText({
  text,
  className = '',
  urduClassName,
}: {
  text: string;
  className?: string;
  /** Classes for the Urdu case; defaults to className. Font family and
   *  leading come from the .urdu class itself. */
  urduClassName?: string;
}) {
  return isUrduScript(text) ? (
    <Ur block className={urduClassName ?? className}>
      {text}
    </Ur>
  ) : (
    <span dir="ltr" className={`block ${HAS_ALIGN.test(className) ? '' : 'text-start'} ${className}`}>
      {text}
    </span>
  );
}

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
  /* `block` has to mean a block. `.urdu` sets the face, the leading and the
     alignment but not the display, so this was an inline span: every row with
     an Urdu title and an Urdu sub-line set the two side by side instead of one
     under the other (the notification inbox, the settings rows), and the
     dashboard's chapter title ran on after its "Continue learning" label. The
     English half of each of those is already a block. */
  return (
    <span lang="ur" dir="rtl" className={`${block ? 'urdu block' : 'urdu-inline'} ${className}`}>
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
      {/* Section headings are often a subject name, which is Urdu for an Urdu
          student. Detected here rather than at every call site, the same way
          Item and Pill already do it. */}
      <h2 className="font-display text-[17px] text-ink">
        {typeof children === 'string' && isUrduScript(children) ? <Ur>{children}</Ur> : children}
      </h2>
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
        flat ? '' : 'shadow-[0_5px_14px_var(--shadow-soft)]',
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
      {/* Pills carry topics and chapter names, not only fixed labels, so a
          string truncates rather than widening the row. Urdu is set at line
          height 1 and Nastaliq ink reaches well outside that box, so its
          clip box is grown by padding and given back by an equal negative
          margin: the dots stay visible and the pill keeps its height. */}
      {typeof children === 'string' ? (
        isUrduScript(children) ? (
          <Ur className="-my-[0.75em] min-w-0 truncate py-[0.75em]">{children}</Ur>
        ) : (
          <span className="min-w-0 truncate">{children}</span>
        )
      ) : (
        children
      )}
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

/**
 * A button-styled link to somewhere outside the app: FBISE's own site, for a
 * past paper or a topper script. Always a new tab, so a student never loses
 * their place in the app, and always `rel="noopener noreferrer"` since the
 * destination is a third party. Server-safe, same disabled treatment as LinkBtn.
 */
export function ExternalLinkBtn({
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
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant, sm, lg, className })}>
      {icon ? <Icon name={icon} size={sm ? 16 : 18} /> : null}
      {title}
    </a>
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
        on ? 'bg-teal text-onbrand' : 'border-2 border-mute',
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
  fill,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  /** Paints the ring's whole interior, tucked 1px under the stroke so no
   *  rounding can open a hairline gap (mirrors the Android Ring). */
  fill?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute -rotate-90" aria-hidden>
        {fill ? <circle cx={size / 2} cy={size / 2} r={r - stroke / 2 + 1} fill={fill} /> : null}
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
      {/* leading-none is a Latin setting; Nastaliq needs its own room. */}
      <span className="relative flex flex-col items-center leading-none rtl:leading-normal">{children}</span>
    </div>
  );
}

/** A figure, which keeps the Latin face and order inside an Urdu account. */
const NUMERIC = /^[\d\s.,:%/+×-]+$/;

export function Kpi({ value, label }: { value: string; label: string }) {
  /* Same rule as the Android tile: tiles that share a row share a height.
     A figure sits in `.latin` and needs no extra leading; anything else in an
     Urdu account is Nastaliq, which leading-tight clips under truncate. */
  const numeric = NUMERIC.test(value);
  return (
    <div className="flex h-full min-h-[74px] flex-col justify-center rounded-[16px] border border-line bg-card px-4 py-3">
      <div className={`truncate font-display text-[22px] leading-tight tabular-nums text-ink ${numeric ? '' : 'rtl:leading-[1.9]'}`}>
        {numeric ? <span className="latin">{value}</span> : value}
      </div>
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
        {/* Rows carry content, not just labels: weak topics, chat titles, AI
            set names and chapter names all land here and any of them can be
            Urdu. The script decides the face, so a caller cannot forget to
            say so. `urduTitle` stays as an override for a known Urdu title. */}
        {urduTitle || (typeof title === 'string' && isUrduScript(title)) ? (
          <Ur block>{title}</Ur>
        ) : (
          <span dir="ltr" className="block text-[14.5px] font-extrabold text-ink wrap-anywhere">
            {title}
          </span>
        )}
        {sub ? (
          typeof sub === 'string' && isUrduScript(sub) ? (
            <Ur block className="mt-0.5 text-[13px] text-ink2">{sub}</Ur>
          ) : (
            <span dir="ltr" className="mt-0.5 block text-[13px] text-ink2 wrap-anywhere">
              {sub}
            </span>
          )
        ) : null}
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

/**
 * A placeholder shaped like the thing that is coming.
 *
 * `tone` tints the bar with the colour of the text it stands in for, rather
 * than the neutral track. It matters on a tinted card: a grey bar on the
 * coach card's teal wash reads as a foreign object, where a faint ink bar
 * reads as the sentence arriving. Low alpha on purpose, so it suggests text
 * without looking like a redaction. They are their own tokens, not `bg-ink/15`:
 * Tailwind resolves an opacity modifier on a theme colour at build time and
 * bakes in the light value, which then stays dark navy on a dark card.
 *
 * The default stays neutral, which is right for the many skeletons standing in
 * for something other than a line of prose.
 */
export function Skeleton({
  className = 'h-4 w-full',
  tone = 'default',
}: {
  className?: string;
  tone?: 'default' | 'ink' | 'ink2';
}) {
  const fill = tone === 'ink' ? 'bg-inkghost' : tone === 'ink2' ? 'bg-ink2ghost' : 'bg-track';
  return <div className={`animate-pulse rounded-[12px] ${fill} ${className}`} />;
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
      {/* h2: an empty state sits straight under the page title, and an h3
          there skipped a level for anyone reading by headings. */}
      <h2 className="mt-2.5 font-display text-[17px] text-ink">{title}</h2>
      {sub ? <p className="mt-1 max-w-sm text-[13px] text-ink2">{sub}</p> : null}
      {cta ? <div className="mt-3">{cta}</div> : null}
    </Card>
  );
}

/**
 * The wordmark, on a ground it can be read on.
 *
 * The artwork is two-tone, a mid-dark teal and an orange, and the teal half
 * sits at roughly 2.4:1 on the dark theme's card: half the logo disappears
 * from the nav, the onboarding header and the top of the report card.
 * Recolouring it was tried and rejected by the client (handoff, section 6), so
 * it keeps a light plate of its own instead, on the dark theme only. On paper
 * the plate is transparent, so the mark sits on whatever is behind it (the
 * glass header included), and its padding stays so no layout moves.
 */
const WORDMARK_W = 629;
const WORDMARK_H = 111;

export function Wordmark({
  width = 136,
  priority,
  className = '',
}: {
  width?: number;
  /** Ignored: the height follows the artwork. Kept so existing callers compile. */
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  const height = Math.round((width * WORDMARK_H) / WORDMARK_W);
  return (
    <span className={`inline-flex rounded-[10px] bg-brandplate p-1 ${className}`}>
      {/* The height follows the artwork (629 by 111), whatever a caller asks
          for, and it is pinned in the style rather than left to `auto`. With
          `auto` the box took its height from whichever resized copy the
          optimiser served, whose own height is rounded: 104 wide came out 19
          tall against an attribute of 18, and Next warned about it on every
          page with the phone header. */}
      <Image
        src="/brand/wordmark.png"
        alt="MatricMate"
        width={width}
        height={height}
        priority={priority}
        style={{ width, height }}
      />
    </span>
  );
}
