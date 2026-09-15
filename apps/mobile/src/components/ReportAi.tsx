import { useState } from 'react';
import { View } from 'react-native';
import { reportAiAnswer } from '@matricmate/core';
import type { AiReportReason, AiReportSurface } from '@matricmate/core';
import { useT } from '../i18n';
import type { StringKey } from '../i18n';
import { supabase } from '../lib/supabase';
import { C, F, S } from '../theme';
import { Icon } from './Icon';
import { Btn, Check, Field, Item, Pill, Row, Sheet, Small, Spacer, Tap, Text, useToast } from './ui';

const REASONS: [AiReportReason, StringKey][] = [
  ['wrong', 'report.wrong'],
  ['offensive', 'report.offensive'],
  ['unsafe', 'report.unsafe'],
  ['other', 'report.other'],
];

/**
 * "Report" on an AI answer, and the sheet it opens.
 *
 * Google Play requires every app that generates content with AI to let people
 * report offensive output without leaving the app. Every AI surface carries
 * this: the tutor's answers, AI tests, mock papers, revision sheets, answer
 * checking, the coach and career guidance. A report is a row the admin panel
 * lists, with the answer cut short beside it, since the conversation it came
 * from may be gone by the time someone reads it.
 *
 * `pill` sits in a row of other pills (the tutor's answers); `link` is a quiet
 * line at the end of a longer piece of AI output.
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
    const ok = await reportAiAnswer(supabase, { surface, reason, ref: refId, excerpt, note });
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
      {variant === 'pill' ? (
        <Pill tone="grey" icon="alert" onPress={() => setOpen(true)}>
          {t('report.button')}
        </Pill>
      ) : (
        <Tap onPress={() => setOpen(true)} label={t('report.title')}>
          <Row gap={6} style={{ alignItems: 'center', paddingVertical: 10, alignSelf: 'flex-start' }}>
            <Icon name="alert" size={14} color={C.ink3} />
            <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: C.ink3 }}>{t('report.title')}</Text>
          </Row>
        </Tap>
      )}

      <Sheet visible={open} onClose={close} title={t('report.title')}>
        <Small style={{ color: C.ink2 }}>{t('report.sub')}</Small>
        <Spacer h={S.md} />
        <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
          {REASONS.map(([value, key], i) => (
            <Item
              key={value}
              title={t(key)}
              last={i === REASONS.length - 1}
              onPress={() => setReason(value)}
              checked={reason === value}
              right={<Check on={reason === value} round />}
            />
          ))}
        </View>
        <Spacer h={S.md} />
        <Field label={t('report.notePlaceholder')} value={note} onChangeText={(v) => setNote(v.slice(0, 500))} placeholder="" />
        <Spacer h={S.md} />
        <Btn title={t('report.send')} disabled={!reason} loading={busy} onPress={() => void send()} />
      </Sheet>
    </>
  );
}
