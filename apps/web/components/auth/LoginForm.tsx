'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { type AuthState, signInAction } from '@/app/(auth)/actions';
import { useTouched } from '@/components/auth/useTouched';
import { ErrorBanner, Field, SubmitButton } from '@/components/ui/controls';
import { Card } from '@/components/ui/primitives';
import { useLang, useT } from '@/lib/store';
import { isFormValid, validateEmail, validatePassword } from '@/lib/validation';

export function LoginForm({ next, linkFailed }: { next?: string; linkFailed?: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const [state, action] = useActionState<AuthState, FormData>(signInAction, {});
  const { touched, onBlur } = useTouched();

  // Controlled, so a rejected submit gives the typed values back instead of an
  // empty form. React 19 form actions reset uncontrolled inputs.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const emailError = validateEmail(email, lang);
  const passwordError = validatePassword(password, lang);
  const canSubmit = isFormValid(emailError, passwordError);

  return (
    <Card>
      <h1 className="font-display text-[24px] text-ink">{t('auth.loginTitle')}</h1>
      <p className="mb-4 mt-0.5 text-[14px] text-ink2">{t('auth.loginSub')}</p>

      {/* Keyed on the attempt, so the same failure twice shows twice. */}
      {state.error ? (
        <ErrorBanner key={state.at} message={state.error} />
      ) : linkFailed ? (
        <ErrorBanner message={t('auth.linkError')} />
      ) : null}

      <form action={action} onBlur={onBlur} noValidate>
        <input type="hidden" name="next" value={next ?? ''} />
        <Field
          label={t('auth.contact')}
          name="email"
          value={email}
          onChange={setEmail}
          placeholder={t('auth.contactPlaceholder')}
          icon="mail"
          type="email"
          autoComplete="email"
          required
          error={touched.email ? (emailError ?? undefined) : undefined}
        />
        <Field
          label={t('auth.password')}
          name="password"
          value={password}
          onChange={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          icon="key"
          type="password"
          autoComplete="current-password"
          required
          error={touched.password ? (passwordError ?? undefined) : undefined}
        />
        <SubmitButton title={t('auth.logIn')} pendingTitle={t('auth.signingIn')} disabled={!canSubmit} className="w-full" />
      </form>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 text-[13px]">
        <Link href="/forgot" className="inline-flex min-h-11 items-center font-extrabold text-teal hover:underline">
          {t('auth.forgotPassword')}
        </Link>
        <Link
          href="/signup"
          className="inline-flex min-h-11 items-center font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
        >
          {t('auth.createAccount')}
        </Link>
      </div>
    </Card>
  );
}
