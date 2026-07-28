import { router } from 'expo-router';
import { ChoiceCard, StepScreen } from '../../src/components/OnboardingStep';
import { useApp } from '../../src/store/app';

export default function ChooseBoard() {
  const { actions } = useApp();
  return (
    <StepScreen
      step={2}
      title="Your board?"
      sub="Syllabus and past papers follow your board"
      cta="Continue"
      onNext={() => {
        actions.setOnboarding({ board: 'fbise' });
        router.push('/onboarding/medium');
      }}
    >
      <ChoiceCard title="FBISE" sub="Federal Board — Islamabad" selected />
      <ChoiceCard title="Punjab Board" sub="BISE Lahore, Rawalpindi & more" disabled />
    </StepScreen>
  );
}
