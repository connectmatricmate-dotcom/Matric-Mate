'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/controls';
import { LinkBtn } from '@/components/ui/primitives';
import { createTeacherAction, type AdminState } from '@/app/(admin)/actions';
import { Note } from '@/components/admin/bits';

/**
 * Adnan's onboarding form.
 *
 * He has already met these people and written their details on paper, so this
 * is transcription, not an application: everything except the four fields that
 * make the account work is optional, and nothing here validates a phone number
 * or a bank account into a shape a real teacher might not fit.
 *
 * Uncontrolled inputs, which is the one place this departs from the house rule
 * about controlled fields. React 19 resets an uncontrolled form once its action
 * returns, so a failed submit used to come back empty; the action now hands
 * back what was typed and each field starts from it. Holding every field in
 * React state to get the same result would be the wrong trade.
 */
export function NewTeacherForm({ siteUrl }: { siteUrl: string }) {
  const [state, action] = useActionState<AdminState, FormData>(createTeacherAction, {});

  if (state.code) {
    const link = `${siteUrl}/r/${state.code}`;
    return (
      <div className="rounded-[16px] border border-green bg-greentint px-5 py-5">
        <h2 className="font-display text-[19px] text-ink">{state.ok}</h2>
        <p className="mt-1 text-[13.5px] text-ink2">
          Send them this link and the password you set. They sign in at the website and land on their own dashboard.
        </p>

        <div className="mt-4 rounded-[12px] border border-line bg-card px-4 py-3">
          <p className="text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink3">Their link</p>
          <p className="mt-1 break-all font-mono text-[13.5px] text-ink">{link}</p>
          <p className="mt-2.5 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink3">Their code</p>
          <p className="mt-1 font-mono text-[15px] font-extrabold text-teal">{state.code}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <LinkBtn title="Back to teachers" href="/admin/teachers" sm />
          <LinkBtn title="Add another" href="/admin/teachers/new" variant="line" sm />
        </div>
      </div>
    );
  }

  const v = state.values ?? {};

  return (
    <form action={action} className="max-w-[640px]">
      {state.error ? (
        <div className="mb-4" role="alert">
          <Note tone="red">{state.error}</Note>
        </div>
      ) : null}

      <Group title="The account">
        <Text name="fullName" label="Full name" required placeholder="Sana Iqbal" value={v.fullName} />
        <Text name="email" label="Email" type="email" required placeholder="sana@example.com" value={v.email} />
        <Text
          name="password"
          label="Password you will give them"
          type="text"
          required
          placeholder="At least 8 characters"
          hint="Shown as plain text on purpose: you have to read it out. Email invites are not possible until the domain is verified."
          value={v.password}
        />
        <Text
          name="commissionPct"
          label="Commission"
          type="number"
          required
          placeholder="20"
          suffix="%"
          hint="Their share of everything their students pay, for as long as they keep paying."
          value={v.commissionPct}
        />
      </Group>

      <Group title="Who they are" note="All optional. For your own records.">
        <Text name="phone" label="Phone" placeholder="+92 300 1234567" value={v.phone} />
        <Text name="city" label="City" placeholder="Rawalpindi" value={v.city} />
        <Text name="institution" label="School or academy" placeholder="Government Model School" value={v.institution} />
      </Group>

      {/* The teacher's page shows these beside every payout. The action always
          took them; the form never asked, so they read "not recorded". */}
      <Group title="How they are paid" note="All optional. Shown on their page when you record a payout.">
        <Text name="payoutMethod" label="Payout method" placeholder="JazzCash" value={v.payoutMethod} />
        <Text name="payoutAccount" label="Account" placeholder="0300 1234567" value={v.payoutAccount} />
        <Text name="payoutName" label="Account title" placeholder="Sana Iqbal" value={v.payoutName} />
        <Text name="note" label="Note" placeholder="Pays on the 1st of each month" value={v.note} />
      </Group>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SubmitButton title="Create the account" pendingTitle="Creating…" />
        <Link
          href="/admin/teachers"
          className="inline-flex min-h-11 items-center px-2 text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:text-ink"
        >
          Cancel
        </Link>
      </div>
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
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  suffix?: string;
  /** What was typed before a failed submit, so the form's reset restores it. */
  value?: string;
}) {
  return (
    <label className={`block ${hint ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-[12.5px] font-extrabold text-ink2">
        {label}
        {required ? <span className="text-red"> *</span> : null}
      </span>
      {/* .field-shell owns the focus ring, see globals.css. Without it the
          box draws a border and the browser draws its own inside it. */}
      <span className="field-shell flex items-center gap-2 rounded-[12px] border-[1.5px] border-line bg-card px-3.5 py-2.5 transition-[border-color,box-shadow] duration-200">
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={value}
          step={type === 'number' ? '0.5' : undefined}
          min={type === 'number' ? '0' : undefined}
          max={type === 'number' ? '100' : undefined}
          // 16px on a phone: iOS Safari zooms into any smaller input and
          // stays zoomed after it loses focus.
          className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3 md:text-[14px]"
        />
        {suffix ? <span className="text-[13px] font-extrabold text-ink3">{suffix}</span> : null}
      </span>
      {hint ? <span className="mt-1 block text-[11.5px] text-ink3">{hint}</span> : null}
    </label>
  );
}
