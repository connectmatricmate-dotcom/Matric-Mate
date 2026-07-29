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
            {/*
              Both pills share one fixed height and one line height, whatever
              the script. Nastaliq's font metrics are ~2.3x taller than Latin,
              so letting each label keep its natural leading made the two pills
              different heights with the text sitting at different depths,
              which is what made this control look broken.
            */}
            <View
              style={{
                height: compact ? 32 : 38,
                justifyContent: 'center',
                paddingHorizontal: compact ? 14 : 20,
                borderRadius: R.pill,
                backgroundColor: on ? C.card : 'transparent',
                minWidth: compact ? 62 : 88,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: o.urdu ? F.urduBold : F.bodyBold,
                  fontSize: o.urdu ? 14 : 13.5,
                  lineHeight: compact ? 32 : 38,
                  includeFontPadding: false,
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
