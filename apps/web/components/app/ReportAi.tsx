'use client';

import { useState } from 'react';
import { reportAiAnswer, type AiReportReason, type AiReportSurface, type StringKey } from '@matricmate/core';
import { Btn, Field } from '@/components/ui/controls';
import { Check, Icon } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useT } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';

const REASONS: [AiReportReason, StringKey][] = [
  ['wrong', 'report.wrong'],
  ['offensive', 'report.offensive'],
  ['unsafe', 'report.unsafe'],
  ['other', 'report.other'],
];

/**
 * "Report" on an AI answer, and the sheet it opens. The same control as the
 * Android app's (src/components/ReportAi.tsx): Google Play requires an app that
 * generates content with AI to let people report it without leaving the app,
 * and the website keeps parity. Reports are listed at /admin/reports.
 *
 * `pill` sits among other small actions (the tutor's answers); `link` is a
 * quiet line at the end of a longer piece of AI output.
 */
export function ReportAi({
  surface,
  refId,
  excerpt,
  variant = 'link',
}: {
  surface: AiReportSurface;
  refId?: string | null;
  excerpt?: string | null;
  variant?: 'pill' | 'link';
}) {
  const t = useT();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<AiReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setReason(null);
    setNote('');
  };

  async function send() {
    if (!reason || busy) return;
    setBusy(true);
    const ok = await reportAiAnswer(createClient(), { surface, reason, ref: refId, excerpt, note });
    setBusy(false);
    if (!ok) {
      toast(t('report.failed'));
      return;
    }
    toast(t('report.sent'));
    setOpen(false);
    setReason(null);
    setNote('');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === 'pill'
            ? 'inline-flex min-h-9 items-center gap-1.5 rounded-full bg-grey px-3 text-[12.5px] font-extrabold text-ink2 transition-[filter] duration-200 hover:brightness-95'
            : 'inline-flex min-h-10 items-center gap-1.5 self-start text-[12.5px] font-extrabold text-ink3 transition-colors duration-200 hover:text-ink2'
        }
      >
        <Icon name="alert" size={14} />
        {variant === 'pill' ? t('report.button') : t('report.title')}
      </button>

      <Sheet open={open} onClose={close} title={t('report.title')}>
        <p className="text-[13.5px] text-ink2">{t('report.sub')}</p>
        <div role="radiogroup" aria-label={t('report.title')} className="mt-4 overflow-hidden rounded-[14px] border border-line">
          {REASONS.map(([value, key], i) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={reason === value}
              onClick={() => setReason(value)}
              className={`flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-start text-[14px] font-extrabold text-ink transition-colors duration-200 hover:bg-paper ${
                i < REASONS.length - 1 ? 'border-b border-line' : ''
              }`}
            >
              <span className="flex-1">{t(key)}</span>
              <Check on={reason === value} round />
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Field label={t('report.notePlaceholder')} value={note} onChange={(v) => setNote(v.slice(0, 500))} placeholder="" />
        </div>
        <Btn title={t('report.send')} onClick={() => void send()} disabled={!reason} loading={busy} className="mt-4 w-full" />
      </Sheet>
    </>
  );
}
