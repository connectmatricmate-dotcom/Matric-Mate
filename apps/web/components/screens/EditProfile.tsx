'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, ErrorBanner, Field } from '@/components/ui/controls';
import { Card, Item, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { useApp, useT } from '@/lib/store';
import { validateName } from '@/lib/validation';

const AVATARS = ['🧑🏽‍🎓', '👩🏽‍🎓', '🧕🏽', '👨🏽‍💻', '🦸🏽'];

export function EditProfile() {
  const { state, actions } = useApp();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(state.user?.name ?? '');
  const [edited, setEdited] = useState(false);
  const [avatar, setAvatar] = useState(0);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setup = state.onboarding;

  // The store hydrates and auth resolves after the first render, so the
  // initial useState often runs before the user exists. Backfilled during
  // render once the name arrives, never over what the student has typed.
  if (!edited && !name && state.user?.name) {
    setName(state.user.name);
  }

  const nameError = validateName(name);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (nameError || !state.user || busy) return;
    setBusy(true);
    // Written to the profile row, not just to local state: that row is what
    // the Android app shows and what checkout puts on a receipt.
    const { error: saveError } = await createClient().from('profiles').update({ name: name.trim() }).eq('id', state.user.id);
    if (saveError) {
      setBusy(false);
      setError(t('states.errorBody'));
      return;
    }
    // busy stays true through router.push, so the button cannot re-enable
    // during the route transition.
    actions.setName(name.trim());
    toast(t('account.profileSaved'));
    router.push('/account');
  }

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('account.editTitle')} />

      <form onSubmit={save} noValidate>
        {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
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
                className={`flex h-[54px] w-[54px] items-center justify-center rounded-[16px] border-2 bg-orangetint text-[26px] transition-colors duration-200 ${
                  i === avatar ? 'border-teal' : 'border-line hover:border-teal'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>

        <Field
          label={t('auth.fullName')}
          name="name"
          value={name}
          onChange={(v) => {
            setEdited(true);
            setName(v);
          }}
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

        <div className="mt-6">
          <Btn title={t('common.save')} type="submit" disabled={!!nameError} className="w-full md:w-auto" loading={busy} />
        </div>
      </form>
    </Page>
  );
}
