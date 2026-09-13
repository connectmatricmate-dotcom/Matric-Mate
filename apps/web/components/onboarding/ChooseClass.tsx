'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Confirm } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { GRADE_10_READY } from '@matricmate/core';
import { createClient } from '@/lib/supabase/client';
import { useApp, useT } from '@/lib/store';
import { ChoiceCard, StepScreen } from './StepScreen';

/** How long a class change may be corrected without the cooldown. Migration 0014. */
const CORRECTION_MS = 30 * 60 * 1000;

export function ChooseClass({ edit = false }: { edit?: boolean }) {
  const { state, synced, actions } = useApp();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  /**
   * The class already on the account, if there is one. This screen is two
   * screens: step one of a first run, and the editor reached from the profile.
   * Picking a class you do not have yet is free; changing one you do costs the
   * student their progress and starts a seven day cooldown, and only
   * switchClass knows how to do that safely.
   */
  const current = state.onboarding?.classLevel;
  /*
   * What the student tapped, kept apart from what the account says. Seeding
   * one state from the other on the first render read the store before it had
   * loaded, so after a refresh a Class 10 student saw Class 9 selected and
   * was asked to confirm switching to it.
   */
  const [picked, setPicked] = useState<9 | 10 | null>(null);
  const value = picked ?? current ?? 9;
  const [confirming, setConfirming] = useState(false);
  const [switching, setSwitching] = useState(false);
  const next = edit ? '/onboarding/board?edit=1' : '/onboarding/board';

  /**
   * A second change inside half an hour of the first is the same decision
   * being corrected, and the server allows it without a cooldown. Before any
   * study there is also nothing to lose, so a student who picked Class 10,
   * walked on and came back is not shown the warning about losing progress
   * and waiting a week, neither of which applies to them.
   */
  const isCorrection = async (): Promise<boolean> => {
    const studied = state.attempts.length || state.readSections.length || state.results.length || state.cardsKnown.length;
    if (studied || !state.user) return false;
    const { data, error } = await createClient()
      .from('profiles')
      .select('grade_changed_at')
      .eq('id', state.user.id)
      .maybeSingle();
    if (error || !data) return false;
    if (!data.grade_changed_at) return true;
    return Date.now() - Date.parse(data.grade_changed_at as string) < CORRECTION_MS;
  };

  /**
   * Changing an existing class goes through switchClass, exactly as the
   * account screen does.
   *
   * It used to go through setOnboarding, which writes the grade to the profile
   * fire and forget. Inside the cooldown the server rejected that write, the
   * app never looked, and the two disagreed until the next hydration resolved
   * it by clearing local progress. No warning before, no message after.
   */
  const change = async () => {
    if (switching) return;
    setSwitching(true);
    const r = await actions.switchClass(value);
    setSwitching(false);
    setConfirming(false);
    if (r === 'ok') {
      toast(t('tutor.classChanged', { n: value }));
      if (edit) router.push(next);
      else router.replace(next);
    } else {
      toast(r === 'cooldown' ? t('tutor.classCooldown') : t('states.errorTitle'));
    }
  };

  return (
    <>
      <StepScreen
        step={1}
        title={t('onboarding.classTitle')}
        sub={t('onboarding.classSub')}
        cta={t('common.continue')}
        backHref={edit ? '/account/edit' : undefined}
        edit={edit}
        waiting={!synced}
        onNext={async () => {
          if (current && value !== current) {
            if (await isCorrection()) await change();
            else setConfirming(true);
            return;
          }
          // Waited on, not fired and forgotten. The class is what row level
          // security serves content by, and a lost write here left the
          // student on Class 9 content with Class 10 on screen.
          if (!(await actions.setOnboarding({ classLevel: value }))) {
            toast(t('states.errorBody'));
            return;
          }
          if (edit) router.push(next);
          else router.replace(next);
        }}
      >
        <ChoiceCard
          title={t('onboarding.class9')}
          sub={t('onboarding.class9Sub')}
          selected={value === 9}
          onClick={() => setPicked(9)}
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
          onClick={() => (GRADE_10_READY ? setPicked(10) : toast(t('onboarding.class10Toast')))}
        />
      </StepScreen>

      {/* The same warning the account screen shows, because it is the same
          decision and it costs the same. */}
      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('tutor.classWarnTitle', { n: value })}
        body={t('tutor.classWarnBody')}
        confirmLabel={t('tutor.classWarnCta')}
        cancelLabel={t('common.cancel')}
        tone="orange"
        loading={switching}
        onConfirm={() => void change()}
      />
    </>
  );
}
