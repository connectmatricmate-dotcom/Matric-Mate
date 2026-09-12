'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { type AuthState, resetPasswordAction } from '@/app/(auth)/actions';
import { useTouched } from '@/components/auth/useTouched';
import { ErrorBanner, Field, SubmitButton } from '@/components/ui/controls';
import { Card, Icon } from '@/components/ui/primitives';
import { useLang, useT } from '@/lib/store';
import { isFormValid, validateEmail } from '@/lib/validation';

/**
 * `linkProblem` is why an emailed link sent them back here: `expired` when
 * Supabase said so, `link` when it failed for another reason, such as a link
 * opened in a different browser from the one that asked for it.
 */
export function ForgotForm({ linkProblem }: { linkProblem?: 'expired' | 'link' }) {
  const t = useT();
  const { lang } = useLang();
  const [state, action] = useActionState<AuthState, FormData>(resetPasswordAction, {});
  const [email, setEmail] = useState('');
  const { touched, onBlur } = useTouched();

  const emailError = validateEmail(email, lang);

  if (state.sent) {
    return (
      <Card>
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-greentint text-green">
          <Icon name="check" size={24} strokeWidth={2.6} />
        </span>
        <h1 className="font-display text-[22px] text-ink">{t('auth.resetTitle')}</h1>
        {/* wrap-anywhere: the address is one long word, and a long one ran
            straight out of the card on a phone. */}
        <p className="mt-1 text-[14px] leading-[1.6] text-ink2 wrap-anywhere rtl:leading-[1.9]">
          {t('auth.resetSent', { contact: email })}
        </p>
        <p className="mt-3 text-[12px] text-ink3">{t('auth.resetFootnote')}</p>
        <Link href="/login" className="mt-2 inline-flex min-h-11 items-center text-[13px] font-extrabold text-teal hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="font-display text-[24px] text-ink">{t('auth.resetTitle')}</h1>
      <p className="mb-4 mt-0.5 text-[14px] text-ink2">{t('auth.resetSub')}</p>

      {/* Keyed on the attempt, so the same failure twice shows twice. */}
      {state.error ? (
        <ErrorBanner key={state.at} message={state.error} />
      ) : linkProblem ? (
        <ErrorBanner message={t(linkProblem === 'expired' ? 'auth.linkExpired' : 'auth.linkError')} />
      ) : null}

      <form action={action} onBlur={onBlur} noValidate>
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
        <SubmitButton
          title={t('auth.sendReset')}
          pendingTitle={t('auth.sending')}
          disabled={!isFormValid(emailError)}
          className="w-full"
        />
      </form>

      <Link
        href="/login"
        className="mt-2 inline-flex min-h-11 items-center text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
      >
        {t('auth.backToLogin')}
      </Link>
    </Card>
  );
}
