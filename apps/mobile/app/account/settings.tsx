import { router } from 'expo-router';
import { Card, Header, Item, Screen, SectionTitle, Seg, Small, Spacer, Toggle, useToast } from '../../src/components/ui';
import { Medium } from '../../src/core/types';
import { useApp } from '../../src/store/app';
import { S } from '../../src/theme';
import { View } from 'react-native';

export default function Settings() {
  const { state, actions } = useApp();
  const toast = useToast();
  const s = state.settings;

  return (
    <Screen>
      <Header title="Settings" back />

      <SectionTitle>Appearance</SectionTitle>
      <Card flat style={{ paddingVertical: 2 }}>
        <Item
          title="Dark mode"
          sub="Ships with the polish milestone"
          icon="moon"
          last
          right={<Toggle on={s.dark} onPress={() => { actions.setSettings({ dark: !s.dark }); toast('Dark mode lands in M5 polish'); }} />}
        />
      </Card>

      <SectionTitle>Content</SectionTitle>
      <Card flat style={{ paddingVertical: 2 }}>
        <Item
          title="Content medium"
          sub={s.contentMedium === 'ur' ? 'Urdu' : 'English'}
          icon="globe"
          right={
            <View style={{ width: 112 }}>
              <Seg<Medium>
                value={s.contentMedium}
                onChange={(m) => actions.setSettings({ contentMedium: m })}
                options={[
                  { value: 'en', label: 'EN' },
                  { value: 'ur', label: 'اردو', urdu: true },
                ]}
              />
            </View>
          }
        />
        <Item
          title="Reading text size"
          sub={['Small', 'Medium', 'Large'][s.fontScale]}
          icon="book"
          last
          onPress={() => actions.setSettings({ fontScale: ((s.fontScale + 1) % 3) as 0 | 1 | 2 })}
        />
      </Card>

      <SectionTitle>Notifications</SectionTitle>
      <Card flat style={{ paddingVertical: 2 }}>
        <Item
          title="Study reminder"
          sub={`Daily · ${s.reminderTime}`}
          icon="bell"
          right={<Toggle on={s.reminders} onPress={() => actions.setSettings({ reminders: !s.reminders })} />}
        />
        <Item
          title="Streak alerts"
          sub="Nudge me before I break a streak"
          icon="flame"
          tone="orange"
          last
          right={<Toggle on={s.streakAlerts} onPress={() => actions.setSettings({ streakAlerts: !s.streakAlerts })} />}
        />
      </Card>

      <SectionTitle>Storage</SectionTitle>
      <Card flat style={{ paddingVertical: 2 }}>
        <Item title="Manage downloads" sub={`${state.downloads.length} chapters`} icon="download" onPress={() => router.push('/learn/downloads')} />
        <Item
          title="Reset demo data"
          sub="Clears progress, attempts and receipts"
          icon="trash"
          tone="red"
          last
          onPress={() => {
            actions.resetDemo();
            toast('Demo data cleared');
          }}
        />
      </Card>

      <SectionTitle>About</SectionTitle>
      <Card flat style={{ paddingVertical: 2 }}>
        <Item title="Version" sub="0.1.0 · milestone 1 demo" icon="help" />
        <Item title="Terms & privacy" icon="doc" last onPress={() => toast('Legal pages ship with the landing page')} />
      </Card>

      <Spacer h={S.lg} />
      <Small>App language stays English at launch; Urdu UI is a later phase.</Small>
    </Screen>
  );
}
