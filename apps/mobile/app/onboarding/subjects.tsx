import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ChoiceCard, StepScreen } from '../../src/components/OnboardingStep';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, Check, Header, Item, Screen, SectionTitle, Small, useToast } from '../../src/components/ui';
import { SUBJECTS, subjectById, subjectName, subjectsForScience } from '@matricmate/core';
import type { ScienceChoice } from '@matricmate/core';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';
import { resetTo } from '../../src/core/nav';

export default function ChooseSubjects() {
  const { state, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  /** From Edit profile: save and go back there. */
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1';
  const compulsory = useMemo(() => SUBJECTS.filter((s) => s.compulsory), []);
  /**
   * Every elective we carry belongs to the science group. The picker used to
   * offer an Arts tab that filtered the list down to Computer Science alone,
   * which is not a subject group anyone studies. The tab comes back when
   * Arts subjects do.
   */
  const electives = useMemo(() => SUBJECTS.filter((s) => !s.compulsory), []);
  /**
   * Seeded from what the student already picked. These screens double as the
   * editors reached from the profile, and starting them at the science
   * defaults meant opening the step and pressing Continue silently replaced
   * an Arts student's real subject list.
   */
  const chosen = (state.onboarding?.subjects ?? []).filter((id) => !SUBJECTS.find((s) => s.id === id)?.compulsory);
  const [picked, setPicked] = useState<string[]>(chosen.length ? chosen : ['phy', 'chem', 'bio']);

  const total = compulsory.length + picked.length;
  const enough = picked.length >= 2;

  /*
   * The first run asks one thing. Everyone takes the compulsory subjects,
   * Physics, Chemistry and Maths, so the only real choice is the fourth
   * science subject. The full list stays for Edit profile, where a student can
   * take on as many as they like.
   */
  if (!editing) {
    const choose = (choice: ScienceChoice) => {
      actions.setOnboarding({ group: 'science', subjects: subjectsForScience(choice) });
      setTimeout(() => {
        // Signed in already (sent here to finish choosing): the account
        // exists, so on to the app rather than to sign-up. Signed out: the
        // account comes next, and sign-up is told where the student came from
        // so it never has to guess from choices left on the phone.
        if (state.user) resetTo('/(tabs)');
        else router.replace('/signup?from=onboarding');
      }, 180);
    };
    const bio = subjectById('bio');
    const cs = subjectById('cs');
    const current = new Set(state.onboarding?.subjects ?? []);
    const had: ScienceChoice | null = current.has('bio') && current.has('cs') ? 'both' : current.has('cs') ? 'cs' : current.has('bio') ? 'bio' : null;
    return (
      <StepScreen
        step={4}
        title={t('onboarding.scienceTitle')}
        sub={t('onboarding.scienceSub')}
        cta={t('common.continue')}
        onNext={() => {}}
        auto
        footnote={t('onboarding.scienceFootnote')}
      >
        <ChoiceCard title={subjectName(bio, lang)} sub={t('onboarding.scienceBioSub')} selected={had === 'bio'} onPress={() => choose('bio')} />
        <ChoiceCard title={subjectName(cs, lang)} sub={t('onboarding.scienceCsSub')} selected={had === 'cs'} onPress={() => choose('cs')} />
        <ChoiceCard title={t('onboarding.scienceBoth')} sub={t('onboarding.scienceBothSub')} selected={had === 'both'} onPress={() => choose('both')} />
      </StepScreen>
    );
  }

  return (
    <Screen
      footer={
        <Btn
          title={enough ? t('onboarding.continueWith', { n: total }) : t('onboarding.pickTwo')}
          disabled={!enough}
          onPress={() => {
            actions.setOnboarding({ group: 'science', subjects: [...compulsory.map((s) => s.id), ...picked] });
            // Only Edit profile reaches this list now (the first run asks one
            // question above), so back to it: a replace here stacked a second
            // home screen over the profile and the steps behind it.
            router.back();
          }}
        />
      }
    >
      <Header title={t('onboarding.subjectsTitle')} sub={t('onboarding.subjectsSub')} back />

      <SectionTitle>{t('onboarding.compulsory')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        {compulsory.map((s, i) => (
          <Item
            key={s.id}
            title={subjectName(s, lang)}
            sub={t('onboarding.compulsorySub')}
            icon={s.icon}
            last={i === compulsory.length - 1}
            right={<Icon name="lock" size={17} color={C.ink3} />}
          />
        ))}
      </Card>

      <SectionTitle action={<Small>{t('onboarding.picked', { n: picked.length })}</Small>}>
        {t('onboarding.electives')}
      </SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        {electives.map((s, i) => {
          const on = picked.includes(s.id);
          return (
            <Item
              key={s.id}
              title={subjectName(s, lang)}
              sub={s.group === 'science' ? t('onboarding.scienceGroup') : undefined}
              icon={s.icon}
              tone={on ? 'teal' : 'grey'}
              last={i === electives.length - 1}
              onPress={() => {
                setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]));
                if (!on) toast(t('onboarding.subjectAdded', { name: subjectName(s, lang) }));
              }}
              right={<Check on={on} />}
            />
          );
        })}
      </Card>

      <Small style={{ marginTop: S.lg }}>{t('onboarding.subjectsFootnote')}</Small>
    </Screen>
  );
}
