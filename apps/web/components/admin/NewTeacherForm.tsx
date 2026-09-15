'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ErrorBanner, SubmitButton } from '@/components/ui/controls';
import { LinkBtn } from '@/components/ui/primitives';
import { createTeacherAction, type AdminState } from '@/app/(admin)/actions';

/**
 * Adnan's onboarding form.
 *
 * He has already met these people and written their details on paper, so this
 * is transcription, not an application: everything except the four fields that
 * make the account work is optional, and nothing here validates a phone number
 * or a bank account into a shape a real teacher might not fit.
 *
 * Controlled, like every other form in the app: a rejected submit keeps what
 * was typed, and the button stays off until the four required fields pass the
 * same rules the server checks (NewTeacher in app/(admin)/actions.ts), each
 * saying what is wrong once it has been left.
 */

type Values = Record<(typeof FIELDS)[number], string>;
const FIELDS = ['fullName', 'email', 'password', 'commissionPct', 'phone', 'city', 'institution', 'payoutMethod', 'payoutAccount', 'payoutName', 'note'] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The server's rules for the four fields that matter, in the server's words. */
function problems(v: Values): Partial<Record<keyof Values, string>> {
  const out: Partial<Record<keyof Values, string>> = {};
  if (v.fullName.trim().length < 2) out.fullName = 'Name is required.';
  if (!EMAIL.test(v.email.trim())) out.email = 'That does not look like an email address.';
  if (v.password.length < 8) out.password = 'Password must be at least 8 characters.';
  else if (v.password.length > 72) out.password = 'Password must be 72 characters or fewer.';
  const pct = Number(v.commissionPct);
  if (v.commissionPct.trim() === '' || !Number.isFinite(pct)) out.commissionPct = 'Enter their commission, 0 to 100.';
  else if (pct < 0) out.commissionPct = 'Commission cannot be negative.';
  else if (pct > 100) out.commissionPct = 'Commission cannot be over 100%.';
  return out;
}

export function NewTeacherForm({ siteUrl }: { siteUrl: string }) {
  const [state, action] = useActionState<AdminState, FormData>(createTeacherAction, {});
  const [values, setValues] = useState<Values>(() => Object.fromEntries(FIELDS.map((f) => [f, ''])) as Values);
  const [left, setLeft] = useState<Partial<Record<keyof Values, boolean>>>({});

  if (state.code) {
    const link = `${siteUrl}/r/${state.code}`;
    return (
      <div className="rounded-[16px] border border-green bg-greentint px-5 py-5">
        <h2 className="font-display text-[19px] text-ink">{state.ok}</h2>
        <p className="mt-1 text-[13.5px] text-ink2">
          Send them this link and the password you set. They sign in at the website and land on their own dashboard.
        </p>

        <div className="mt-4 rounded-[12px] border border-line bg-card px-4 py-3">
          <p className="text-[12px] font-extrabold text-ink2">Their link</p>
          <p className="mt-1 break-all font-mono text-[13.5px] text-ink">{link}</p>
          <p className="mt-2.5 text-[12px] font-extrabold text-ink2">Their code</p>
          <p className="mt-1 font-mono text-[15px] font-extrabold text-teal">{state.code}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <LinkBtn title="Back to teachers" href="/admin/teachers" sm />
          <LinkBtn title="Add another" href="/admin/teachers/new" variant="line" sm />
        </div>
      </div>
    );
  }

  const issues = problems(values);
  const valid = Object.keys(issues).length === 0;
  const field = (name: keyof Values) => ({
    name,
    value: values[name],
    onChange: (v: string) => setValues((cur) => ({ ...cur, [name]: v })),
    onBlur: () => setLeft((cur) => ({ ...cur, [name]: true })),
    error: left[name] ? issues[name] : undefined,
  });

  return (
    <form action={action} className="max-w-[640px]">
      {state.error ? <ErrorBanner message={state.error} /> : null}

      <Group title="The account">
        <Text {...field('fullName')} label="Full name" required placeholder="Sana Iqbal" />
        <Text {...field('email')} label="Email" type="email" required placeholder="sana@example.com" />
        <Text
          {...field('password')}
          label="Password you will give them"
          type="text"
          required
          placeholder="At least 8 characters"
          hint="Shown as plain text on purpose: you have to read it out or send it to them. They can change it under Settings once they are in."
        />
        <Text
          {...field('commissionPct')}
          label="Commission"
          type="number"
          required
          placeholder="20"
          suffix="%"
          hint="Their share of everything their students pay, for as long as they keep paying."
        />
      </Group>

      <Group title="Who they are" note="All optional. For your own records.">
        <Text {...field('phone')} label="Phone" placeholder="+92 300 1234567" />
        <Text {...field('city')} label="City" placeholder="Rawalpindi" />
        <Text {...field('institution')} label="School or academy" placeholder="Government Model School" />
      </Group>

      {/* The teacher's page shows these beside every payout. The action always
          took them; the form never asked, so they read "not recorded". */}
      <Group title="How they are paid" note="All optional. Shown on their page when you record a payout.">
        <Text {...field('payoutMethod')} label="Payout method" placeholder="JazzCash" />
        <Text {...field('payoutAccount')} label="Account" placeholder="0300 1234567" />
        <Text {...field('payoutName')} label="Account title" placeholder="Sana Iqbal" />
        <Text {...field('note')} label="Note" placeholder="Pays on the 1st of each month" />
      </Group>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SubmitButton title="Create the account" pendingTitle="Creating…" disabled={!valid} />
        <Link
          href="/admin/teachers"
          className="inline-flex min-h-11 items-center px-2 text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:text-ink"
        >
          Cancel
        </Link>
      </div>
      {!valid ? <p className="mt-2 text-[12px] text-ink2">Fill in the four fields marked * to create the account.</p> : null}
    </form>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-6 first:mt-0">
      <legend className="mb-0.5 font-display text-[16px] text-ink">{title}</legend>
      {note ? <p className="mb-3 text-[12.5px] text-ink2">{note}</p> : <div className="mb-3" />}
      <div className="grid gap-3.5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Text({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  hint,
  suffix,
  value,
  onChange,
  onBlur,
  error,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
}) {
  return (
    <label className={`block ${hint ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-[12.5px] font-extrabold text-ink2">
        {label}
        {required ? <span className="text-red"> *</span> : null}
      </span>
      {/* .field-shell owns the focus ring, see globals.css. Without it the
          box draws a border and the browser draws its own inside it. */}
      <span
        className={`field-shell flex items-center gap-2 rounded-[12px] border-[1.5px] bg-card px-3.5 py-2.5 transition-[border-color,box-shadow] duration-200 ${
          error ? 'border-red' : 'border-line'
        }`}
      >
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!error}
          step={type === 'number' ? '0.5' : undefined}
          min={type === 'number' ? '0' : undefined}
          max={type === 'number' ? '100' : undefined}
          // 16px on a phone: iOS Safari zooms into any smaller input and
          // stays zoomed after it loses focus.
          className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3 md:text-[14px]"
        />
        {suffix ? <span className="text-[13px] font-extrabold text-ink3">{suffix}</span> : null}
      </span>
      {error ? (
        <span className="mt-1 block text-[12px] font-bold text-red">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12px] text-ink2">{hint}</span>
      ) : null}
    </label>
  );
}
