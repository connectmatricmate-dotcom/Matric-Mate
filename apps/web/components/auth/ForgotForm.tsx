'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { type AuthState, resetPasswordAction } from '@/app/(auth)/actions';
import { ErrorBanner, Field, SubmitButton } from '@/components/ui/controls';
import { Card, Icon } from '@/components/ui/primitives';
import { useT } from '@/lib/store';
import { isFormValid, validateEmail } from '@/lib/validation';

export function ForgotForm() {
  const t = useT();
  const [state, action] = useActionState<AuthState, FormData>(resetPasswordAction, {});
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const emailError = validateEmail(email);

  if (state.sent) {
    return (
      <Card>
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-greentint text-green">
          <Icon name="check" size={24} strokeWidth={2.6} />
        </span>
        <h1 className="font-display text-[22px] text-ink">{t('auth.resetTitle')}</h1>
        <p className="mt-1 text-[14px] leading-[1.6] text-ink2">{t('auth.resetSent', { contact: email })}</p>
        <p className="mt-3 text-[12px] text-ink3">{t('auth.resetFootnote')}</p>
        <Link href="/login" className="mt-4 inline-block text-[13px] font-extrabold text-teal hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="font-display text-[24px] text-ink">{t('auth.resetTitle')}</h1>
      <p className="mb-4 mt-0.5 text-[14px] text-ink2">{t('auth.resetSub')}</p>

      {state.error ? <ErrorBanner message={state.error} /> : null}

      <form action={action} onSubmit={() => setTouched(true)} noValidate>
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
        <SubmitButton
          title={t('auth.sendReset')}
          pendingTitle="Sending…"
          disabled={!isFormValid(emailError)}
          className="w-full"
        />
      </form>

      <Link href="/login" className="mt-3 inline-block text-[13px] font-extrabold text-ink2 hover:text-teal">
        {t('auth.backToLogin')}
      </Link>
    </Card>
  );
}
