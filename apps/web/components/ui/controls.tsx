'use client';

/**
 * Interactive primitives, the only part of the UI kit that needs to run in the
 * browser. Kept in its own file so importing a Card doesn't ship a form control.
 */
import React, { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { IconName } from '@matricmate/core';
import { Icon, ItemBody, Ur } from './primitives';
import { BtnVariant, Tone, buttonClasses, itemClasses, pillClasses } from './styles';

export function Btn({
  title,
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
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, sm, lg, disabled: disabled || loading, className })}
    >
      {loading ? <Icon name="refresh" size={sm ? 16 : 18} className="animate-spin" /> : icon ? <Icon name={icon} size={sm ? 16 : 18} /> : null}
      {title}
    </button>
  );
}

/**
 * Submit button for server-action forms. `useFormStatus` must live in a child of
 * the form, which is exactly why this is its own component.
 */
export function SubmitButton({
  title,
  pendingTitle,
  variant = 'primary',
  lg,
  disabled,
  className = '',
}: {
  title: string;
  pendingTitle?: string;
  variant?: BtnVariant;
  lg?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={buttonClasses({ variant, lg, disabled: pending || disabled, className })}
    >
      {pending ? <Icon name="refresh" size={18} className="animate-spin" /> : null}
      {pending ? (pendingTitle ?? title) : title}
    </button>
  );
}

/** Square icon-only control. `label` is required, an icon alone says nothing to a screen reader. */
export function IconButton({
  icon,
  label,
  onClick,
  tone = 'card',
  size = 44,
  disabled,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  tone?: 'card' | 'active' | 'plain';
  size?: number;
  disabled?: boolean;
}) {
  const tones = {
    card: 'border border-line bg-card text-ink hover:bg-paper',
    active: 'border border-teal bg-teal text-onbrand hover:bg-tealdark',
    plain: 'text-ink2 hover:bg-paper',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-[14px] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45 ${tones[tone]}`}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

export function PillButton({
  children,
  tone = 'teal',
  icon,
  onClick,
  className = '',
  pressed,
}: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: IconName;
  onClick: () => void;
  className?: string;
  /** For a pill that is one of a set of choices: says which is chosen. */
  pressed?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} className={pillClasses(tone, true, className)}>
      {icon ? <Icon name={icon} size={12} strokeWidth={2.4} /> : null}
      {children}
    </button>
  );
}

export function ItemButton(props: React.ComponentProps<typeof ItemBody> & { onClick: () => void; last?: boolean }) {
  const { onClick, last, ...body } = props;
  return (
    <button type="button" onClick={onClick} className={itemClasses(true, last)}>
      <ItemBody {...body} interactive />
    </button>
  );
}

export function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  icon,
  type = 'text',
  error,
  hint,
  required,
  id,
  autoComplete,
}: {
  label: string;
  /** Required for server-action forms: FormData is keyed on it. */
  name?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon?: IconName;
  type?: 'text' | 'email' | 'password' | 'tel';
  error?: string;
  hint?: string;
  required?: boolean;
  id?: string;
  autoComplete?: string;
}) {
  const [reveal, setReveal] = useState(false);
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  const isPassword = type === 'password';
  /* Emails, phone numbers and passwords are Latin whatever the account
     language, so they type left to right. In an Urdu form they still sit
     against the right edge, beside their labels. Keyed on the declared type,
     so a revealed password keeps its direction. */
  const latinOnly = type !== 'text';

  return (
    <div className="mb-3">
      <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] font-extrabold text-ink2">
        {label}
        {required ? <span className="ms-0.5 text-red">*</span> : null}
      </label>
      {/* .field-shell owns the focus ring, see globals.css */}
      <div
        className={`field-shell flex items-center gap-2 rounded-[14px] border-[1.5px] bg-card px-3.5 py-3 transition-[border-color,box-shadow] duration-200 ${
          error ? 'border-red' : 'border-line'
        }`}
      >
        {icon ? <Icon name={icon} size={18} className="shrink-0 text-ink3" /> : null}
        <input
          id={inputId}
          name={name}
          type={isPassword && reveal ? 'text' : type}
          value={value}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={latinOnly ? 'ltr' : undefined}
          // 16px on phones: iOS Safari zooms the page into any input set
          // smaller than that, and never zooms back out.
          className={`w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3 md:text-[15px] ${
            latinOnly ? 'rtl:text-right' : ''
          }`}
        />
        {isPassword ? (
          // A 40px target around an 18px eye. The negative margins tuck it
          // into the shell's padding, so a password field is no taller than
          // the fields around it.
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            className="-my-2.5 -me-2 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] pointer-coarse:-my-3 pointer-coarse:h-11 pointer-coarse:w-11 text-ink3 transition-colors duration-200 hover:bg-paper hover:text-ink"
          >
            <Icon name={reveal ? 'eyeOff' : 'eye'} size={18} />
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-[12px] font-bold text-red">
          {error}
        </p>
      ) : null}
      {hint && !error ? <p className="mt-1 text-[12px] text-ink2">{hint}</p> : null}
    </div>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  className = '',
  label,
}: {
  options: { value: T; label: string; urdu?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  label?: string;
}) {
  /* Full width on a phone, so three or four options share the row instead of
     running off the side of it; content width from sm up. A label longer
     than its share wraps inside its own button rather than widening it. */
  return (
    <div
      className={`flex w-full max-w-full gap-1 rounded-[13px] bg-grey p-1 sm:inline-flex sm:w-auto ${className}`}
      role="tablist"
      aria-label={label}
    >
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
              'min-h-11 min-w-0 flex-1 cursor-pointer rounded-[10px] px-2.5 text-[13px] font-extrabold wrap-break-word transition-colors duration-200 sm:px-4 md:min-h-9',
              on ? 'bg-card text-teal shadow-sm' : 'text-ink2 hover:text-ink',
            ].join(' ')}
          >
            {o.urdu ? <Ur>{o.label}</Ur> : o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      /* The track is 26px tall; the invisible ::before stretches the target
         to 46px without moving anything around it. */
      className={`relative h-[26px] w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] ${
        on ? 'bg-teal' : 'bg-mute'
      }`}
    >
      <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all duration-200 ${on ? 'start-[23px]' : 'start-[3px]'}`} />
    </button>
  );
}

/**
 * Transient error banner, announced to screen readers, gone after ~7s.
 * The timer runs whether or not the caller passes onDismiss: it used to depend
 * on it, and every auth form left the banner pinned forever.
 */
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  const [hidden, setHidden] = useState(false);
  // A new message re-shows a banner that had timed out. Adjusted during
  // render, not in an effect, per the set-state-in-effect rule.
  const [prevMessage, setPrevMessage] = useState(message);
  if (message !== prevMessage) {
    setPrevMessage(message);
    setHidden(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setHidden(true);
      onDismiss?.();
    }, 7000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (hidden) return null;

  return (
    <div role="alert" className="mb-3 flex items-start gap-2 rounded-[16px] border border-red bg-redtint px-4 py-3">
      <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-red" />
      <p className="text-[13.5px] font-bold text-red">{message}</p>
    </div>
  );
}
