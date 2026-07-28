'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@matricmate/core';
import { Btn, ErrorBanner, Field } from '@/components/ui/controls';
import { Card } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';
import { isFormValid, validateContact, validateName, validatePassword } from '@/lib/validation';

export function SignUpForm() {
  const t = useT();
  const router = useRouter();
  const { actions } = useApp();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = validateName(name);
  const contactError = validateContact(contact);
  const passwordError = validatePassword(password);
  const canSubmit = isFormValid(nameError, contactError, passwordError);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const user = await api.signUp({ name, contact, password });
      actions.signIn(user);
      router.push('/onboarding/class');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h1 className="font-display text-[24px] text-ink">{t('auth.signUpTitle')}</h1>
      <p className="mb-4 mt-0.5 text-[14px] text-ink2">{t('auth.signUpSub')}</p>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <form onSubmit={submit} noValidate>
        <Field
          label={t('auth.fullName')}
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
          value={contact}
          onChange={setContact}
          placeholder={t('auth.contactPlaceholder')}
          icon="mail"
          autoComplete="username"
          required
          error={touched ? (contactError ?? undefined) : undefined}
        />
        <Field
          label={t('auth.password')}
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
        <Btn title={t('auth.createAccount')} type="submit" loading={busy} disabled={!canSubmit} className="w-full" />
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
