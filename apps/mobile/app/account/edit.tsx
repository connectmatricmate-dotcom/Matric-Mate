import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Field, Header, Item, Row, Screen, SectionTitle, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { useLang, useT } from '../../src/i18n';
import { AVATARS, boardName } from '@matricmate/core';
import { AvatarBadge } from '../../src/components/AvatarBadge';
import { useApp } from '../../src/store/app';
import { isAuthErrorKey, useAuth } from '../../src/store/auth';
import { supabase } from '../../src/lib/supabase';
import { C, S } from '../../src/theme';



export default function EditProfile() {
  const { state, actions } = useApp();
  const { updateName } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const [name, setName] = useState(state.user?.name ?? '');
  // Persisted, not local: the picker used to keep its choice in component
  // state, so the selection silently vanished on the way out of the screen.
  const avatar = state.settings.avatar ?? 0;
  const setAvatar = (i: number) => actions.setSettings({ avatar: i });
  const setup = state.onboarding;

  /* The school, optional (migration 0042). Not in the store, which has no use
     for it anywhere else, so read from the profile row when the screen opens,
     and never over what the student has started typing. */
  const [school, setSchool] = useState('');
  const [schoolEdited, setSchoolEdited] = useState(false);
  const userId = state.user?.id ?? '';
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void supabase
      .from('profiles')
      .select('school')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data?.school) setSchool((now) => now || (data.school as string));
      });
    return () => {
      alive = false;
    };
  }, [userId]);
  const schoolClean = school.trim().replace(/\s+/g, ' ');
  const schoolOk = !schoolClean || (schoolClean.length >= 2 && schoolClean.length <= 120);

  return (
    <Screen
      footer={
        <Btn
          title={t('common.save')}
          // A blank name is not saved, so it is not reported as saved either.
          disabled={!name.trim() || !schoolOk}
          onPress={async () => {
            try {
              await updateName(name);
              // Only when touched, so a slow first read cannot blank it.
              if (schoolEdited && userId) {
                const { error } = await supabase.from('profiles').update({ school: schoolClean || null }).eq('id', userId);
                if (error) throw new Error('auth.errGeneric');
              }
              toast(t('account.profileSaved'));
              router.back();
            } catch (e) {
              // The store hands back a message key, not a sentence: shown raw
              // it read "auth.errNetwork" on the screen.
              const msg = e instanceof Error ? e.message : '';
              toast(isAuthErrorKey(msg) ? t(msg) : t('states.errorBody'));
            }
          }}
        />
      }
    >
      <Header title={t('account.editTitle')} back />

      <SectionTitle>{t('account.avatar')}</SectionTitle>
      <Row gap={S.sm} style={{ justifyContent: 'center', flexWrap: 'wrap', marginBottom: S.md }}>
        {AVATARS.map((a, i) => (
          <Tap key={a.id} onPress={() => setAvatar(i)}>
            <View
              style={{
                borderRadius: 99,
                borderWidth: i === avatar ? 2.5 : 1.5,
                borderColor: i === avatar ? C.teal : C.line,
                padding: 2,
              }}
            >
              <AvatarBadge index={i} size={52} />
            </View>
          </Tap>
        ))}
      </Row>

      <Field
        label={t('auth.fullName')}
        placeholder={t('auth.namePlaceholder')}
        value={name}
        onChangeText={setName}
        icon="user"
        autoCapitalize="words"
      />
      <Field
        label={t('auth.school')}
        placeholder={t('auth.schoolPlaceholder')}
        value={school}
        onChangeText={(v) => {
          setSchoolEdited(true);
          setSchool(v);
        }}
        icon="gradCap"
        autoCapitalize="words"
        error={schoolOk ? undefined : t('auth.errSchoolLength')}
      />

      <SectionTitle>{t('account.studySetup')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        {/* Each opens its own step in edit mode: it saves and comes back here.
            They used to run the whole first-run chain from that step on and
            end by stacking a second home screen over this one, so changing
            the medium meant choosing subjects again, and back from home went
            into onboarding. */}
        <Item
          title={t('account.classAndBoard')}
          sub={t('tutor.classRowValue', { n: setup?.classLevel ?? 9, board: boardName(setup?.board, lang) })}
          icon="book"
          onPress={() => router.push('/onboarding/class?edit=1')}
        />
        <Item
          title={t('account.medium')}
          sub={setup?.medium === 'ur' ? t('onboarding.mediumUr') : t('onboarding.mediumEn')}
          icon="book2"
          onPress={() => router.push('/onboarding/medium?edit=1')}
        />
        <Item
          title={t('account.mySubjects')}
          sub={t('account.subjectsCount', { n: setup?.subjects.length ?? 0 })}
          icon="cards"
          last
          onPress={() => router.push('/onboarding/subjects?edit=1')}
        />
      </Card>
      <Spacer h={S.md} />
      <Small>{t('account.editFootnote')}</Small>
    </Screen>
  );
}
