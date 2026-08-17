'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, ErrorBanner, Field } from '@/components/ui/controls';
import { Card, Item, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { createClient } from '@/lib/supabase/client';
import { AVATARS, boardName } from '@matricmate/core';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { normalisePhone, syncPhone } from '@matricmate/core';
import { useApp, useLang, useT } from '@/lib/store';
import { validateName } from '@/lib/validation';


export function EditProfile() {
  const { state, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(state.user?.name ?? '');
  /*
   * A contact detail, not a login. Sign-in stays on email so no messaging
   * provider is ever in the path of creating an account: if WhatsApp or the
   * SMS gateway has a bad day, nobody is locked out. Shown as the student
   * typed it, stored as +92.
   */
  const [phone, setPhone] = useState(state.phone ?? '');
  const phoneBad = phone.trim().length > 0 && !normalisePhone(phone);
  const [edited, setEdited] = useState(false);
  // Persisted in settings, not local state: the old picker forgot the choice
  // the moment you left the page.
  const avatar = state.settings.avatar ?? 0;
  const setAvatar = (i: number) => actions.setSettings({ avatar: i });
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
    if (nameError || phoneBad || !state.user || busy) return;
    setBusy(true);
    // Written to the profile row, not just to local state: that row is what
    // the Android app shows and what checkout puts on a receipt.
    const supabase = createClient();
    const { error: saveError } = await supabase.from('profiles').update({ name: name.trim() }).eq('id', state.user.id);
    // Empty clears the number and the consent that came with it, so a number
    // removed today cannot be messaged tomorrow on last month's tick.
    await syncPhone(supabase, state.user.id, phone.trim() ? normalisePhone(phone) : null);
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
          label={t('account.whatsappNumber')}
          name="phone"
          value={phone}
          onChange={setPhone}
          placeholder="03001234567"
          icon="whatsapp"
          type="tel"
          autoComplete="tel"
          error={touched && phoneBad ? t('account.whatsappNumberBad') : undefined}
        />
        <p className="-mt-1 mb-4 text-[12.5px] text-ink2">{t('account.whatsappNumberHint')}</p>

        <SectionTitle>{t('account.studySetup')}</SectionTitle>
        <Card flat className="py-0">
          <Item
            href="/onboarding/class"
            title={t('account.classAndBoard')}
            sub={`Class ${setup?.classLevel ?? 9} · ${boardName(setup?.board, lang)}`}
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
