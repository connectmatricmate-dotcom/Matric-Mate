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
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  tone?: 'card' | 'active' | 'plain';
  size?: number;
}) {
  const tones = {
    card: 'border border-line bg-card text-ink hover:bg-paper',
    active: 'border border-teal bg-teal text-white hover:bg-tealdark',
    plain: 'text-ink2 hover:bg-paper',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-[14px] transition-colors duration-200 ${tones[tone]}`}
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
}: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: IconName;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} className={pillClasses(tone, true, className)}>
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

  return (
    <div className="mb-3">
      <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] font-extrabold text-ink2">
        {label}
        {required ? <span className="ml-0.5 text-red">*</span> : null}
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
          type={isPassword && reveal ? 'text' : type}
          value={value}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink3"
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            className="shrink-0 cursor-pointer text-ink3 hover:text-ink"
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
  return (
    <div className={`inline-flex gap-1 rounded-[13px] bg-grey p-1 ${className}`} role="tablist" aria-label={label}>
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
              'min-h-9 flex-1 cursor-pointer whitespace-nowrap rounded-[10px] px-4 text-[13px] font-extrabold transition-colors duration-200',
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
      className={`relative h-[26px] w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
        on ? 'bg-teal' : 'bg-[#D7E0DB]'
      }`}
    >
      <span className={`absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all duration-200 ${on ? 'left-[23px]' : 'left-[3px]'}`} />
    </button>
  );
}

/** Transient error banner, announced to screen readers, gone after ~7s. */
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  useEffect(() => {
    if (!onDismiss) return;
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div role="alert" className="mb-3 flex items-start gap-2 rounded-[16px] border border-red bg-redtint px-4 py-3">
      <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-red" />
      <p className="text-[13.5px] font-bold text-red">{message}</p>
    </div>
  );
}
