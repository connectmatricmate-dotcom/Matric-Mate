'use client';

import { useSyncExternalStore } from 'react';
import { AI_QUOTA, formatDate, subjectById, subjectName, type IconName, type StringKey } from '@matricmate/core';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';
import { useApp, useLang, useT } from '@/lib/store';

const TIPS: [IconName, StringKey][] = [
  ['book', 'welcomeTrial.tipStudy'],
  ['target', 'welcomeTrial.tipPractice'],
  ['spark', 'welcomeTrial.tipAi'],
];

const seenKey = (userId: string) => `mm.welcomeTrial.${userId}`;

/*
 * "Seen" lives in this browser's storage, read through a tiny store so the
 * server renders nothing and the browser decides once it can look. Storage
 * that refuses (a private window) reads as not seen; "Got it" still hides the
 * card for the visit.
 */
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const hiddenThisVisit = new Set<string>();
const readSeen = (userId: string | null): boolean => {
  if (!userId) return true;
  if (hiddenThisVisit.has(userId)) return true;
  try {
    return localStorage.getItem(seenKey(userId)) === '1';
  } catch {
    return false;
  }
};
const markSeen = (userId: string) => {
  hiddenThisVisit.add(userId);
  try {
    localStorage.setItem(seenKey(userId), '1');
  } catch {
    // Nothing to keep it in; it goes for this visit.
  }
  listeners.forEach((fn) => fn());
};

/**
 * The first thing on the dashboard after the free trial starts: that it has,
 * which subject it opens and until when, and the three places worth knowing.
 * Once per account in this browser, gone at "Got it" or at "Start". The same
 * card as the Android app's (src/components/WelcomeTrial.tsx).
 *
 * Only on a trial: a student whose plan was switched on by hand has had
 * nothing start, and would read "your free trial is on" as a mistake.
 */
export function WelcomeTrial() {
  const t = useT();
  const { lang } = useLang();
  const { state, derived } = useApp();
  const access = derived.access;
  const userId = state.user?.id ?? null;
  // Hidden on the server render, so the card never flashes up and away.
  const seen = useSyncExternalStore(subscribe, () => readSeen(userId), () => true);

  if (access.tier !== 'trial' || !access.trialSubject || !userId || seen) return null;

  const subject = subjectName(subjectById(access.trialSubject), lang) || access.trialSubject;
  const until = access.validTill
    ? formatDate(access.validTill, lang, { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '';
  const firstName = (state.user?.name ?? '').trim().split(/\s+/)[0] ?? '';

  const done = () => markSeen(userId);

  return (
    <Card tint="bg-tealtint" border="border-teal">
      <h2 className="font-display text-[19px] text-ink">{t('welcomeTrial.title', { name: firstName })}</h2>
      <p className="mt-1 text-[14.5px] font-extrabold leading-[1.6] text-ink rtl:leading-[1.9]">{t('welcomeTrial.trialOn', { subject, date: until })}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {TIPS.map(([icon, key]) => (
          <li key={key} className="flex items-start gap-2.5">
            <Icon name={icon} size={17} className="mt-0.5 shrink-0 text-teal" />
            <span className="text-[13.5px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{t(key, { n: AI_QUOTA.trial })}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2" onClickCapture={(e) => (e.target as HTMLElement).closest('a') && done()}>
        <LinkBtn title={t('welcomeTrial.start', { subject })} href={`/learn/subject/${access.trialSubject}`} />
        <Btn title={t('welcomeTrial.dismiss')} variant="line" onClick={done} />
      </div>
    </Card>
  );
}
