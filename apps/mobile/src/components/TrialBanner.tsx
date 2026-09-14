import { router } from 'expo-router';
import { View } from 'react-native';
import { daysLeft, subjectById, subjectName } from '@matricmate/core';
import { useLang, useT } from '../i18n';
import { useApp } from '../store/app';
import { C, F, S, rowDir } from '../theme';
import { Icon } from './Icon';
import { Tap, Text } from './ui';

/**
 * A strip under the header of every tab while a free trial runs: which subject
 * it opens, how many days are left, and the way to the plans screen. The
 * website shows the same strip.
 *
 * A trial that ends without warning reads as the app breaking, three days in,
 * so the count is always in view, and it says "last day" rather than
 * "1 days left".
 */
export function TrialBanner() {
  const { derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const access = derived.access;
  if (access.tier !== 'trial') return null;

  const subject = subjectName(subjectById(access.trialSubject ?? ''), lang) || access.trialSubject || '';
  const left = daysLeft(access.validTill);
  const line = left <= 1 ? t('trial.bannerOne', { subject }) : t('trial.banner', { subject, n: left });
  return (
    <Tap onPress={() => router.push('/upgrade')} label={`${line}. ${t('trial.seePlans')}`}>
      <View
        style={{
          flexDirection: rowDir(),
          alignItems: 'center',
          gap: S.sm,
          backgroundColor: C.orangeTint,
          borderRadius: 14,
          paddingHorizontal: S.md,
          paddingVertical: 10,
          marginBottom: S.md,
        }}
      >
        <Icon name="clock" size={16} color={C.orangeDark} />
        <Text style={{ flex: 1, fontFamily: F.bodyBold, fontSize: 13, color: C.orangeDark }}>{line}</Text>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.orangeDark, textDecorationLine: 'underline' }}>
          {t('trial.seePlans')}
        </Text>
      </View>
    </Tap>
  );
}
