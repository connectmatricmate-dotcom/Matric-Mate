import { Text, View } from 'react-native';
import { useLang } from '../i18n';
import { C, F, R } from '../theme';
import { Tap } from './ui';

/**
 * English / Urdu switch. Both labels always render in their own script, so the
 * option you can't currently read is still recognisable.
 */
export function LanguageToggle({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const options: { value: 'en' | 'ur'; label: string; urdu?: boolean }[] = [
    { value: 'en', label: 'English' },
    { value: 'ur', label: 'اردو', urdu: true },
  ];

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: C.grey,
        borderRadius: R.pill,
        padding: 3,
        alignSelf: compact ? 'flex-end' : 'center',
      }}
    >
      {options.map((o) => {
        const on = lang === o.value;
        return (
          <Tap key={o.value} onPress={() => setLang(o.value)}>
            <View
              style={{
                paddingVertical: compact ? 7 : 9,
                paddingHorizontal: compact ? 14 : 20,
                borderRadius: R.pill,
                backgroundColor: on ? C.card : 'transparent',
                minWidth: compact ? 62 : 84,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: o.urdu ? F.urduBold : F.bodyBold,
                  fontSize: o.urdu ? 13 : 13.5,
                  lineHeight: o.urdu ? 24 : 18,
                  color: on ? C.teal : C.ink2,
                }}
              >
                {o.label}
              </Text>
            </View>
          </Tap>
        );
      })}
    </View>
  );
}
