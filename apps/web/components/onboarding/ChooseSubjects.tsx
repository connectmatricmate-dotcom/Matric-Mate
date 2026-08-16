'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { SUBJECTS } from '@matricmate/core';
import { ItemButton } from '@/components/ui/controls';
import { Card, Check, Icon, Item, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';
import { StepScreen } from './StepScreen';

export function ChooseSubjects() {
  const { state, actions } = useApp();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  /**
   * Seeded from what the student already picked. These screens double as the
   * editors reached from the profile, and starting them at the science
   * defaults meant opening the step and pressing Continue silently replaced
   * an Arts student's real subject list.
   */
  const chosen = (state.onboarding?.subjects ?? []).filter((id: string) => !SUBJECTS.find((s) => s.id === id)?.compulsory);
  const [picked, setPicked] = useState<string[]>(chosen.length ? chosen : ['phy', 'chem', 'bio']);

  const compulsory = useMemo(() => SUBJECTS.filter((s) => s.compulsory), []);
  /**
   * Every elective we carry belongs to the science group. The picker used to
   * offer an Arts tab that filtered the list down to Computer Science alone,
   * while still demanding two electives, so an Arts student could never
   * finish signing up. The tab comes back when Arts subjects do.
   */
  const electives = useMemo(() => SUBJECTS.filter((s) => !s.compulsory), []);

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
        actions.setOnboarding({ group: 'science', subjects: [...compulsory.map((s) => s.id), ...picked] });
        router.push('/dashboard');
      }}
    >
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
