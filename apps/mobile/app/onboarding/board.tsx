import { useState } from 'react';
import { router } from 'expo-router';
import type { Board } from '@matricmate/core';
import { ChoiceCard, StepScreen } from '../../src/components/OnboardingStep';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';

export default function ChooseBoard() {
  const { state, actions } = useApp();
  const t = useT();
  const [value, setValue] = useState<Board>(state.onboarding?.board ?? 'fbise');

  return (
    <StepScreen
      step={2}
      title={t('onboarding.boardTitle')}
      sub={t('onboarding.boardSub')}
      cta={t('common.continue')}
      onNext={() => {
        actions.setOnboarding({ board: value });
        router.push('/onboarding/medium');
      }}
    >
      <ChoiceCard
        title={t('onboarding.fbise')}
        sub={t('onboarding.fbiseSub')}
        selected={value === 'fbise'}
        onPress={() => setValue('fbise')}
      />
      <ChoiceCard
        title={t('onboarding.punjab')}
        sub={t('onboarding.punjabSub')}
        selected={value === 'punjab'}
        onPress={() => setValue('punjab')}
      />
    </StepScreen>
  );
}
