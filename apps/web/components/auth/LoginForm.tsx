'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { type AuthState, signInAction } from '@/app/(auth)/actions';
import { ErrorBanner, Field, SubmitButton } from '@/components/ui/controls';
import { Card } from '@/components/ui/primitives';
import { useT } from '@/lib/store';
import { isFormValid, validateEmail, validatePassword } from '@/lib/validation';

export function LoginForm({ next }: { next?: string }) {
  const t = useT();
  const [state, action] = useActionState<AuthState, FormData>(signInAction, {});

  // Controlled, so a rejected submit gives the typed values back instead of an
  // empty form. React 19 form actions reset uncontrolled inputs.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  const canSubmit = isFormValid(emailError, passwordError);

  return (
    <Card>
      <h1 className="font-display text-[24px] text-ink">{t('auth.loginTitle')}</h1>
      <p className="mb-4 mt-0.5 text-[14px] text-ink2">{t('auth.loginSub')}</p>

      {state.error ? <ErrorBanner message={state.error} /> : null}

      <form action={action} onSubmit={() => setTouched(true)} noValidate>
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
          error={touched ? (emailError ?? undefined) : undefined}
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
          error={touched ? (passwordError ?? undefined) : undefined}
        />
        <SubmitButton title={t('auth.logIn')} pendingTitle="Signing in…" disabled={!canSubmit} className="w-full" />
      </form>

      <div className="mt-3 flex items-center justify-between gap-3 text-[13px]">
        <Link href="/forgot" className="font-extrabold text-teal hover:underline">
          {t('auth.forgotPassword')}
        </Link>
        <Link href="/signup" className="font-extrabold text-ink2 hover:text-teal">
          Create an account
        </Link>
      </div>
    </Card>
  );
}
