'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, ErrorBanner, Field } from '@/components/ui/controls';
import { Card, Item, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { AVATARS, boardName } from '@matricmate/core';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { useApp, useLang, useT } from '@/lib/store';
import { normaliseSchool, validateName, validateSchool } from '@/lib/validation';
import { goBackTo } from '@/lib/nav-trail';


export function EditProfile() {
  const { state, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(state.user?.name ?? '');
  const [edited, setEdited] = useState(false);
  // Persisted in settings, not local state: the old picker forgot the choice
  // the moment you left the page.
  const avatar = state.settings.avatar ?? 0;
  const setAvatar = (i: number) => actions.setSettings({ avatar: i });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setup = state.onboarding;
  /* The school, optional (migration 0042). Not in the store, which has no use
     for it anywhere else, so read from the profile row when the page opens;
     never over what the student has started typing. */
  const [school, setSchool] = useState('');
  const [schoolEdited, setSchoolEdited] = useState(false);
  const userId = state.user?.id ?? '';
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void createClient()
      .from('profiles')
      .select('school')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }: { data: { school: string | null } | null }) => {
        if (alive && data?.school) setSchool((now) => (now ? now : (data.school ?? '')));
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  // The store hydrates and auth resolves after the first render, so the
  // initial useState often runs before the user exists. Backfilled during
  // render once the name arrives, never over what the student has typed.
  if (!edited && !name && state.user?.name) {
    setName(state.user.name);
  }

  // In the student's language: the rule's message is shown under the field.
  const nameError = validateName(name, lang);
  const schoolError = validateSchool(school, lang);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (nameError || schoolError || !state.user || busy) return;
    setBusy(true);
    // Written to the profile row, not just to local state: that row is what
    // the Android app shows and what checkout puts on a receipt. The school
    // only when it was touched, so a slow first read cannot blank it.
    const supabase = createClient();
    const { error: saveError } = await supabase
      .from('profiles')
      .update({ name: name.trim(), ...(schoolEdited ? { school: normaliseSchool(school) || null } : {}) })
      .eq('id', state.user.id);
    if (saveError) {
      setBusy(false);
      setError(t('states.errorBody'));
      return;
    }
    // Here first, so the sign-in event the next line sets off finds the new
    // name already in place rather than the old one.
    actions.setName(name.trim());
    // And the sign-in record, which is where this browser read the name on
    // every load. With only the row changed, the edit reverted on reload and
    // the header went back to the signup name. The row is the one that
    // matters, so a failure here is not worth an error.
    await supabase.auth.updateUser({ data: { name: name.trim() } });
    // busy stays true through router.push, so the button cannot re-enable
    // during the route transition.
    toast(t('account.profileSaved'));
    // Back to the profile page behind this one, not a second copy of it.
    goBackTo(router, '/account');
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
                key={a.id}
                type="button"
                aria-pressed={i === avatar}
                aria-label={a.name}
                onClick={() => setAvatar(i)}
                className={`rounded-full border-2 p-0.5 transition-transform duration-200 hover:scale-110 ${
                  i === avatar ? 'border-teal' : 'border-line hover:border-teal'
                }`}
              >
                <AvatarBadge index={i} size={52} />
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
        <Field
          label={t('auth.school')}
          name="school"
          value={school}
          onChange={(v) => {
            setSchoolEdited(true);
            setSchool(v);
          }}
          placeholder={t('auth.schoolPlaceholder')}
          icon="gradCap"
          autoComplete="organization"
          error={touched || schoolEdited ? (schoolError ?? undefined) : undefined}
        />


        <SectionTitle>{t('account.studySetup')}</SectionTitle>
        <Card flat className="py-0">
          {/* ?edit=1: each opens its own step, saves it and comes back here,
              instead of walking the whole of onboarding and ending on Home. */}
          <Item
            href="/onboarding/class?edit=1"
            title={t('account.classAndBoard')}
            sub={t('tutor.classBadge', { n: setup?.classLevel ?? 9, board: boardName(setup?.board, lang) })}
            icon="book"
          />
          <Item
            href="/onboarding/medium?edit=1"
            title={t('account.medium')}
            sub={setup?.medium === 'ur' ? t('onboarding.mediumUr') : t('onboarding.mediumEn')}
            icon="layers"
          />
          <Item
            href="/onboarding/subjects?edit=1"
            title={t('account.mySubjects')}
            sub={t('account.subjectsCount', { n: setup?.subjects.length ?? 0 })}
            icon="cards"
            last
          />
        </Card>

        <p className="mt-4 text-[13px] text-ink2">{t('account.editFootnote')}</p>

        <div className="mt-6">
          <Btn title={t('common.save')} type="submit" disabled={!!nameError || !!schoolError} className="w-full md:w-auto" loading={busy} />
        </div>
      </form>
    </Page>
  );
}
