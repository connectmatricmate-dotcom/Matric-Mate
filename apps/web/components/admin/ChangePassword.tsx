'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/controls';
import { changePasswordAction, type PasswordState } from '@/app/(auth)/password-actions';
import { Note } from '@/components/admin/bits';

/**
 * Change your own password. On both staff panels, for the same reason: the
 * first password on these accounts was chosen by somebody else.
 */
export function ChangePassword({ hint }: { hint?: string }) {
  const [state, action] = useActionState<PasswordState, FormData>(changePasswordAction, {});

  return (
    <form action={action} className="max-w-[420px] rounded-[16px] border border-line bg-card px-4 py-4">
      <h2 className="font-display text-[17px] text-ink">Change your password</h2>
      {hint ? <p className="mt-0.5 text-[12.5px] text-ink2">{hint}</p> : null}

      {state.error ? (
        <div className="mt-3" role="alert">
          <Note tone="red">{state.error}</Note>
        </div>
      ) : null}
      {state.ok ? (
        <div className="mt-3" role="status">
          <Note tone="green">{state.ok}</Note>
        </div>
      ) : null}

      <div className="mt-3.5 grid gap-3">
        <Secret name="current" label="Current password" autoComplete="current-password" />
        <Secret name="next" label="New password" autoComplete="new-password" hint="At least 8 characters." />
        <Secret name="confirm" label="New password again" autoComplete="new-password" />
      </div>

      <div className="mt-4">
        <SubmitButton title="Change password" pendingTitle="Changing…" />
      </div>
    </form>
  );
}

function Secret({
  name,
  label,
  autoComplete,
  hint,
}: {
  name: string;
  label: string;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-extrabold text-ink2">{label}</span>
      <span className="field-shell flex rounded-[12px] border-[1.5px] border-line bg-card px-3.5 py-2.5 transition-[border-color,box-shadow] duration-200">
        <input
          name={name}
          type="password"
          required
          autoComplete={autoComplete}
          // A placeholder on a password field, per the house rule: an empty
          // box with no hint is the one people mistake for a disabled field.
          placeholder="••••••••"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink3"
        />
      </span>
      {hint ? <span className="mt-1 block text-[11.5px] text-ink3">{hint}</span> : null}
    </label>
  );
}
