import { useState } from 'react';
import { router } from 'expo-router';
import { ChoiceCard, StepScreen } from '../../src/components/OnboardingStep';
import { useToast } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';

export default function ChooseClass() {
  const { actions } = useApp();
  const t = useT();
  const toast = useToast();
  const [value, setValue] = useState<9 | 10>(9);

  return (
    <StepScreen
      step={1}
      title={t('onboarding.classTitle')}
      sub={t('onboarding.classSub')}
      cta={t('common.continue')}
      onNext={() => {
        actions.setOnboarding({ classLevel: value });
        router.push('/onboarding/board');
      }}
    >
      <ChoiceCard
        title={t('onboarding.class9')}
        sub={t('onboarding.class9Sub')}
        selected={value === 9}
        onPress={() => setValue(9)}
      />
      <ChoiceCard
        title={t('onboarding.class10')}
        sub={t('onboarding.class10Sub')}
        disabled
        disabledLabel={t('onboarding.comingSoon')}
        onPress={() => toast(t('onboarding.class10Toast'))}
      />
    </StepScreen>
  );
}
