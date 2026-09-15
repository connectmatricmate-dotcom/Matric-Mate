'use client';

import { useActionState, useState } from 'react';
import { ErrorBanner, SubmitButton } from '@/components/ui/controls';
import { changePasswordAction, type PasswordState } from '@/app/(auth)/password-actions';
import { Note } from '@/components/admin/bits';

/**
 * Change your own password. On both staff panels, for the same reason: the
 * first password on these accounts was chosen by somebody else.
 *
 * Controlled, so a wrong current password does not wipe the two new ones, and
 * the button waits until the rules the server checks (Change in
 * password-actions.ts) are met: a new password of 8 to 72 characters, typed
 * the same twice, and not the one already in use. A changed password clears
 * the form.
 */
export function ChangePassword({ hint }: { hint?: string }) {
  const [state, action] = useActionState<PasswordState, FormData>(changePasswordAction, {});
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  // Adjusted during render, not in an effect: a success empties the fields.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.ok) {
      setCurrent('');
      setNext('');
      setConfirm('');
    }
  }

  const nextProblem =
    next && next.length < 8
      ? 'At least 8 characters.'
      : next.length > 72
        ? 'At most 72 characters.'
        : next && current && next === current
          ? 'That is the password you already have.'
          : undefined;
  const confirmProblem = confirm && confirm !== next ? 'The two new passwords do not match.' : undefined;
  const valid = !!current && next.length >= 8 && next.length <= 72 && next !== current && confirm === next;

  return (
    <form action={action} className="max-w-[420px] rounded-[16px] border border-line bg-card px-4 py-4">
      <h2 className="font-display text-[17px] text-ink">Change your password</h2>
      {hint ? <p className="mt-0.5 text-[12.5px] text-ink2">{hint}</p> : null}

      {state.error ? (
        <div className="mt-3">
          <ErrorBanner message={state.error} />
        </div>
      ) : null}
      {state.ok ? (
        <div className="mt-3" role="status">
          <Note tone="green">{state.ok}</Note>
        </div>
      ) : null}

      <div className="mt-3.5 grid gap-3">
        <Secret name="current" label="Current password" autoComplete="current-password" value={current} onChange={setCurrent} />
        <Secret name="next" label="New password" autoComplete="new-password" hint="At least 8 characters." value={next} onChange={setNext} error={nextProblem} />
        <Secret name="confirm" label="New password again" autoComplete="new-password" value={confirm} onChange={setConfirm} error={confirmProblem} />
      </div>

      <div className="mt-4">
        <SubmitButton title="Change password" pendingTitle="Changing…" disabled={!valid} />
      </div>
    </form>
  );
}

function Secret({
  name,
  label,
  autoComplete,
  hint,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  autoComplete: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-extrabold text-ink2">{label}</span>
      <span
        className={`field-shell flex rounded-[12px] border-[1.5px] bg-card px-3.5 py-2.5 transition-[border-color,box-shadow] duration-200 ${
          error ? 'border-red' : 'border-line'
        }`}
      >
        <input
          name={name}
          type="password"
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          // A placeholder on a password field, per the house rule: an empty
          // box with no hint is the one people mistake for a disabled field.
          placeholder="••••••••"
          // 16px on a phone, where iOS Safari zooms into anything smaller.
          className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3 md:text-[14px]"
        />
      </span>
      {error ? (
        <span className="mt-1 block text-[12px] font-bold text-red">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12px] text-ink2">{hint}</span>
      ) : null}
    </label>
  );
}
