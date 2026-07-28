'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@matricmate/core';
import { Btn, ErrorBanner, Field } from '@/components/ui/controls';
import { Card, Icon } from '@/components/ui/primitives';
import { useT } from '@/lib/store';
import { isFormValid, validateContact } from '@/lib/validation';

export function ForgotForm() {
  const t = useT();
  const [contact, setContact] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactError = validateContact(contact);
  const canSubmit = isFormValid(contactError);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await api.requestPasswordReset(contact);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the link.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-greentint text-green">
          <Icon name="check" size={24} strokeWidth={2.6} />
        </span>
        <h1 className="font-display text-[22px] text-ink">{t('auth.resetTitle')}</h1>
        <p className="mt-1 text-[14px] text-ink2">{t('auth.resetSent', { contact })}</p>
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
        <Btn title={t('auth.sendReset')} type="submit" loading={busy} disabled={!canSubmit} className="w-full" />
      </form>

      <Link href="/login" className="mt-3 inline-block text-[13px] font-extrabold text-ink2 hover:text-teal">
        {t('auth.backToLogin')}
      </Link>
    </Card>
  );
}
