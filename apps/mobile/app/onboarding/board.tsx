import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { boardName } from '@matricmate/core';
import type { Board } from '@matricmate/core';
import { ChoiceCard, StepScreen } from '../../src/components/OnboardingStep';
import { Confirm, useToast } from '../../src/components/ui';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';

export default function ChooseBoard() {
  const { state, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  /**
   * Reached from Edit profile ("Class and board") rather than the first run.
   * Then this is the last step: it goes back to the profile, instead of on
   * through medium and subjects and a second home screen stacked on the
   * first, which Android's back button walked back into.
   */
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';
  const [value, setValue] = useState<Board>(state.onboarding?.board ?? 'fbise');
  const [confirming, setConfirming] = useState(false);
  const [switching, setSwitching] = useState(false);
  /**
   * The board already on the account. Changing it costs what a class change
   * costs: the progress is the old syllabus's, so it starts over, on every
   * device. It used to be a plain choice, instant and silent, and the old
   * board's attempts, plan and downloads stayed behind pointing at chapters
   * the account could no longer open.
   */
  const current = state.user && state.onboarding?.subjects?.length ? state.onboarding.board : undefined;

  const forward = () => {
    if (editing) router.dismissTo('/account/edit');
    else router.push('/onboarding/medium');
  };
  /** Nothing chosen on the account yet: a tap is the answer (StepScreen auto). */
  const firstRun = !editing && !current;
  const pick = (v: Board) => {
    setValue(v);
    if (!firstRun) return;
    actions.setOnboarding({ board: v });
    setTimeout(forward, 180);
  };

  const change = () => {
    if (switching) return;
    setSwitching(true);
    void actions.switchBoard(value).then((r) => {
      setSwitching(false);
      setConfirming(false);
      if (r === 'ok') {
        toast(t('onboarding.boardChanged', { board: boardName(value, lang) }));
        forward();
      } else {
        toast(t('states.errorTitle'));
      }
    });
  };

  return (
    <>
      <StepScreen
        step={2}
        title={t('onboarding.boardTitle')}
        sub={t('onboarding.boardSub')}
        cta={t('common.continue')}
        auto={firstRun}
        onNext={() => {
          if (current && value !== current) {
            setConfirming(true);
            return;
          }
          // The very first choice, which costs nothing to change.
          actions.setOnboarding({ board: value });
          forward();
        }}
      >
        <ChoiceCard
          title={t('onboarding.fbise')}
          sub={t('onboarding.fbiseSub')}
          selected={value === 'fbise'}
          onPress={() => pick('fbise')}
        />
        <ChoiceCard
          title={t('onboarding.punjab')}
          sub={t('onboarding.punjabSub')}
          selected={value === 'punjab'}
          onPress={() => pick('punjab')}
        />
      </StepScreen>

      {/* The same kind of warning as a class change, because it costs the same. */}
      <Confirm
        visible={confirming}
        onClose={() => setConfirming(false)}
        title={t('onboarding.boardWarnTitle', { board: boardName(value, lang) })}
        body={t('onboarding.boardWarnBody', { board: boardName(value, lang) })}
        confirmLabel={t('tutor.classWarnCta')}
        cancelLabel={t('common.cancel')}
        tone="orange"
        loading={switching}
        onConfirm={change}
      />
    </>
  );
}
