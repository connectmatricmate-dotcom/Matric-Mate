import { useState } from 'react';
import { router } from 'expo-router';
import { ChoiceCard, StepScreen } from '../../src/components/OnboardingStep';
import { useT } from '../../src/i18n';
import { Medium } from '../../src/core/types';
import { useApp } from '../../src/store/app';

/**
 * Medium is which version of the FBISE syllabus the student studies — it changes
 * the content, not the interface. The app's own language is set separately.
 */
export default function ChooseMedium() {
  const { actions } = useApp();
  const t = useT();
  const [value, setValue] = useState<Medium>('en');

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
        onPress={() => setValue('en')}
      />
      <ChoiceCard
        title={t('onboarding.mediumUr')}
        urduTitle="اردو میڈیم"
        sub={t('onboarding.mediumUrSub')}
        selected={value === 'ur'}
        onPress={() => setValue('ur')}
      />
    </StepScreen>
  );
}
