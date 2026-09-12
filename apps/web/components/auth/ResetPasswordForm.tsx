'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { type AuthState, setPasswordAction } from '@/app/(auth)/actions';
import { useTouched } from '@/components/auth/useTouched';
import { ErrorBanner, Field, SubmitButton } from '@/components/ui/controls';
import { Card } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';
import { useLang, useT } from '@/lib/store';
import { isFormValid, validatePassword } from '@/lib/validation';

/**
 * Reached by following a recovery link. /auth/callback has usually already
 * turned it into a session. The action re-checks that session server-side,
 * so arriving here without one changes nothing.
 */
export function ResetPasswordForm() {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const [state, action] = useActionState<AuthState, FormData>(setPasswordAction, {});
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { touched, onBlur } = useTouched();
  /** When the emailed session could not be taken up; keys its banner. */
  const [linkFailedAt, setLinkFailedAt] = useState<number | null>(null);

  /*
   * A reset asked for from the Android app uses the implicit flow, so its
   * session arrives in the URL fragment, which no server sees. Hand it to the
   * browser client, which writes the same cookies /auth/callback would have,
   * and take it out of the address bar first so the tokens do not sit in the
   * history. A link Supabase refused says why in the same place.
   */
  useEffect(() => {
    if (window.location.hash.length < 2) return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, '', window.location.pathname);

    if (hash.get('error') || hash.get('error_code')) {
      router.replace(`/forgot?error=${hash.get('error_code') === 'otp_expired' ? 'expired' : 'link'}`);
      return;
    }
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (!accessToken || !refreshToken) return;
    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) setLinkFailedAt(Date.now());
      });
  }, [router]);

  const passwordError = validatePassword(password, lang);
  const confirmError = confirm === password ? null : t('auth.passwordsMatch');

  return (
    <Card>
      <h1 className="font-display text-[24px] text-ink">{t('auth.newPasswordTitle')}</h1>
      <p className="mb-4 mt-0.5 text-[14px] text-ink2">{t('auth.newPasswordSub')}</p>

      {/* Keyed on the attempt, so the same failure twice shows twice. */}
      {state.error ? (
        <ErrorBanner key={state.at} message={state.error} />
      ) : linkFailedAt ? (
        <ErrorBanner key={linkFailedAt} message={t('auth.errLinkExpired')} />
      ) : null}

      <form action={action} onBlur={onBlur} noValidate>
        <Field
          label={t('auth.newPassword')}
          name="password"
          value={password}
          onChange={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          icon="key"
          type="password"
          autoComplete="new-password"
          required
          error={touched.password ? (passwordError ?? undefined) : undefined}
        />
        <Field
          label={t('auth.newPasswordAgain')}
          name="confirm"
          value={confirm}
          onChange={setConfirm}
          placeholder={t('auth.passwordPlaceholder')}
          icon="key"
          type="password"
          autoComplete="new-password"
          required
          error={touched.confirm ? (confirmError ?? undefined) : undefined}
        />
        <SubmitButton
          title={t('auth.saveNewPassword')}
          pendingTitle={t('auth.saving')}
          disabled={!isFormValid(passwordError, confirmError)}
          className="w-full"
        />
      </form>
    </Card>
  );
}
