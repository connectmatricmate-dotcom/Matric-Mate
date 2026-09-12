'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { boardName, type Board } from '@matricmate/core';
import { Confirm } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useApp, useLang, useT } from '@/lib/store';
import { ChoiceCard, StepScreen } from './StepScreen';

export function ChooseBoard({ edit = false }: { edit?: boolean }) {
  const { state, synced, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  /**
   * The board this account is on, when it is on one. An account from before
   * boards existed has none saved, and the database serves it FBISE, so if it
   * has any history that history is FBISE's and moving off it is a change,
   * not a first choice.
   */
  const studied = Boolean(state.attempts.length || state.readSections.length || state.results.length || state.cardsKnown.length);
  const current: Board | undefined = state.onboarding?.board ?? (studied ? 'fbise' : undefined);
  // What the student tapped, apart from what the account says. See ChooseClass.
  const [picked, setPicked] = useState<Board | null>(null);
  const value = picked ?? current ?? 'fbise';
  const [confirming, setConfirming] = useState(false);
  const [switching, setSwitching] = useState(false);
  const next = edit ? '/account/edit' : '/onboarding/medium';

  /*
   * Changing a board the account already has is the same kind of decision as
   * changing class: a different syllabus, and the history of the old one
   * cannot follow. It used to be one more onboarding write, with no warning,
   * nothing wiped and nothing reset, which left this browser planning around
   * chapters the database had stopped serving.
   */
  const change = async () => {
    if (switching) return;
    setSwitching(true);
    const r = await actions.switchBoard(value);
    setSwitching(false);
    setConfirming(false);
    if (r !== 'ok') {
      toast(t('states.errorTitle'));
      return;
    }
    toast(t('onboarding.boardChanged', { board: boardName(value, lang) }));
    router.push(next);
  };

  return (
    <>
      <StepScreen
        step={2}
        title={t('onboarding.boardTitle')}
        sub={t('onboarding.boardSub')}
        cta={edit ? t('common.save') : t('common.continue')}
        backHref={edit ? '/onboarding/class?edit=1' : '/onboarding/class'}
        waiting={!synced}
        onNext={async () => {
          if (current && value !== current) {
            setConfirming(true);
            return;
          }
          if (!(await actions.setOnboarding({ board: value }))) {
            toast(t('states.errorBody'));
            return;
          }
          router.push(next);
        }}
      >
        <ChoiceCard
          title={t('onboarding.fbise')}
          sub={t('onboarding.fbiseSub')}
          selected={value === 'fbise'}
          onClick={() => setPicked('fbise')}
        />
        <ChoiceCard
          title={t('onboarding.punjab')}
          sub={t('onboarding.punjabSub')}
          selected={value === 'punjab'}
          onClick={() => setPicked('punjab')}
        />
      </StepScreen>

      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('onboarding.boardWarnTitle', { board: boardName(value, lang) })}
        body={t('onboarding.boardWarnBody', { board: boardName(value, lang) })}
        confirmLabel={t('tutor.classWarnCta')}
        cancelLabel={t('common.cancel')}
        tone="orange"
        loading={switching}
        onConfirm={() => void change()}
      />
    </>
  );
}
