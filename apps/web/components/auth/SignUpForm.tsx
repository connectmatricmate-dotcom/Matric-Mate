'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { type AuthState, signUpAction } from '@/app/(auth)/actions';
import { ErrorBanner, Field, SubmitButton } from '@/components/ui/controls';
import { Card } from '@/components/ui/primitives';
import { useT } from '@/lib/store';
import { isFormValid, validateEmail, validateName, validatePassword } from '@/lib/validation';

export function SignUpForm({ next }: { next?: string }) {
  const t = useT();
  const [state, action] = useActionState<AuthState, FormData>(signUpAction, {});

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError = validateName(name);
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  const canSubmit = isFormValid(nameError, emailError, passwordError);

  return (
    <Card>
      <h1 className="font-display text-[24px] text-ink">{t('auth.signUpTitle')}</h1>
      <p className="mb-4 mt-0.5 text-[14px] text-ink2">{t('auth.signUpSub')}</p>

      {state.error ? <ErrorBanner message={state.error} /> : null}

      <form action={action} onSubmit={() => setTouched(true)} noValidate>
        <input type="hidden" name="next" value={next ?? '/onboarding/class'} />
        <Field
          label={t('auth.fullName')}
          name="name"
          value={name}
          onChange={setName}
          placeholder={t('auth.namePlaceholder')}
          icon="user"
          autoComplete="name"
          required
          error={touched ? (nameError ?? undefined) : undefined}
        />
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
          autoComplete="new-password"
          required
          error={touched ? (passwordError ?? undefined) : undefined}
        />
        <p className="mb-3 text-[12px] leading-[1.6] text-ink2">{t('auth.terms')}</p>
        <SubmitButton
          title={t('auth.createAccount')}
          pendingTitle="Creating your account…"
          disabled={!canSubmit}
          className="w-full"
        />
      </form>

      <p className="mt-3 text-center text-[13px] text-ink2">
        Already have an account?{' '}
        <Link href="/login" className="font-extrabold text-teal hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
