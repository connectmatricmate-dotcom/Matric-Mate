import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Steps } from '../../src/components/OnboardingStep';
import { SUBJECTS } from '../../src/core/content';
import { Group } from '../../src/core/types';
import { useApp } from '../../src/store/app';
import { Btn, Card, Header, Item, Pill, Screen, SectionTitle, Seg, Small, useToast } from '../../src/components/ui';
import { C, S } from '../../src/theme';
import { Icon } from '../../src/components/Icon';

export default function ChooseSubjects() {
  const { actions } = useApp();
  const toast = useToast();
  const [group, setGroup] = useState<Group>('science');
  const compulsory = useMemo(() => SUBJECTS.filter((s) => s.compulsory), []);
  const electives = useMemo(() => SUBJECTS.filter((s) => !s.compulsory), []);
  const [picked, setPicked] = useState<string[]>(['phy', 'chem', 'bio']);

  const total = compulsory.length + picked.length;
  const enough = picked.length >= 2;

  return (
    <Screen
      footer={
        <Btn
          title={enough ? `Continue with ${total} subjects` : 'Pick at least 2 electives'}
          disabled={!enough}
          onPress={() => {
            actions.setOnboarding({ group, subjects: [...compulsory.map((s) => s.id), ...picked] });
            router.push('/signup');
          }}
        />
      }
    >
      <Header title="Pick your subjects" sub="Compulsory ones are already in" back />
      <Steps step={4} />

      <Seg
        value={group}
        onChange={(g) => {
          setGroup(g);
          setPicked(g === 'science' ? ['phy', 'chem', 'bio'] : ['cs']);
        }}
        options={[
          { value: 'science', label: 'Science' },
          { value: 'arts', label: 'Arts' },
        ]}
      />

      <SectionTitle>Compulsory</SectionTitle>
      <Card flat style={{ paddingVertical: 2 }}>
        {compulsory.map((s, i) => (
          <Item
            key={s.id}
            title={s.name}
            sub="Everyone studies this"
            icon={s.icon}
            last={i === compulsory.length - 1}
            right={<Icon name="lock" size={16} color={C.ink3} />}
          />
        ))}
      </Card>

      <SectionTitle action={<Small>{picked.length} picked</Small>}>Electives</SectionTitle>
      <Card flat style={{ paddingVertical: 2 }}>
        {electives.map((s, i) => {
          const on = picked.includes(s.id);
          return (
            <Item
              key={s.id}
              title={s.name}
              sub={s.group === 'science' ? 'Science group' : 'Open to all'}
              icon={s.icon}
              tone={on ? 'green' : 'grey'}
              last={i === electives.length - 1}
              onPress={() => {
                setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]));
                if (!on) toast(`${s.name} added`);
              }}
              right={
                on ? (
                  <Pill tone="green" icon="check" />
                ) : (
                  <View style={{ width: 26, height: 26, borderRadius: 99, borderWidth: 2, borderColor: '#DDE6E1' }} />
                )
              }
            />
          );
        })}
      </Card>
      <Small style={{ marginTop: S.md }}>
        Exact FBISE Class 9 subject list to be confirmed with the client’s content.
      </Small>
    </Screen>
  );
}
