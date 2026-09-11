'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Board } from '@matricmate/core';
import { useApp, useT } from '@/lib/store';
import { ChoiceCard, StepScreen } from './StepScreen';

export function ChooseBoard() {
  const { state, actions } = useApp();
  const t = useT();
  const router = useRouter();
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
        onClick={() => setValue('fbise')}
      />
      <ChoiceCard
        title={t('onboarding.punjab')}
        sub={t('onboarding.punjabSub')}
        selected={value === 'punjab'}
        onClick={() => setValue('punjab')}
      />
    </StepScreen>
  );
}
