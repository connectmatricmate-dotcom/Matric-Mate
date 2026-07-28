import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Field, Header, Item, Row, Screen, SectionTitle, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';

const AVATARS = ['🧑🏽‍🎓', '👩🏽‍🎓', '🧕🏽', '👨🏽‍💻', '🦸🏽'];

export default function EditProfile() {
  const { state, actions } = useApp();
  const toast = useToast();
  const [name, setName] = useState(state.user?.name ?? '');
  const [avatar, setAvatar] = useState(0);
  const setup = state.onboarding;

  return (
    <Screen
      footer={
        <Btn
          title="Save changes"
          onPress={() => {
            if (state.user) actions.signIn({ ...state.user, name: name.trim() || state.user.name });
            toast('Profile saved ✓');
            router.back();
          }}
        />
      }
    >
      <Header title="Edit profile" back />

      <Row gap={S.sm} style={{ justifyContent: 'center', marginVertical: S.md }}>
        {AVATARS.map((a, i) => (
          <Tap key={a} onPress={() => setAvatar(i)}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
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

      <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" icon="user" autoCapitalize="words" />

      <SectionTitle>Study setup</SectionTitle>
      <Card flat style={{ paddingVertical: 2 }}>
        <Item
          title="Class & board"
          sub={`Class ${setup?.classLevel ?? 9} · ${setup?.board === 'punjab' ? 'Punjab Board' : 'FBISE'}`}
          icon="book"
          onPress={() => router.push('/onboarding/class')}
        />
        <Item
          title="Medium"
          sub={setup?.medium === 'ur' ? 'Urdu' : 'English'}
          icon="globe"
          onPress={() => router.push('/onboarding/medium')}
        />
        <Item
          title="My subjects"
          sub={`${setup?.subjects.length ?? 0} selected`}
          icon="cards"
          last
          onPress={() => router.push('/onboarding/subjects')}
        />
      </Card>
      <Spacer h={S.md} />
      <Small>Changing class or board reloads your syllabus — your progress for the old one is kept.</Small>
    </Screen>
  );
}
