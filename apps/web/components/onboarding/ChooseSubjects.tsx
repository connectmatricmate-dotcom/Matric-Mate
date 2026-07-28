'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { type Group, SUBJECTS } from '@matricmate/core';
import { ItemButton, Seg } from '@/components/ui/controls';
import { Card, Check, Icon, Item, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';
import { StepScreen } from './StepScreen';

export function ChooseSubjects() {
  const { actions } = useApp();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [group, setGroup] = useState<Group>('science');
  const [picked, setPicked] = useState<string[]>(['phy', 'chem', 'bio']);

  const compulsory = useMemo(() => SUBJECTS.filter((s) => s.compulsory), []);
  const electives = useMemo(
    () => SUBJECTS.filter((s) => !s.compulsory && (group === 'science' ? true : s.id === 'cs')),
    [group]
  );

  const total = compulsory.length + picked.length;
  const enough = picked.length >= 2;

  return (
    <StepScreen
      step={4}
      title={t('onboarding.subjectsTitle')}
      sub={t('onboarding.subjectsSub')}
      cta={enough ? t('onboarding.continueWith', { n: total }) : t('onboarding.pickTwo')}
      disabled={!enough}
      footnote={t('onboarding.subjectsFootnote')}
      onNext={() => {
        actions.setOnboarding({ group, subjects: [...compulsory.map((s) => s.id), ...picked] });
        router.push('/dashboard');
      }}
    >
      <Seg
        value={group}
        label="Subject group"
        className="w-full"
        onChange={(g) => {
          setGroup(g);
          setPicked(g === 'science' ? ['phy', 'chem', 'bio'] : ['cs']);
        }}
        options={[
          { value: 'science' as Group, label: t('onboarding.scienceGroup') },
          { value: 'arts' as Group, label: t('onboarding.artsGroup') },
        ]}
      />

      <SectionTitle>{t('onboarding.compulsory')}</SectionTitle>
      <Card flat className="py-0">
        {compulsory.map((s, i) => (
          <Item
            key={s.id}
            title={s.name}
            sub={t('onboarding.compulsorySub')}
            icon={s.icon}
            last={i === compulsory.length - 1}
            right={<Icon name="lock" size={17} className="text-ink3" />}
          />
        ))}
      </Card>

      <SectionTitle action={<span className="text-[13px] text-ink2">{t('onboarding.picked', { n: picked.length })}</span>}>
        {t('onboarding.electives')}
      </SectionTitle>
      <Card flat className="py-0">
        {electives.map((s, i) => {
          const on = picked.includes(s.id);
          return (
            <ItemButton
              key={s.id}
              title={s.name}
              sub={s.group === 'science' ? t('onboarding.scienceGroup') : undefined}
              icon={s.icon}
              tone={on ? 'teal' : 'grey'}
              last={i === electives.length - 1}
              right={<Check on={on} />}
              onClick={() => {
                setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]));
                if (!on) toast(t('onboarding.subjectAdded', { name: s.name }));
              }}
            />
          );
        })}
      </Card>
    </StepScreen>
  );
}
