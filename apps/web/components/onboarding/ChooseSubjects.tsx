'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { SUBJECTS, subjectName } from '@matricmate/core';
import { ItemButton } from '@/components/ui/controls';
import { Card, Check, Icon, Item, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useLang, useT } from '@/lib/store';
import { StepScreen } from './StepScreen';

/** What a first run starts with: the three sciences. */
const STARTER = ['phy', 'chem', 'bio'];

export function ChooseSubjects({ edit = false }: { edit?: boolean }) {
  const { state, synced, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  /**
   * Seeded from what the student already picked. These screens double as the
   * editors reached from the profile, and starting them at the science
   * defaults meant opening the step and pressing Continue silently replaced
   * an Arts student's real subject list. Read from the store on every render
   * until the student taps something, because on a refresh the first render
   * comes before the store has loaded.
   */
  const saved = (state.onboarding?.subjects ?? []).filter((id: string) => !SUBJECTS.find((s) => s.id === id)?.compulsory);
  const [touched, setTouched] = useState<string[] | null>(null);
  const picked = touched ?? (saved.length ? saved : STARTER);

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
      cta={!enough ? t('onboarding.pickTwo') : edit ? t('common.save') : t('onboarding.continueWith', { n: total })}
      disabled={!enough}
      waiting={!synced}
      footnote={t('onboarding.subjectsFootnote')}
      backHref={edit ? '/account/edit' : '/onboarding/medium'}
      onNext={async () => {
        // The last step waits for the account to have the list. Web signups'
        // subjects never reached it, so every other device, the report PDF
        // and the coach all fell back to a default list.
        const ok = await actions.setOnboarding({ group: 'science', subjects: [...compulsory.map((s) => s.id), ...picked] });
        if (!ok) {
          toast(t('states.errorBody'));
          return;
        }
        router.push(edit ? '/account/edit' : '/dashboard');
      }}
    >
      <SectionTitle>{t('onboarding.compulsory')}</SectionTitle>
      <Card flat className="py-0">
        {compulsory.map((s, i) => (
          <Item
            key={s.id}
            title={subjectName(s, lang)}
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
              title={subjectName(s, lang)}
              sub={s.group === 'science' ? t('onboarding.scienceGroup') : undefined}
              icon={s.icon}
              tone={on ? 'teal' : 'grey'}
              last={i === electives.length - 1}
              right={<Check on={on} />}
              onClick={() => {
                setTouched(on ? picked.filter((x) => x !== s.id) : [...picked, s.id]);
                if (!on) toast(t('onboarding.subjectAdded', { name: subjectName(s, lang) }));
              }}
            />
          );
        })}
      </Card>
    </StepScreen>
  );
}
