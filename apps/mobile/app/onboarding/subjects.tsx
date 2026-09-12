import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Steps } from '../../src/components/OnboardingStep';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, Check, Header, Item, Screen, SectionTitle, Small, useToast } from '../../src/components/ui';
import { SUBJECTS, subjectName } from '@matricmate/core';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';

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

  return (
    <Screen
      footer={
        <Btn
          title={enough ? t('onboarding.continueWith', { n: total }) : t('onboarding.pickTwo')}
          disabled={!enough}
          onPress={() => {
            actions.setOnboarding({ group: 'science', subjects: [...compulsory.map((s) => s.id), ...picked] });
            // From Edit profile, back to it: a replace here stacked a second
            // home screen over the profile and the steps behind it.
            if (editing) {
              router.back();
              return;
            }
            // A student who signed in first and was sent here to pick their
            // subjects already has the account this flow used to demand next.
            // Routing them to signup told them to create one again. Signed in,
            // the steps behind this one are dismissed too, so back from home
            // does not walk into onboarding.
            if (state.user) {
              router.dismissAll();
              router.replace('/(tabs)');
            } else router.replace('/signup');
          }}
        />
      }
    >
      <Header title={t('onboarding.subjectsTitle')} sub={t('onboarding.subjectsSub')} back />
      {editing ? null : <Steps step={4} />}

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
