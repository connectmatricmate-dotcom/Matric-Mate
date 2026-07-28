'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@matricmate/core';
import { Btn, ErrorBanner, Field } from '@/components/ui/controls';
import { Card } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';
import { isFormValid, validateContact, validatePassword } from '@/lib/validation';

export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const { state, actions } = useApp();
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactError = validateContact(contact);
  const passwordError = validatePassword(password);
  const canSubmit = isFormValid(contactError, passwordError);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const user = await api.signIn({ contact, password });
      actions.signIn(user);
      router.push(state.onboarding?.subjects?.length ? '/dashboard' : '/onboarding/class');
    } catch {
      setError(t('auth.demoHint'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h1 className="font-display text-[24px] text-ink">{t('auth.loginTitle')}</h1>
      <p className="mb-4 mt-0.5 text-[14px] text-ink2">{t('auth.loginSub')}</p>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <form onSubmit={submit} noValidate>
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
          placeholder="At least 6 characters"
          icon="key"
          type="password"
          autoComplete="current-password"
          required
          error={touched ? (passwordError ?? undefined) : undefined}
        />
        <Btn title={t('auth.logIn')} type="submit" loading={busy} disabled={!canSubmit} className="w-full" />
      </form>

      <div className="mt-3 flex items-center justify-between text-[13px]">
        <Link href="/forgot" className="font-extrabold text-teal hover:underline">
          {t('auth.forgotPassword')}
        </Link>
        <Link href="/signup" className="font-extrabold text-ink2 hover:text-teal">
          Create an account
        </Link>
      </div>

      <p className="mt-4 text-[12px] text-ink3">{t('auth.demoHint')}</p>
    </Card>
  );
}
