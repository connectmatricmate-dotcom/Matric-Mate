'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';
import { ChoiceCard, StepScreen } from './StepScreen';

export function ChooseClass() {
  const { actions } = useApp();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState<9 | 10>(9);

  return (
    <StepScreen
      step={1}
      title={t('onboarding.classTitle')}
      sub={t('onboarding.classSub')}
      cta={t('common.continue')}
      back={false}
      onNext={() => {
        actions.setOnboarding({ classLevel: value });
        router.push('/onboarding/board');
      }}
    >
      <ChoiceCard
        title={t('onboarding.class9')}
        sub={t('onboarding.class9Sub')}
        selected={value === 9}
        onClick={() => setValue(9)}
      />
      <ChoiceCard
        title={t('onboarding.class10')}
        sub={t('onboarding.class10Sub')}
        disabled
        disabledLabel={t('onboarding.comingSoon')}
        onClick={() => toast(t('onboarding.class10Toast'))}
      />
    </StepScreen>
  );
}
