import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Field, Header, Item, Row, Screen, SectionTitle, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { useLang, useT } from '../../src/i18n';
import { AVATARS, boardName } from '@matricmate/core';
import { AvatarBadge } from '../../src/components/AvatarBadge';
import { useApp } from '../../src/store/app';
import { useAuth } from '../../src/store/auth';
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

  return (
    <Screen
      footer={
        <Btn
          title={t('common.save')}
          onPress={async () => {
            try {
              await updateName(name);
              toast(t('account.profileSaved'));
              router.back();
            } catch (e) {
              toast(e instanceof Error ? e.message : t('states.errorBody'));
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

      <SectionTitle>{t('account.studySetup')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item
          title={t('account.classAndBoard')}
          sub={t('tutor.classRowValue', { n: setup?.classLevel ?? 9, board: boardName(setup?.board, lang) })}
          icon="book"
          onPress={() => router.push('/onboarding/class')}
        />
        <Item
          title={t('account.medium')}
          sub={setup?.medium === 'ur' ? t('onboarding.mediumUr') : t('onboarding.mediumEn')}
          icon="book2"
          onPress={() => router.push('/onboarding/medium')}
        />
        <Item
          title={t('account.mySubjects')}
          sub={t('account.subjectsCount', { n: setup?.subjects.length ?? 0 })}
          icon="cards"
          last
          onPress={() => router.push('/onboarding/subjects')}
        />
      </Card>
      <Spacer h={S.md} />
      <Small>{t('account.editFootnote')}</Small>
    </Screen>
  );
}
