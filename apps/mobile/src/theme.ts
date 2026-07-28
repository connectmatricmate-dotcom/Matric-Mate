/**
 * Android-side view of the shared design tokens.
 *
 * The values live in @matricmate/core so the web app renders the same brand;
 * this file only adapts them to React Native (StyleSheet objects, platform
 * shadows, Urdu text helper).
 */
import { Platform, TextStyle } from 'react-native';
import { CONTENT_MAX, URDU_LINE_HEIGHT, colors, fonts, fontSize, radius, space } from '@matricmate/core';

export const C = colors;
export const F = fonts;
export const S = space;
export const R = radius;

export const T: Record<string, TextStyle> = {
  h1: { fontFamily: F.display, fontSize: fontSize.h1, lineHeight: 32, color: C.ink },
  h2: { fontFamily: F.display, fontSize: fontSize.h2, lineHeight: 27, color: C.ink },
  h3: { fontFamily: F.display, fontSize: fontSize.h3, lineHeight: 23, color: C.ink },
  body: { fontFamily: F.body, fontSize: fontSize.body, lineHeight: 23, color: C.ink },
  read: { fontFamily: F.bodyReg, fontSize: fontSize.read, lineHeight: 27, color: C.ink },
  small: { fontFamily: F.body, fontSize: fontSize.small, lineHeight: 19, color: C.ink2 },
  tiny: { fontFamily: F.bodyBold, fontSize: fontSize.tiny, lineHeight: 15, color: C.ink2 },
  label: {
    fontFamily: F.bodyBold,
    fontSize: fontSize.tiny,
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

/** Urdu needs extra leading and RTL; helper keeps it consistent. */
export const urdu = (size = 16): TextStyle => ({
  fontFamily: F.urdu,
  fontSize: size,
  lineHeight: size * URDU_LINE_HEIGHT,
  writingDirection: 'rtl',
  textAlign: 'right',
  color: C.ink,
});

export const WEB_MAX = CONTENT_MAX;
export const isWeb = Platform.OS === 'web';
