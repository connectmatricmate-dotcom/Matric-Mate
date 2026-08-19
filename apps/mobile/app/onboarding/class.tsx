import { useState } from 'react';
import { router } from 'expo-router';
import { ChoiceCard, StepScreen } from '../../src/components/OnboardingStep';
import { Confirm, useToast } from '../../src/components/ui';
import { GRADE_10_READY } from '@matricmate/core';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';

export default function ChooseClass() {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  /**
   * The class already on the account, if there is one. This screen is two
   * screens: step one of a first run, and the editor reached from the profile.
   * Picking a class you do not have yet is free; changing one you do costs the
   * student their progress and starts a seven day cooldown, and only
   * switchClass knows how to do that safely.
   */
  const current = state.onboarding?.classLevel;
  const [value, setValue] = useState<9 | 10>(current ?? 9);
  const [confirming, setConfirming] = useState(false);
  const [switching, setSwitching] = useState(false);

  const forward = () => router.push('/onboarding/board');

  /**
   * Changing an existing class goes through switchClass, exactly as the
   * settings screen does.
   *
   * It used to go through setOnboarding, which writes the grade to the profile
   * fire and forget. Inside the cooldown the server rejected that write, the
   * app never looked, and the two disagreed until the next hydration resolved
   * it by deleting every downloaded chapter and resetting local progress. No
   * warning before, no message after.
   */
  const change = () => {
    if (switching) return;
    setSwitching(true);
    void actions.switchClass(value).then((r) => {
      setSwitching(false);
      setConfirming(false);
      if (r === 'ok') {
        toast(t('tutor.classChanged', { n: value }));
        forward();
      } else {
        toast(r === 'cooldown' ? t('tutor.classCooldown') : t('states.errorTitle'));
      }
    });
  };

  return (
    <>
      <StepScreen
        step={1}
        title={t('onboarding.classTitle')}
        sub={t('onboarding.classSub')}
        cta={t('common.continue')}
        onNext={() => {
          if (current && value !== current) {
            setConfirming(true);
            return;
          }
          actions.setOnboarding({ classLevel: value });
          forward();
        }}
      >
        <ChoiceCard
          title={t('onboarding.class9')}
          sub={t('onboarding.class9Sub')}
          selected={value === 9}
          onPress={() => setValue(9)}
        />
        {/* Class 10 is a real choice the day its catalogue ships. Hardcoding
            the card shut meant a Class 10 student had to sign up as Class 9
            and then switch, which costs them their progress and a cooldown. */}
        <ChoiceCard
          title={t('onboarding.class10')}
          sub={t('onboarding.class10Sub')}
          selected={value === 10}
          disabled={!GRADE_10_READY}
          disabledLabel={GRADE_10_READY ? undefined : t('onboarding.comingSoon')}
          onPress={() => (GRADE_10_READY ? setValue(10) : toast(t('onboarding.class10Toast')))}
        />
      </StepScreen>

      {/* The same warning the settings screen shows, because it is the same
          decision and it costs the same. */}
      <Confirm
        visible={confirming}
        onClose={() => setConfirming(false)}
        title={t('tutor.classWarnTitle', { n: value })}
        body={t('tutor.classWarnBody')}
        confirmLabel={t('tutor.classWarnCta')}
        cancelLabel={t('common.cancel')}
        tone="orange"
        loading={switching}
        onConfirm={change}
      />
    </>
  );
}
