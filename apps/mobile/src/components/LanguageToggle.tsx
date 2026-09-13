import { View } from 'react-native';
import { translate } from '@matricmate/core';
import { useLang } from '../i18n';
import { C, F, R, rowDir } from '../theme';
import { Tap, Text } from './ui';

/**
 * English / Urdu switch.
 *
 * Each option is labelled in its own language, so Urdu reads "اردو". That is
 * how a language picker is meant to work, and it is now honest: the label used
 * to be Latin because picking Urdu only gave you Roman Urdu, and Nastaliq here
 * promised an interface the app could not deliver. It can now.
 *
 * The radius, background and clipping all live on the pressable itself. When
 * the background sat on a child view, Android's ripple layer could paint a
 * square highlight outside the child's rounded corners, which is exactly the
 * white box the screenshots showed.
 */
export function LanguageToggle({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  // Each name from its own language's dictionary, whatever the app is in now:
  // read through the current one, the English app offered "Urdu" set in the
  // Nastaliq face, a Latin word in a script font, and never the "اردو" a
  // student who cannot read English is looking for.
  const options: { value: 'en' | 'ur'; label: string; urdu?: boolean }[] = [
    { value: 'en', label: translate('en', 'lang.english') },
    { value: 'ur', label: translate('ur', 'lang.urdu'), urdu: true },
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
              // A floor, not a height: the label's line box grows with the
              // system font size, and a fixed pill with the clip below cut
              // اردو off at the top and bottom once it did.
              minHeight: compact ? 32 : 38,
              minWidth: compact ? 62 : 88,
              paddingHorizontal: compact ? 14 : 20,
              borderRadius: R.pill,
              overflow: 'hidden',
              backgroundColor: on ? C.card : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Each label keeps its own script's font whichever language the
                app is in, and Nastaliq gets the pill's full height as its line
                box so the ink hanging below the baseline is not clipped. */}
            <Text
              style={{
                fontFamily: o.urdu ? F.urduBold : F.bodyBold,
                fontSize: o.urdu ? 14.5 : 13.5,
                lineHeight: compact ? 32 : 38,
                includeFontPadding: false,
                color: on ? C.teal : C.ink2,
              }}
            >
              {o.label}
            </Text>
          </Tap>
        );
      })}
    </View>
  );
}
