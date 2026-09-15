import { formatDate, translate, type Language } from '@matricmate/core';
import type { Lapse } from '@/lib/store';

/**
 * What to say about an account without a running plan, on Settings and on the
 * subscription page: the free trial ended, the plan ended on a date, the plan
 * was switched off, or there never was one. Every one of these used to read
 * "No plan yet", which is only true of the last.
 */
export function lapseLines(lapse: Lapse | undefined, lang: Language): { title: string; sub: string; ended: boolean } {
  const date = (at: number) => formatDate(at, lang, { day: 'numeric', month: 'long', year: 'numeric' });
  if (lapse?.kind === 'trial') return { title: translate(lang, 'paused.trialTitle'), sub: translate(lang, 'access.endedOn', { date: date(lapse.at) }), ended: true };
  if (lapse?.kind === 'plan') return { title: translate(lang, 'paused.planTitle'), sub: translate(lang, 'paused.planBody', { date: date(lapse.at) }), ended: true };
  if (lapse?.kind === 'off') return { title: translate(lang, 'paused.noneTitle'), sub: translate(lang, 'paused.noneBody'), ended: false };
  return { title: translate(lang, 'account.freeMode'), sub: translate(lang, 'account.freeModeSub'), ended: false };
}
