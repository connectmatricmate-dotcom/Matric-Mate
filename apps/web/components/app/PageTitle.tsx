'use client';

/**
 * Page heading. A client leaf because the copy comes from the language the user
 * picked, everything around it can stay on the server.
 */
import type { StringKey } from '@matricmate/core';
import { useApp, useT } from '@/lib/store';

export function PageTitle({
  titleKey,
  subKey,
  title,
  sub,
}: {
  titleKey?: StringKey;
  /** `"setup"` prints the student's class · board · medium line. */
  subKey?: StringKey | 'setup';
  title?: string;
  sub?: string;
}) {
  const t = useT();
  const { state } = useApp();

  let eyebrow = sub;
  if (subKey === 'setup') {
    const setup = state.onboarding;
    eyebrow = setup
      ? t('study.setupLine', {
          class: setup.classLevel,
          board: setup.board === 'fbise' ? 'FBISE' : 'Punjab Board',
          medium: setup.medium === 'en' ? 'English' : 'Urdu',
        })
      : undefined;
  } else if (subKey) {
    eyebrow = t(subKey);
  }

  return (
    <div className="mb-4">
      {eyebrow ? <p className="text-[12.5px] font-extrabold uppercase tracking-[0.07em] text-ink3">{eyebrow}</p> : null}
      <h1 className="font-display text-[27px] text-ink">{titleKey ? t(titleKey) : title}</h1>
    </div>
  );
}
