'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/controls';
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
 * about keeping what was typed. A server action re-renders the same form
 * element rather than replacing it, so the browser keeps the values on a
 * failed submit by itself, and holding fourteen fields in React state to
 * achieve what the platform already does would be the wrong trade.
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
          <Link
            href="/admin/teachers"
            className="rounded-full bg-teal px-4 py-2.5 text-[13px] font-extrabold text-onbrand transition-[filter] duration-200 hover:brightness-110"
          >
            Back to teachers
          </Link>
          <Link
            href="/admin/teachers/new"
            className="rounded-full border border-line bg-card px-4 py-2.5 text-[13px] font-extrabold text-ink transition-colors duration-200 hover:bg-paper"
          >
            Add another
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="max-w-[640px]">
      {state.error ? (
        <div className="mb-4" role="alert">
          <Note tone="red">{state.error}</Note>
        </div>
      ) : null}

      <Group title="The account">
        <Text name="fullName" label="Full name" required placeholder="Sana Iqbal" />
        <Text name="email" label="Email" type="email" required placeholder="sana@example.com" />
        <Text
          name="password"
          label="Password you will give them"
          type="text"
          required
          placeholder="At least 8 characters"
          hint="Shown as plain text on purpose: you have to read it out. Email invites are not possible until the domain is verified."
        />
        <Text
          name="commissionPct"
          label="Commission"
          type="number"
          required
          placeholder="20"
          suffix="%"
          hint="Their share of everything their students pay, for as long as they keep paying."
        />
      </Group>

      <Group title="Who they are" note="All optional. For your own records.">
        <Text name="phone" label="Phone" placeholder="+92 300 1234567" />
        <Text name="city" label="City" placeholder="Rawalpindi" />
        <Text name="institution" label="School or academy" placeholder="Government Model School" />
      </Group>

      <Group title="How you will pay them" note="All optional. Nothing here is validated, so any format works.">
        <Text name="payoutMethod" label="Method" placeholder="JazzCash, Easypaisa, bank transfer" />
        <Text name="payoutAccount" label="Account or IBAN" placeholder="0300 1234567" />
        <Text name="payoutName" label="Account title" placeholder="Sana Iqbal" />
      </Group>

      <Group title="Notes">
        <Text name="note" label="Anything worth remembering" placeholder="Met at the Rawalpindi teachers' meet, teaches Class 10 physics" />
      </Group>

      <div className="mt-6 flex items-center gap-3">
        <SubmitButton title="Create the account" pendingTitle="Creating…" />
        <Link href="/admin/teachers" className="text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:text-ink">
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
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  suffix?: string;
}) {
  return (
    <label className={`block ${hint ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-[12.5px] font-extrabold text-ink2">
        {label}
        {required ? <span className="text-red"> *</span> : null}
      </span>
      <span className="flex items-center gap-2 rounded-[12px] border-[1.5px] border-line bg-paper px-3.5 py-2.5 focus-within:border-teal">
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          step={type === 'number' ? '0.5' : undefined}
          min={type === 'number' ? '0' : undefined}
          max={type === 'number' ? '100' : undefined}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink3"
        />
        {suffix ? <span className="text-[13px] font-extrabold text-ink3">{suffix}</span> : null}
      </span>
      {hint ? <span className="mt-1 block text-[11.5px] text-ink3">{hint}</span> : null}
    </label>
  );
}
