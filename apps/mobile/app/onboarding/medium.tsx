import { useState } from 'react';
import { router } from 'expo-router';
import { ChoiceCard, StepScreen } from '../../src/components/OnboardingStep';
import { useT } from '../../src/i18n';
import { Medium } from '@matricmate/core';
import { useApp } from '../../src/store/app';

/**
 * Medium is which version of the FBISE syllabus the student studies, it changes
 * the content, not the interface. The app's own language is set separately.
 */
export default function ChooseMedium() {
  const { state, actions } = useApp();
  const t = useT();
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
        // One choice, whole app: the interface and the syllabus both follow
        // this, so a student never ends up reading Urdu notes in an English
        // app or the reverse.
        actions.setOnboarding({ medium: value });
        actions.setLanguage(value);
        router.push('/onboarding/subjects');
      }}
    >
      <ChoiceCard
        title={t('onboarding.mediumEn')}
        sub={t('onboarding.mediumEnSub')}
        selected={value === 'en'}
        onPress={() => setValue('en')}
      />
      <ChoiceCard
        title={t('onboarding.mediumUr')}
        sub={t('onboarding.mediumUrSub')}
        selected={value === 'ur'}
        onPress={() => setValue('ur')}
      />
    </StepScreen>
  );
}
