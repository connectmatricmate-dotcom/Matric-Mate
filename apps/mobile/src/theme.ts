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
export const S = space;
export const R = radius;

/**
 * Urdu mode, for the whole interface rather than one string at a time.
 *
 * When the app language is Urdu every label is Urdu, so the question is not
 * "is this particular string Urdu" any more, it is "which way does the app
 * run". One flag answers both halves: the type switches to Nastaliq and the
 * layout mirrors.
 *
 * A module-level flag rather than a context because `F` and `T` are read from
 * plain style objects in 121 places, and a context cannot reach those. It is
 * safe here in a way it would not be on a server: one process, one reader.
 * Every one of those reads is a getter evaluated during render, and changing
 * the language re-renders the tree from the store, so the switch is immediate.
 *
 * Deliberately NOT I18nManager.forceRTL: that needs an app restart to take
 * effect, it is a known weak spot in Expo's managed builds, and it flips
 * globally rather than where we choose.
 */
let urduUi = false;

export function setUrduUi(on: boolean) {
  urduUi = on;
}

/** True when the interface is Urdu, so it reads right to left. */
export function isRTL() {
  return urduUi;
}

/** `row` normally, reversed in Urdu, for any horizontal run of children. */
export function rowDir(reverse = false): 'row' | 'row-reverse' {
  return urduUi !== reverse ? 'row-reverse' : 'row';
}

/** Which edge text starts from. */
export function textStart(): 'left' | 'right' {
  return urduUi ? 'right' : 'left';
}

/**
 * The type. In Urdu every face resolves to Nastaliq, so a screen built from
 * plain `<Text style={{ fontFamily: F.body }}>` needs no changes to render
 * correctly: without this the Urdu glyphs fall back to the system Naskh, which
 * is legible but is not the script the client asked for.
 */
export const F = {
  get display() {
    return urduUi ? fonts.urduBold : fonts.display;
  },
  get displayMd() {
    return urduUi ? fonts.urduBold : fonts.displayMd;
  },
  get body() {
    return urduUi ? fonts.urdu : fonts.body;
  },
  get bodyBold() {
    return urduUi ? fonts.urduBold : fonts.bodyBold;
  },
  get bodyReg() {
    return urduUi ? fonts.urdu : fonts.bodyReg;
  },
  /** Always Nastaliq, for Urdu content inside an English interface. */
  urdu: fonts.urdu,
  urduBold: fonts.urduBold,
};

/**
 * Nastaliq slopes steeply and its ink hangs well below the baseline, so it
 * needs roughly twice the leading of Latin at the same size. Pinning the Latin
 * line heights would clip every descender in the app.
 */
const lead = (latin: number) => (urduUi ? Math.round(latin * URDU_LINE_HEIGHT * 0.62) : latin);

export const T: Record<string, TextStyle> = {
  get h1() {
    return { fontFamily: F.display, fontSize: fontSize.h1, lineHeight: lead(32), color: C.ink, textAlign: textStart() };
  },
  get h2() {
    return { fontFamily: F.display, fontSize: fontSize.h2, lineHeight: lead(27), color: C.ink, textAlign: textStart() };
  },
  get h3() {
    return { fontFamily: F.display, fontSize: fontSize.h3, lineHeight: lead(23), color: C.ink, textAlign: textStart() };
  },
  get body() {
    return { fontFamily: F.body, fontSize: fontSize.body, lineHeight: lead(23), color: C.ink, textAlign: textStart() };
  },
  get read() {
    return { fontFamily: F.bodyReg, fontSize: fontSize.read, lineHeight: lead(27), color: C.ink, textAlign: textStart() };
  },
  get small() {
    return { fontFamily: F.body, fontSize: fontSize.small, lineHeight: lead(19), color: C.ink2, textAlign: textStart() };
  },
  get tiny() {
    return { fontFamily: F.bodyBold, fontSize: fontSize.tiny, lineHeight: lead(15), color: C.ink2, textAlign: textStart() };
  },
  get label() {
    return {
      fontFamily: F.bodyBold,
      fontSize: fontSize.tiny,
      lineHeight: lead(15),
      letterSpacing: 0.8,
      // Nastaliq is cursive: there is no upper case to switch to, and asking
      // for one only breaks the joins.
      textTransform: urduUi ? ('none' as const) : ('uppercase' as const),
      color: C.ink2,
      textAlign: textStart(),
    };
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
