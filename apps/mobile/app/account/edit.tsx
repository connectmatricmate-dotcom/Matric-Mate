import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Field, Header, Item, Row, Screen, SectionTitle, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';

const AVATARS = ['🧑🏽‍🎓', '👩🏽‍🎓', '🧕🏽', '👨🏽‍💻', '🦸🏽'];

export default function EditProfile() {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const [name, setName] = useState(state.user?.name ?? '');
  const [avatar, setAvatar] = useState(0);
  const setup = state.onboarding;

  return (
    <Screen
      avoidKeyboard
      footer={
        <Btn
          title={t('common.save')}
          onPress={() => {
            if (state.user) actions.signIn({ ...state.user, name: name.trim() || state.user.name });
            toast(t('account.profileSaved'));
            router.back();
          }}
        />
      }
    >
      <Header title={t('account.editTitle')} back />

      <Row gap={S.sm} style={{ justifyContent: 'center', marginVertical: S.md }}>
        {AVATARS.map((a, i) => (
          <Tap key={a} onPress={() => setAvatar(i)}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 17,
                backgroundColor: C.orangeTint,
                borderWidth: i === avatar ? 2 : 1,
                borderColor: i === avatar ? C.teal : C.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 26 }}>{a}</Text>
            </View>
          </Tap>
        ))}
      </Row>

      <Field label={t('auth.fullName')} value={name} onChangeText={setName} icon="user" autoCapitalize="words" />

      <SectionTitle>{t('account.studySetup')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item
          title={t('account.classAndBoard')}
          sub={`Class ${setup?.classLevel ?? 9} · ${setup?.board === 'punjab' ? 'Punjab Board' : 'FBISE'}`}
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
