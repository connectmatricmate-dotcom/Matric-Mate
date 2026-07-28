import { useState } from 'react';
import { router } from 'expo-router';
import { ChoiceCard, StepScreen } from '../../src/components/OnboardingStep';
import { useApp } from '../../src/store/app';
import { useToast } from '../../src/components/ui';

export default function ChooseClass() {
  const { actions } = useApp();
  const toast = useToast();
  const [value, setValue] = useState<9 | 10>(9);

  return (
    <StepScreen
      step={1}
      title="Which class are you in?"
      sub="We’ll load your exact syllabus"
      cta="Continue"
      onNext={() => {
        actions.setOnboarding({ classLevel: value });
        router.push('/onboarding/board');
      }}
    >
      <ChoiceCard title="Class 9" sub="Matric part one — start strong" selected={value === 9} onPress={() => setValue(9)} />
      <ChoiceCard
        title="Class 10"
        sub="Matric part two"
        disabled
        onPress={() => toast('Class 10 comes after the Class 9 launch.')}
      />
    </StepScreen>
  );
}
