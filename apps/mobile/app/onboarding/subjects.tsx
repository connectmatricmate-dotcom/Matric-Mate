import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Steps } from '../../src/components/OnboardingStep';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, Check, Header, Item, Screen, SectionTitle, Seg, Small, useToast } from '../../src/components/ui';
import { SUBJECTS } from '../../src/core/content';
import { Group } from '../../src/core/types';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';

export default function ChooseSubjects() {
  const { actions } = useApp();
  const t = useT();
  const toast = useToast();
  const [group, setGroup] = useState<Group>('science');
  const compulsory = useMemo(() => SUBJECTS.filter((s) => s.compulsory), []);
  const electives = useMemo(
    () => SUBJECTS.filter((s) => !s.compulsory && (group === 'science' ? true : s.id === 'cs')),
    [group]
  );
  const [picked, setPicked] = useState<string[]>(['phy', 'chem', 'bio']);

  const total = compulsory.length + picked.length;
  const enough = picked.length >= 2;

  return (
    <Screen
      footer={
        <Btn
          title={enough ? t('onboarding.continueWith', { n: total }) : t('onboarding.pickTwo')}
          disabled={!enough}
          onPress={() => {
            actions.setOnboarding({ group, subjects: [...compulsory.map((s) => s.id), ...picked] });
            router.push('/signup');
          }}
        />
      }
    >
      <Header title={t('onboarding.subjectsTitle')} sub={t('onboarding.subjectsSub')} back />
      <Steps step={4} />

      <Seg
        value={group}
        onChange={(g) => {
          setGroup(g);
          setPicked(g === 'science' ? ['phy', 'chem', 'bio'] : ['cs']);
        }}
        options={[
          { value: 'science', label: t('onboarding.scienceGroup') },
          { value: 'arts', label: t('onboarding.artsGroup') },
        ]}
      />

      <SectionTitle>{t('onboarding.compulsory')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        {compulsory.map((s, i) => (
          <Item
            key={s.id}
            title={s.name}
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
              title={s.name}
              sub={s.group === 'science' ? t('onboarding.scienceGroup') : undefined}
              icon={s.icon}
              tone={on ? 'teal' : 'grey'}
              last={i === electives.length - 1}
              onPress={() => {
                setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]));
                if (!on) toast(t('onboarding.subjectAdded', { name: s.name }));
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
