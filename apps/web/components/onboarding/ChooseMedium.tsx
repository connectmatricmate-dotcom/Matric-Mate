'use client';

/**
 * Medium is which version of the FBISE syllabus the student studies, it changes
 * the content, not the interface. The app's own language is set separately.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Medium } from '@matricmate/core';
import { useApp, useT } from '@/lib/store';
import { ChoiceCard, StepScreen } from './StepScreen';

export function ChooseMedium() {
  const { state, actions } = useApp();
  const t = useT();
  const router = useRouter();
  // Opens on the medium they already study in, not always English.
  const [value, setValue] = useState<Medium>(state.onboarding?.medium ?? 'en');

  return (
    <StepScreen
      step={3}
      title={t('onboarding.mediumTitle')}
      sub={t('onboarding.mediumSub')}
      cta={t('common.continue')}
      footnote={t('onboarding.mediumFootnote')}
      onNext={() => {
        actions.setOnboarding({ medium: value });
        actions.setSettings({ contentMedium: value });
        router.push('/onboarding/subjects');
      }}
    >
      <ChoiceCard
        title={t('onboarding.mediumEn')}
        sub={t('onboarding.mediumEnSub')}
        selected={value === 'en'}
        onClick={() => setValue('en')}
      />
      <ChoiceCard
        title={t('onboarding.mediumUr')}
        sub={t('onboarding.mediumUrSub')}
        selected={value === 'ur'}
        onClick={() => setValue('ur')}
      />
    </StepScreen>
  );
}
