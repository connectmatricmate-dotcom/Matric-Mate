'use client';

import { useRouter } from 'next/navigation';
import { useApp, useT } from '@/lib/store';
import { ChoiceCard, StepScreen } from './StepScreen';

export function ChooseBoard() {
  const { actions } = useApp();
  const t = useT();
  const router = useRouter();

  return (
    <StepScreen
      step={2}
      title={t('onboarding.boardTitle')}
      sub={t('onboarding.boardSub')}
      cta={t('common.continue')}
      onNext={() => {
        actions.setOnboarding({ board: 'fbise' });
        router.push('/onboarding/medium');
      }}
    >
      <ChoiceCard title={t('onboarding.fbise')} sub={t('onboarding.fbiseSub')} selected />
      <ChoiceCard
        title={t('onboarding.punjab')}
        sub={t('onboarding.punjabSub')}
        disabled
        disabledLabel={t('onboarding.comingSoon')}
      />
    </StepScreen>
  );
}
