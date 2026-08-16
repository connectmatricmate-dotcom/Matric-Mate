import { Text, View } from 'react-native';
import { useLang } from '../i18n';
import { C, F, R, rowDir } from '../theme';
import { Tap } from './ui';

/**
 * English / Urdu switch.
 *
 * Both labels are Latin on purpose. The Nastaliq "اردو" here promised the wrong
 * thing: the app switches to Roman Urdu, not to Urdu script, and a label in
 * script implied the whole interface would convert. "Urdu" says what the
 * student actually gets.
 *
 * The radius, background and clipping all live on the pressable itself. When
 * the background sat on a child view, Android's ripple layer could paint a
 * square highlight outside the child's rounded corners, which is exactly the
 * white box the screenshots showed.
 */
export function LanguageToggle({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const options: { value: 'en' | 'ur'; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'ur', label: 'Urdu' },
  ];

  return (
    <View
      style={{
        flexDirection: rowDir(),
        backgroundColor: C.grey,
        borderRadius: R.pill,
        padding: 3,
        gap: 3,
        alignSelf: compact ? 'flex-end' : 'center',
      }}
    >
      {options.map((o) => {
        const on = lang === o.value;
        return (
          <Tap
            key={o.value}
            onPress={() => setLang(o.value)}
            style={{
              height: compact ? 32 : 38,
              minWidth: compact ? 62 : 88,
              paddingHorizontal: compact ? 14 : 20,
              borderRadius: R.pill,
              overflow: 'hidden',
              backgroundColor: on ? C.card : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: on ? C.teal : C.ink2 }}>{o.label}</Text>
          </Tap>
        );
      })}
    </View>
  );
}
