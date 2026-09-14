'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { type AuthState, resendConfirmationAction, signUpAction } from '@/app/(auth)/actions';
import { useTouched } from '@/components/auth/useTouched';
import { ErrorBanner, Field, SubmitButton } from '@/components/ui/controls';
import { Card } from '@/components/ui/primitives';
import { useLang, useT } from '@/lib/store';
import { isFormValid, validateEmail, validateMobile, validateName, validatePassword, validateSchool } from '@/lib/validation';

export function SignUpForm({ next, referral }: { next?: string; referral?: string }) {
  const t = useT();
  const { lang } = useLang();
  const [state, action] = useActionState<AuthState, FormData>(signUpAction, {});
  const [resent, resendAction] = useActionState<AuthState, FormData>(resendConfirmationAction, {});

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [school, setSchool] = useState('');
  const { touched, onBlur } = useTouched();

  const nameError = validateName(name, lang);
  const emailError = validateEmail(email, lang);
  const passwordError = validatePassword(password, lang);
  const mobileError = validateMobile(mobile, lang);
  const schoolError = validateSchool(school, lang);
  const canSubmit = isFormValid(nameError, emailError, passwordError, mobileError, schoolError);

  // The agreement line links its "Terms and Privacy Policy". The translated
  // sentence is split on its placeholder so the link sits wherever each
  // language puts it, the way the checkout does it.
  const agreeLine = t('checkout.agreeTerms').split('{terms}');

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
        {/* wrap-anywhere: the address is one long word, and a long one ran
            straight out of the card on a phone. */}
        <p className="mt-2 text-[14.5px] leading-[1.7] text-ink2 wrap-anywhere rtl:leading-[1.9]">
          {t('auth.checkInboxBody', { email: state.email ?? '' })}
        </p>
        {resent.notice ? (
          <p className="mt-3 rounded-xl bg-greentint px-3 py-2 text-[13.5px] font-extrabold text-green" role="status">
            {t(resent.notice)}
          </p>
        ) : null}
        {resent.error ? (
          <div className="mt-3">
            <ErrorBanner key={resent.at} message={resent.error} />
          </div>
        ) : null}

        {/* Without this, an email that went to spam is a dead end: they cannot
            sign in, and signing up again answers "already registered". */}
        <form action={resendAction} className="mt-4 flex flex-wrap items-center gap-2.5">
          <input type="hidden" name="email" value={state.email ?? ''} />
          <SubmitButton title={t('auth.resendConfirm')} variant="line" />
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-xl px-4 font-extrabold text-[14px] text-ink2 transition hover:text-teal"
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

      {/* Keyed on the attempt, so the same failure twice shows twice. */}
      {state.error ? <ErrorBanner key={state.at} message={state.error} /> : null}

      <form action={action} onBlur={onBlur} noValidate>
        <input type="hidden" name="next" value={next ?? '/onboarding/class'} />
        {/* The teacher whose link brought them here. Also kept in a cookie by
            /r/CODE, so this being absent is not the end of the attribution.

            Called `referral`, not `ref`. React reserves `ref`, and handing a
            prop by that name across the server-to-client boundary threw before
            the form rendered at all: every referral link led to "This screen
            could not load" instead of a signup page. The form field keeps the
            name `ref` because that is what the server action reads. */}
        {referral ? <input type="hidden" name="ref" value={referral} /> : null}
        <Field
          label={t('auth.fullName')}
          name="name"
          value={name}
          onChange={setName}
          placeholder={t('auth.namePlaceholder')}
          icon="user"
          autoComplete="name"
          required
          error={touched.name ? (nameError ?? undefined) : undefined}
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
          error={touched.email ? (emailError ?? undefined) : undefined}
        />
        {/* Asked here so it is never asked at checkout. Safepay will not
            create the payer record that fills their form in without a number,
            so without this a student types their email out again on a phone
            keyboard at the moment they are deciding whether to buy. */}
        <Field
          label={t('auth.mobile')}
          name="mobile"
          value={mobile}
          onChange={setMobile}
          placeholder={t('auth.mobilePlaceholder')}
          icon="phone"
          type="tel"
          autoComplete="tel"
          required
          error={touched.mobile ? (mobileError ?? undefined) : undefined}
        />
        {/* Optional, and said so in the label. The client counts students by
            school and plans school batches from it; nobody should be kept
            from studying for not wanting to say. */}
        <Field
          label={t('auth.school')}
          name="school"
          value={school}
          onChange={setSchool}
          placeholder={t('auth.schoolPlaceholder')}
          icon="gradCap"
          autoComplete="organization"
          error={touched.school ? (schoolError ?? undefined) : undefined}
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
          error={touched.password ? (passwordError ?? undefined) : undefined}
        />
        {/* A new tab, so reading the terms does not cost them the form. */}
        <p className="mb-3 text-[12px] leading-[1.6] text-ink2 rtl:leading-[1.9]">
          {agreeLine[0]}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold text-teal hover:underline"
          >
            {t('checkout.termsLink')}
          </Link>
          {agreeLine[1]}
        </p>
        <SubmitButton
          title={t('auth.createAccount')}
          pendingTitle={t('auth.creatingAccount')}
          disabled={!canSubmit}
          className="w-full"
        />
      </form>

      <p className="mt-1 text-center text-[13px] text-ink2">
        {t('auth.haveAccountShort')}{' '}
        <Link href="/login" className="inline-flex min-h-11 items-center font-extrabold text-teal hover:underline">
          {t('auth.logIn')}
        </Link>
      </p>
    </Card>
  );
}
