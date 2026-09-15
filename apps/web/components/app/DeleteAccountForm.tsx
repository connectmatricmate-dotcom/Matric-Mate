'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SUPPORT_EMAIL } from '@matricmate/core';
import { Btn, ErrorBanner, Field } from '@/components/ui/controls';
import { Card } from '@/components/ui/primitives';
import { Confirm } from '@/components/ui/sheet';
import { useApp, useT } from '@/lib/store';
import { releaseWebPush } from '@/lib/web-push';

type Failure = 'offline' | 'signedOut' | 'failed';

/**
 * The part of the deletion screen that does it: type DELETE, press the red
 * button, say yes once more.
 *
 * Two deliberate steps, because it cannot be undone and the student is a
 * teenager on a phone: typing the word keeps a stray tap from starting it, and
 * the last question names what happens. Capitals are not required; the word
 * is. The server route deletes the login account (every study table goes with
 * it) and signs this browser out; the store then forgets the account here
 * too, and the student lands on the home page with a note saying it is done.
 */
export function DeleteAccountForm() {
  const t = useT();
  const { actions } = useApp();
  const [typed, setTyped] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const ready = typed.trim().toUpperCase() === 'DELETE';

  async function run() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    // While the session still proves who is handing this browser back.
    await releaseWebPush();
    let status = 0;
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      status = res.status;
      // The route's own `{ ok: true }`, not only a 200: anything else that
      // answered 200 would sign the student out over an account still there.
      const body = res.ok ? ((await res.json().catch(() => null)) as { ok?: unknown } | null) : null;
      if (res.ok && body?.ok !== true) status = 500;
      if (body?.ok === true) {
        actions.accountDeleted();
        // A full load, not a router push: the signed-in shell, its cache and
        // its live channel all belong to an account that no longer exists.
        window.location.replace('/?deleted=1');
        return;
      }
    } catch {
      status = 0;
    }
    setBusy(false);
    setAsking(false);
    setFailure(status === 0 ? 'offline' : status === 401 ? 'signedOut' : 'failed');
  }

  const message =
    failure === 'offline'
      ? t('deletion.offline')
      : failure === 'signedOut'
        ? t('account.delSignedOut')
        : failure === 'failed'
          ? t('account.delFailed', { email: SUPPORT_EMAIL })
          : '';

  return (
    <Card className="mt-3" border="border-red">
      {message ? <ErrorBanner message={message} onDismiss={() => setFailure(null)} /> : null}
      {failure === 'signedOut' ? (
        <Link href="/login?next=%2Faccount%2Fdelete" className="mb-3 inline-flex min-h-11 items-center text-[13.5px] font-extrabold text-teal hover:underline">
          {t('auth.logIn')}
        </Link>
      ) : null}
      <Field
        label={t('deletion.typeLabel')}
        value={typed}
        onChange={setTyped}
        placeholder={t('deletion.typePlaceholder')}
        autoComplete="off"
      />
      <Btn
        title={t('deletion.title')}
        variant="danger"
        icon="trash"
        disabled={!ready}
        onClick={() => setAsking(true)}
        className="w-full"
      />

      <Confirm
        open={asking}
        onClose={() => (busy ? undefined : setAsking(false))}
        title={t('deletion.confirmTitle')}
        body={t('deletion.confirmBody')}
        confirmLabel={t('deletion.confirmCta')}
        cancelLabel={t('account.delKeep')}
        loading={busy}
        onConfirm={() => void run()}
      />
    </Card>
  );
}
