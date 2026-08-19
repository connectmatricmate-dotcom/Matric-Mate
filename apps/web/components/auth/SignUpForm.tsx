'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { type AuthState, resendConfirmationAction, signUpAction } from '@/app/(auth)/actions';
import { ErrorBanner, Field, SubmitButton } from '@/components/ui/controls';
import { Card } from '@/components/ui/primitives';
import { useT } from '@/lib/store';
import { isFormValid, validateEmail, validateName, validatePassword } from '@/lib/validation';

export function SignUpForm({ next, ref }: { next?: string; ref?: string }) {
  const t = useT();
  const [state, action] = useActionState<AuthState, FormData>(signUpAction, {});
  const [resent, resendAction] = useActionState<AuthState, FormData>(resendConfirmationAction, {});

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError = validateName(name);
  const emailError = validateEmail(email);
  const passwordError = validatePassword(password);
  const canSubmit = isFormValid(nameError, emailError, passwordError);

  /**
   * The account exists but needs its address confirmed, so there is no session
   * and nowhere to send them. Before this, the action redirected anyway and
   * proxy.ts bounced them back to the login page with no explanation, which
   * looked identical to a failed sign-up.
   */
  if (state.sent) {
    return (
      <Card>
        <h1 className="font-display text-[24px] text-ink">{t('auth.checkInboxTitle')}</h1>
        <p className="mt-2 text-[14.5px] leading-[1.7] text-ink2">
          {t('auth.checkInboxBody', { email: state.email ?? '' })}
        </p>
        {resent.notice ? (
          <p className="mt-3 rounded-xl bg-greentint px-3 py-2 text-[13.5px] font-extrabold text-green" role="status">
            {t(resent.notice)}
          </p>
        ) : null}
        {resent.error ? <div className="mt-3"><ErrorBanner message={resent.error} /></div> : null}

        {/* Without this, an email that went to spam is a dead end: they cannot
            sign in, and signing up again answers "already registered". */}
        <form action={resendAction} className="mt-4 flex flex-wrap items-center gap-2.5">
          <input type="hidden" name="email" value={state.email ?? ''} />
          <SubmitButton title={t('auth.resendConfirm')} variant="line" />
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-xl px-4 font-extrabold text-[14px] text-ink2 transition hover:text-teal"
          >
            {t('auth.backToLogin')}
          </Link>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="font-display text-[24px] text-ink">{t('auth.signUpTitle')}</h1>
      <p className="mb-4 mt-0.5 text-[14px] text-ink2">{t('auth.signUpSub')}</p>

      {state.error ? <ErrorBanner message={state.error} /> : null}

      <form action={action} onSubmit={() => setTouched(true)} noValidate>
        <input type="hidden" name="next" value={next ?? '/onboarding/class'} />
        {/* The teacher whose link brought them here. Also kept in a cookie by
            /r/CODE, so this being absent is not the end of the attribution. */}
        {ref ? <input type="hidden" name="ref" value={ref} /> : null}
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
          pendingTitle={t('auth.creatingAccount')}
          disabled={!canSubmit}
          className="w-full"
        />
      </form>

      <p className="mt-3 text-center text-[13px] text-ink2">
        {t('auth.haveAccountShort')}{' '}
        <Link href="/login" className="font-extrabold text-teal hover:underline">
          {t('auth.logIn')}
        </Link>
      </p>
    </Card>
  );
}
