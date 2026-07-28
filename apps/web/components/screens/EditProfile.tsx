'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, Field } from '@/components/ui/controls';
import { Card, Item, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';
import { validateName } from '@/lib/validation';

const AVATARS = ['🧑🏽‍🎓', '👩🏽‍🎓', '🧕🏽', '👨🏽‍💻', '🦸🏽'];

export function EditProfile() {
  const { state, actions } = useApp();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(state.user?.name ?? '');
  const [avatar, setAvatar] = useState(0);
  const [touched, setTouched] = useState(false);
  const setup = state.onboarding;

  const nameError = validateName(name);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (nameError) return;
    if (state.user) actions.signIn({ ...state.user, name: name.trim() });
    toast(t('account.profileSaved'));
    router.push('/account');
  }

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('account.editTitle')} />

      <form onSubmit={save} noValidate>
        <fieldset className="mb-4">
          <legend className="mb-2 block text-[12.5px] font-extrabold text-ink2">{t('account.avatar')}</legend>
          <div className="flex flex-wrap justify-center gap-2.5">
            {AVATARS.map((a, i) => (
              <button
                key={a}
                type="button"
                aria-pressed={i === avatar}
                aria-label={`Avatar ${i + 1}`}
                onClick={() => setAvatar(i)}
                className={`flex h-[54px] w-[54px] items-center justify-center rounded-[17px] bg-orangetint text-[26px] transition-colors duration-200 ${
                  i === avatar ? 'border-2 border-teal' : 'border border-line hover:border-teal'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>

        <Field
          label={t('auth.fullName')}
          value={name}
          onChange={setName}
          placeholder={t('auth.namePlaceholder')}
          icon="user"
          autoComplete="name"
          required
          error={touched ? (nameError ?? undefined) : undefined}
        />

        <SectionTitle>{t('account.studySetup')}</SectionTitle>
        <Card flat className="py-0">
          <Item
            href="/onboarding/class"
            title={t('account.classAndBoard')}
            sub={`Class ${setup?.classLevel ?? 9} · ${setup?.board === 'punjab' ? 'Punjab Board' : 'FBISE'}`}
            icon="book"
          />
          <Item
            href="/onboarding/medium"
            title={t('account.medium')}
            sub={setup?.medium === 'ur' ? t('onboarding.mediumUr') : t('onboarding.mediumEn')}
            icon="layers"
          />
          <Item
            href="/onboarding/subjects"
            title={t('account.mySubjects')}
            sub={t('account.subjectsCount', { n: setup?.subjects.length ?? 0 })}
            icon="cards"
            last
          />
        </Card>

        <p className="mt-4 text-[13px] text-ink2">{t('account.editFootnote')}</p>

        <div className="sticky bottom-0 mt-5 bg-paper/95 py-4 backdrop-blur">
          <Btn title={t('common.save')} type="submit" disabled={!!nameError} className="w-full md:w-auto" />
        </div>
      </form>
    </Page>
  );
}
