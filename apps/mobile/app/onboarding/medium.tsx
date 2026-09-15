import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ChoiceCard, StepScreen } from '../../src/components/OnboardingStep';
import { needsDownloadIn } from '../../src/core/downloads';
import { useT } from '../../src/i18n';
import { Medium } from '@matricmate/core';
import { useApp } from '../../src/store/app';

/**
 * Medium is which version of the FBISE syllabus the student studies, it changes
 * the content, not the interface. The app's own language is set separately.
 */
export default function ChooseMedium() {
  const { state, actions } = useApp();
  const t = useT();
  /** From Edit profile: save and go back there, rather than on to subjects. */
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';
  // Opens on the medium they already study in, not always English.
  const [value, setValue] = useState<Medium>(state.onboarding?.medium ?? 'en');
  /**
   * Downloads this choice would leave unreadable offline: each is saved in
   * the language it was made in. Said before the switch, not found out on a
   * bus. Disk reads, so only when the choice or the list changes.
   */
  const stranded = useMemo(
    () => (value === state.settings.contentMedium ? 0 : needsDownloadIn(state.downloads, value).length),
    [value, state.settings.contentMedium, state.downloads],
  );

  // One choice, whole app: the interface and the syllabus both follow this,
  // so a student never ends up reading Urdu notes in an English app or the
  // reverse.
  const save = (v: Medium) => {
    actions.setOnboarding({ medium: v });
    actions.setLanguage(v);
    if (editing) router.back();
    else router.push('/onboarding/subjects');
  };
  const pick = (v: Medium) => {
    setValue(v);
    // The first run moves on at the tap (StepScreen auto). Edit profile asks
    // for Continue, since a change there can strand downloads.
    if (!editing) setTimeout(() => save(v), 180);
  };

  return (
    <StepScreen
      step={3}
      auto={!editing}
      title={t('onboarding.mediumTitle')}
      sub={t('onboarding.mediumSub')}
      cta={t('common.continue')}
      footnote={stranded ? t('downloads.languageNote') : t('onboarding.mediumFootnote')}
      onNext={() => save(value)}
    >
      <ChoiceCard
        title={t('onboarding.mediumEn')}
        sub={t('onboarding.mediumEnSub')}
        selected={value === 'en'}
        onPress={() => pick('en')}
      />
      <ChoiceCard
        title={t('onboarding.mediumUr')}
        sub={t('onboarding.mediumUrSub')}
        selected={value === 'ur'}
        onPress={() => pick('ur')}
      />
    </StepScreen>
  );
}
