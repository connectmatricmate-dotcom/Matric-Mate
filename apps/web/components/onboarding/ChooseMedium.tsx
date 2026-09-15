'use client';

/**
 * The medium the student studies in, which is also the app's language: one
 * switch for both, so nobody ends up reading Urdu notes in an English app or
 * the reverse.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Medium } from '@matricmate/core';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';
import { ChoiceCard, StepScreen, useAutoStep } from './StepScreen';
import { goBackTo } from '@/lib/nav-trail';

export function ChooseMedium({ edit = false }: { edit?: boolean }) {
  const { state, synced, actions } = useApp();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  // Opens on the medium they already study in, once the account has said
  // which, not on whatever the first render happened to see. See ChooseClass.
  const [picked, setPicked] = useState<Medium | null>(null);
  const value = picked ?? state.onboarding?.medium ?? state.settings.language;

  const save = async (v: Medium) => {
    // The language first, so the next screen already arrives in it.
    if (v !== state.settings.language) actions.setLanguage(v);
    if (!(await actions.setOnboarding({ medium: v }))) {
      toast(t('states.errorBody'));
      return;
    }
    if (edit) goBackTo(router, '/account/edit');
    else router.replace('/onboarding/subjects');
  };
  // The first run moves on at the click (StepScreen auto); Edit profile saves
  // with the button.
  const auto = useAutoStep<Medium>(!edit, synced, save);
  const going = auto.going;
  const pick = (v: Medium) => {
    setPicked(v);
    auto.pick(v);
  };

  return (
    <StepScreen
      auto={!edit}
      busy={going}
      step={3}
      title={t('onboarding.mediumTitle')}
      sub={t('onboarding.mediumSub')}
      cta={edit ? t('common.save') : t('common.continue')}
      footnote={t('onboarding.mediumFootnote')}
      backHref={edit ? '/account/edit' : '/onboarding/board'}
      edit={edit}
      waiting={!synced}
      onNext={() => save(value)}
    >
      <ChoiceCard
        title={t('onboarding.mediumEn')}
        sub={t('onboarding.mediumEnSub')}
        selected={value === 'en'}
        onClick={() => pick('en')}
      />
      <ChoiceCard
        title={t('onboarding.mediumUr')}
        sub={t('onboarding.mediumUrSub')}
        selected={value === 'ur'}
        onClick={() => pick('ur')}
      />
    </StepScreen>
  );
}
