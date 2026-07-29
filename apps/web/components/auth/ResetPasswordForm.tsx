'use client';

import { useActionState, useState } from 'react';
import { type AuthState, setPasswordAction } from '@/app/(auth)/actions';
import { ErrorBanner, Field, SubmitButton } from '@/components/ui/controls';
import { Card } from '@/components/ui/primitives';
import { useT } from '@/lib/store';
import { isFormValid, validatePassword } from '@/lib/validation';

/**
 * Reached only by following a recovery link, which /auth/callback has already
 * exchanged for a session. The action re-checks that session server-side, so
 * arriving here without one changes nothing.
 */
export function ResetPasswordForm() {
  const t = useT();
  const [state, action] = useActionState<AuthState, FormData>(setPasswordAction, {});
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);

  const passwordError = validatePassword(password);
  const confirmError = confirm === password ? null : 'Both passwords need to match.';

  return (
    <Card>
      <h1 className="font-display text-[24px] text-ink">Choose a new password</h1>
      <p className="mb-4 mt-0.5 text-[14px] text-ink2">You are signed in from the email link. Pick something you will remember.</p>

      {state.error ? <ErrorBanner message={state.error} /> : null}

      <form action={action} onSubmit={() => setTouched(true)} noValidate>
        <Field
          label="New password"
          name="password"
          value={password}
          onChange={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          icon="key"
          type="password"
          autoComplete="new-password"
          required
          error={touched ? (passwordError ?? undefined) : undefined}
        />
        <Field
          label="New password again"
          name="confirm"
          value={confirm}
          onChange={setConfirm}
          placeholder={t('auth.passwordPlaceholder')}
          icon="key"
          type="password"
          autoComplete="new-password"
          required
          error={touched ? (confirmError ?? undefined) : undefined}
        />
        <SubmitButton
          title="Save new password"
          pendingTitle="Saving…"
          disabled={!isFormValid(passwordError, confirmError)}
          className="w-full"
        />
      </form>
    </Card>
  );
}
