import { useState } from 'react';
import { router } from 'expo-router';
import { ChoiceCard, StepScreen } from '../../src/components/OnboardingStep';
import { useApp } from '../../src/store/app';
import { Medium } from '../../src/core/types';
import { Small } from '../../src/components/ui';

export default function ChooseMedium() {
  const { actions } = useApp();
  const [value, setValue] = useState<Medium>('en');

  return (
    <StepScreen
      step={3}
      title="English ya Urdu medium?"
      sub="Notes and audio in your medium"
      cta="Continue"
      onNext={() => {
        actions.setOnboarding({ medium: value });
        actions.setSettings({ contentMedium: value });
        router.push('/onboarding/subjects');
      }}
    >
      <ChoiceCard
        title="English medium"
        sub="Notes, MCQs and audio in English"
        selected={value === 'en'}
        onPress={() => setValue('en')}
      />
      <ChoiceCard
        urduTitle="اردو میڈیم"
        urduSub="نوٹس، سوالات اور آڈیو اردو میں"
        selected={value === 'ur'}
        onPress={() => setValue('ur')}
      />
      <Small>You can switch medium per chapter later, and change this in Settings.</Small>
    </StepScreen>
  );
}
