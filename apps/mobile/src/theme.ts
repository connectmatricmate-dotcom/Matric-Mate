/**
 * Android-side view of the shared design tokens.
 *
 * The values live in @matricmate/core so the web app renders the same brand;
 * this file only adapts them to React Native (StyleSheet objects, platform
 * shadows, Urdu text helper).
 */
import { Platform, TextStyle } from 'react-native';
import { CONTENT_MAX, Palette, URDU_LINE_HEIGHT, colors, darkColors, fonts, fontSize, radius, space } from '@matricmate/core';

/**
 * Dark mode, by the same mechanism as Urdu above and for the same reason.
 *
 * Every screen in this app styles through `C`, in 390 places across 54 files.
 * None of them picks a colour: they name a role, and this decides what that
 * role looks like right now. So the dark theme is a second palette in core
 * plus these getters, and not a single screen needed editing.
 *
 * The getters are what make it live. Each one is evaluated during render, and
 * flipping the setting updates the store, which re-renders the tree, so the
 * whole app changes at once with no reload and no restart.
 */
let darkUi = false;

export function setDarkUi(on: boolean) {
  darkUi = on;
}

/** True when the interface is dark. For the few places that need to branch. */
export function isDark() {
  return darkUi;
}

export const C: Palette = {
  get teal() { return (darkUi ? darkColors : colors).teal; },
  get tealDark() { return (darkUi ? darkColors : colors).tealDark; },
  get night() { return (darkUi ? darkColors : colors).night; },
  get cyan() { return (darkUi ? darkColors : colors).cyan; },
  get tealTint() { return (darkUi ? darkColors : colors).tealTint; },
  get tealTint2() { return (darkUi ? darkColors : colors).tealTint2; },
  get ink() { return (darkUi ? darkColors : colors).ink; },
  get ink2() { return (darkUi ? darkColors : colors).ink2; },
  get ink3() { return (darkUi ? darkColors : colors).ink3; },
  get paper() { return (darkUi ? darkColors : colors).paper; },
  get card() { return (darkUi ? darkColors : colors).card; },
  get line() { return (darkUi ? darkColors : colors).line; },
  get track() { return (darkUi ? darkColors : colors).track; },
  get mute() { return (darkUi ? darkColors : colors).mute; },
  get orange() { return (darkUi ? darkColors : colors).orange; },
  get orangeDark() { return (darkUi ? darkColors : colors).orangeDark; },
  get orangeTint() { return (darkUi ? darkColors : colors).orangeTint; },
  get green() { return (darkUi ? darkColors : colors).green; },
  get greenTint() { return (darkUi ? darkColors : colors).greenTint; },
  get red() { return (darkUi ? darkColors : colors).red; },
  get redTint() { return (darkUi ? darkColors : colors).redTint; },
  get grey() { return (darkUi ? darkColors : colors).grey; },
  get whatsapp() { return (darkUi ? darkColors : colors).whatsapp; },
  get onBrand() { return (darkUi ? darkColors : colors).onBrand; },
};
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

/** The far edge, for a column of figures that hangs off the end of a row. */
export function textEnd(): 'left' | 'right' {
  return urduUi ? 'left' : 'right';
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
  /**
   * Always the Latin faces, for English content inside an Urdu interface: an
   * English-medium question, an AI answer written in English. Drawn in the
   * Nastaliq face its Latin letters sit on a 2.5em line box, so any Latin line
   * height pushed them to the bottom of the line and cut their descenders.
   */
  latin: { display: fonts.display, body: fonts.body, bodyBold: fonts.bodyBold, bodyReg: fonts.bodyReg },
};

/**
 * Nastaliq slopes steeply and its ink hangs well below the baseline, so it
 * needs roughly twice the leading of Latin at the same size. Pinning the Latin
 * line heights would clip every descender in the app.
 *
 * Derived from the type size, not from the Latin line height. It used to be
 * the Latin value scaled up, which landed headings at about 1.6 times their
 * size against the 2.1 the Urdu helper below uses: Android shares a short
 * line box out evenly above and below the text and then crops to it, so the
 * tails of ے and ی on the last line of every Urdu heading were cut off.
 */
const lead = (latin: number, size: number) => (urduUi ? Math.round(size * URDU_LINE_HEIGHT) : latin);

export const T: Record<string, TextStyle> = {
  get h1() {
    return { fontFamily: F.display, fontSize: fontSize.h1, lineHeight: lead(32, fontSize.h1), color: C.ink, textAlign: textStart() };
  },
  get h2() {
    return { fontFamily: F.display, fontSize: fontSize.h2, lineHeight: lead(27, fontSize.h2), color: C.ink, textAlign: textStart() };
  },
  get h3() {
    return { fontFamily: F.display, fontSize: fontSize.h3, lineHeight: lead(23, fontSize.h3), color: C.ink, textAlign: textStart() };
  },
  get body() {
    return { fontFamily: F.body, fontSize: fontSize.body, lineHeight: lead(23, fontSize.body), color: C.ink, textAlign: textStart() };
  },
  get read() {
    return { fontFamily: F.bodyReg, fontSize: fontSize.read, lineHeight: lead(27, fontSize.read), color: C.ink, textAlign: textStart() };
  },
  get small() {
    return { fontFamily: F.body, fontSize: fontSize.small, lineHeight: lead(19, fontSize.small), color: C.ink2, textAlign: textStart() };
  },
  get tiny() {
    return { fontFamily: F.bodyBold, fontSize: fontSize.tiny, lineHeight: lead(15, fontSize.tiny), color: C.ink2, textAlign: textStart() };
  },
  get label() {
    return {
      fontFamily: F.bodyBold,
      fontSize: fontSize.tiny,
      lineHeight: lead(15, fontSize.tiny),
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

/**
 * A token colour at partial strength.
 *
 * For the washes and secondary text that sit ON a brand fill: a 25% track
 * inside the teal plan card, the blurb over a chapter hero. These were written
 * as `rgba(255,255,255,0.92)` and friends, which is correct on paper and wrong
 * after dark, because a dark theme brightens the fill underneath and white
 * then sits on it at about 2.4:1. Composing from `C.onBrand` instead means the
 * foreground flips with the palette exactly as the solid one already does.
 *
 * Not the same hazard as a Tailwind opacity modifier on the web: this runs at
 * render time against the getter, so it follows the theme rather than freezing
 * one palette's hex into the build. The web has the same three roles as real
 * CSS variables (--color-onbrand-soft and friends in globals.css).
 */
export const alpha = (hex: string, a: number): string =>
  `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;

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
/**
 * The widest a column of screen content gets on a phone or tablet.
 *
 * Portrait phones are narrower than this, so it changes nothing there. It is
 * for the screens that turn: from Android 16 a tablet or foldable ignores an
 * app's portrait lock (core/orientation.ts), and a paragraph of notes run
 * across 1000dp is a line nobody can follow back to its start.
 */
export const NATIVE_MAX = 720;
export const isWeb = Platform.OS === 'web';
