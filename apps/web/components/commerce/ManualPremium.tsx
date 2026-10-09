'use client';

import { useEffect, useState } from 'react';
import { Btn } from '@/components/ui/controls';
import { Card, Icon } from '@/components/ui/primitives';
import { PAY_ACCOUNTS, PAY_WHATSAPP, whatsappLink } from '@/lib/manual-pay';
import { THE_PLAN, rupees } from '@/lib/plans';
import { useApp, useT } from '@/lib/store';

type Status = 'sending' | 'received' | 'already' | 'failed';

/**
 * Premium while plans are switched on by hand: the request and how to pay.
 *
 * Opening this is the request. It tells the team (lib/plan-requests.ts) and
 * shows the student the three steps: send the price to one of the accounts,
 * send the screenshot on WhatsApp, Premium is on within 5 minutes. Asking
 * again is harmless: the server answers with the request already open.
 *
 * The details show whether or not the request got through. A student who has
 * the accounts and the number can still pay and send the screenshot, and the
 * screenshot on WhatsApp is what the team acts on in the end.
 */
export function ManualPremium({ bare }: { /** No heading, where the page's own says it. */ bare?: boolean }) {
  const t = useT();
  const { state } = useApp();
  const [status, setStatus] = useState<Status>('sending');
  const amount = rupees(THE_PLAN.price);
  const account = state.user?.contact ?? '';

  // Starts at 'sending', and the answer is set from the request's callback.
  useEffect(() => {
    let live = true;
    void askForPremium().then((next) => {
      if (live) setStatus(next);
    });
    return () => {
      live = false;
    };
  }, []);

  const retry = () => {
    setStatus('sending');
    void askForPremium().then(setStatus);
  };

  if (status === 'already') {
    return (
      <Card flat tint="bg-greentint" border="border-green">
        <p className="text-[14px] font-extrabold text-ink">{t('manualPay.already')}</p>
      </Card>
    );
  }

  const steps = [
    t('manualPay.step1', { amount }),
    t('manualPay.step2', { whatsapp: PAY_WHATSAPP }),
    t('manualPay.step3'),
  ];

  return (
    <Card flat tint="bg-tealtint" border="border-tealtint2">
      {bare ? null : <p className="font-display text-[18px] text-ink">{t('manualPay.title')}</p>}

      <p
        role={status === 'failed' ? 'alert' : 'status'}
        className={`text-[13px] font-extrabold ${bare ? '' : 'mt-1.5'} ${status === 'failed' ? 'text-red' : 'text-teal'}`}
      >
        {status === 'sending' ? t('manualPay.requesting') : status === 'failed' ? t('manualPay.failed') : t('manualPay.received')}
      </p>
      {status === 'failed' ? (
        <div className="mt-2">
          <Btn title={t('common.retry')} variant="line" sm icon="refresh" onClick={retry} />
        </div>
      ) : null}

      <ol className="mt-3 flex flex-col gap-2">
        {steps.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal text-[11px] font-extrabold text-onbrand">
              {i + 1}
            </span>
            <span className="text-[13.5px] leading-[1.6] text-ink rtl:leading-[1.9]">{line}</span>
          </li>
        ))}
      </ol>

      <ul className="mt-4 flex flex-col gap-2">
        {PAY_ACCOUNTS.map((a) => (
          <AccountRow key={a.number} method={a.method} title={a.title} number={a.number} />
        ))}
      </ul>

      <a
        href={whatsappLink(t('manualPay.waMessage', { amount, account }))}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-teal px-4 text-[13.5px] font-extrabold text-onbrand transition-[filter] duration-200 hover:brightness-110 sm:w-auto"
      >
        <Icon name="whatsapp" size={16} />
        {t('manualPay.whatsapp')}
      </a>
      {status === 'received' && account.includes('@') ? <p className="mt-2.5 text-[12.5px] text-ink2">{t('manualPay.emailed')}</p> : null}
    </Card>
  );
}

/** Ask for Premium (POST /api/plan-request) and say how it went. */
async function askForPremium(): Promise<Status> {
  try {
    const res = await fetch('/api/plan-request', { method: 'POST' });
    const body = (await res.json().catch(() => ({}))) as { state?: string };
    return !res.ok ? 'failed' : body.state === 'already' ? 'already' : 'received';
  } catch {
    return 'failed';
  }
}

/** One account, with its number in the Latin face and a button that copies it. */
function AccountRow({ method, title, number }: { method: string; title: string; number: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // The clipboard refused (an in-app browser, an old one): the number is
      // on screen and selectable, which is what this button saves typing.
    }
  }

  return (
    <li className="flex items-center gap-3 rounded-[12px] border border-line bg-card px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-extrabold text-ink">{method}</span>
        <span className="latin block select-all text-[15px] tracking-[0.02em] text-ink wrap-anywhere">{number}</span>
        <span className="block text-[12px] text-ink2">
          {t('manualPay.accountName')}: <span className="latin">{title}</span>
        </span>
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-teal px-3 text-[12.5px] font-extrabold text-teal transition-colors duration-200 hover:bg-tealtint"
      >
        <Icon name={copied ? 'check' : 'doc'} size={14} />
        {copied ? t('manualPay.copied') : t('manualPay.copy')}
      </button>
    </li>
  );
}
