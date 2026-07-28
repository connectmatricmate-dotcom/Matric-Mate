/**
 * MatricMate design tokens.
 * Sampled from the client's logo — see docs/assets/brand/BRAND.md.
 * Every colour/spacing decision in the app comes from here.
 */
import { Platform, TextStyle } from 'react-native';

export const C = {
  teal: '#096A8B',
  tealDark: '#0F5064',
  tealTint: '#E9F2F5',
  tealTint2: '#D5E7ED',
  ink: '#0F3D4C',
  ink2: '#517682',
  ink3: '#8AA4AD',
  paper: '#FAFBF7',
  card: '#FFFFFF',
  line: '#E4EAE6',
  orange: '#F29329',
  orangeDark: '#D97B10',
  orangeTint: '#FDF1E1',
  green: '#2E9E5B',
  greenTint: '#E7F5EC',
  red: '#D9534F',
  redTint: '#FBECEB',
  grey: '#EFF3F0',
  whatsapp: '#25D366',
} as const;

/** Font families — loaded in app/_layout.tsx */
export const F = {
  display: 'Baloo2_700Bold',
  displayMd: 'Baloo2_600SemiBold',
  body: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_800ExtraBold',
  bodyReg: 'Nunito_400Regular',
  urdu: 'NotoNastaliqUrdu_400Regular',
  urduBold: 'NotoNastaliqUrdu_600SemiBold',
} as const;

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const R = { sm: 10, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Type scale (see DESIGN-SPEC §2) */
export const T: Record<string, TextStyle> = {
  h1: { fontFamily: F.display, fontSize: 26, lineHeight: 32, color: C.ink },
  h2: { fontFamily: F.display, fontSize: 21, lineHeight: 27, color: C.ink },
  h3: { fontFamily: F.display, fontSize: 17, lineHeight: 23, color: C.ink },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 23, color: C.ink },
  read: { fontFamily: F.bodyReg, fontSize: 15.5, lineHeight: 27, color: C.ink },
  small: { fontFamily: F.body, fontSize: 13, lineHeight: 19, color: C.ink2 },
  tiny: { fontFamily: F.bodyBold, fontSize: 11, lineHeight: 15, color: C.ink2 },
  label: {
    fontFamily: F.bodyBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: C.ink2,
  },
};

export const shadow = Platform.select({
  android: { elevation: 2 },
  web: { boxShadow: '0 5px 14px rgba(15,80,100,0.07)' },
  default: {
    shadowColor: '#0F5064',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
}) as object;

/** Urdu text needs extra line-height and RTL; helper keeps it consistent. */
export const urdu = (size = 16): TextStyle => ({
  fontFamily: F.urdu,
  fontSize: size,
  lineHeight: size * 2.1,
  writingDirection: 'rtl',
  textAlign: 'right',
  color: C.ink,
});

/** Web-only max content width so the app doesn't stretch on desktop. */
export const WEB_MAX = 1040;
export const isWeb = Platform.OS === 'web';
