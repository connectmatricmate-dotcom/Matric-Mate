/**
 * MatricMate shared UI kit. Every screen composes these, no screen styles colours directly.
 * Works identically on Android and web (React Native Web).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, TextInputProps, TextProps as NativeTextProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { useKeyboardOverlap } from '../core/keyboard';
import { C, F, NATIVE_MAX, R, S, T, WEB_MAX, isDark, isRTL, isWeb, rowDir, shadow, textStart, urdu } from '../theme';
import { colors, isUrduScript, type StringKey } from '@matricmate/core';
import { useT } from '../i18n';
import { Icon, IconName } from './Icon';

/* ------------------------------------------------------------------ text */

/**
 * How far a student's system font size may enlarge the app's text.
 *
 * Android's largest setting doubles every size, and nothing here was ever
 * built for that: labels broke mid-word, pills pushed their neighbours off
 * the screen and Nastaliq outgrew the boxes drawn for it. 1.3 still honours
 * the setting for somebody who needs it and keeps every row on the screen.
 */
export const FONT_SCALE_CAP = 1.3;

/**
 * React Native's Text and TextInput with the cap applied. Every screen imports
 * these instead of the ones in react-native: React 19 ignores defaultProps on
 * function components, so there is no single switch to flip, and a Text that
 * skips this wrapper scales without limit. A caller can still pass its own
 * maxFontSizeMultiplier, or allowFontScaling={false} for a glyph in a fixed box.
 */
export function Text(props: NativeTextProps & { ref?: React.Ref<NativeText> }) {
  return <NativeText maxFontSizeMultiplier={FONT_SCALE_CAP} {...props} />;
}

export function TextInput(props: TextInputProps & { ref?: React.Ref<NativeTextInput> }) {
  return <NativeTextInput maxFontSizeMultiplier={FONT_SCALE_CAP} {...props} />;
}

export const H1 = (p: TextProps) => <Txt {...p} style={[T.h1, p.style]} />;
export const H2 = (p: TextProps) => <Txt {...p} style={[T.h2, p.style]} />;
export const H3 = (p: TextProps) => <Txt {...p} style={[T.h3, p.style]} />;
export const Body = (p: TextProps) => <Txt {...p} style={[T.body, p.style]} />;
export const Small = (p: TextProps) => <Txt {...p} style={[T.small, p.style]} />;
export const Tiny = (p: TextProps) => <Txt {...p} style={[T.tiny, p.style]} />;
export const Label = (p: TextProps) => <Txt {...p} style={[T.label, p.style]} />;

type TextProps = { children?: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };
function Txt({ children, style, numberOfLines }: TextProps) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/** Urdu text. Nastaliq, RTL, generous line-height. */
export function Ur({
  children,
  size = 16,
  lines,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  lines?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text numberOfLines={lines} style={[urdu(size), style]}>
      {children}
    </Text>
  );
}

/**
 * Content text that follows its own script. Urdu-medium questions, options
 * and answers arrive as Urdu strings; rendered in the Latin faces they
 * degrade into broken glyph soup (the client's screenshots). This detects
 * the script and applies the Nastaliq treatment automatically, so a screen
 * never needs to know which medium the content came in.
 */
export function ScriptText({
  text,
  size = 15,
  face = 'body',
  color = C.ink,
  center,
  lines,
  style,
}: {
  text: string;
  size?: number;
  face?: 'display' | 'body' | 'bodyBold';
  color?: string;
  center?: boolean;
  lines?: number;
  style?: StyleProp<TextStyle>;
}) {
  if (isUrduScript(text)) {
    return (
      <Text numberOfLines={lines} style={[urdu(size), { color }, center ? { textAlign: 'center' } : null, style]}>
        {text}
      </Text>
    );
  }
  // The Latin faces even in the Urdu interface: this text is not Urdu, and in
  // Nastaliq a Latin line height cut off its descenders (see F.latin).
  const fontFamily = face === 'display' ? F.latin.display : face === 'bodyBold' ? F.latin.bodyBold : F.latin.body;
  return (
    <Text
      numberOfLines={lines}
      style={[
        { fontFamily, fontSize: size, lineHeight: Math.round(size * 1.48), color },
        center ? { textAlign: 'center' } : null,
        style,
      ]}
    >
      {text}
    </Text>
  );
}

/**
 * The wordmark, on a ground it can be read on.
 *
 * The mark is two-tone, a mid-dark teal and an orange, and the teal half sits
 * at roughly 2.4:1 on the dark theme's paper: half the logo disappears, which
 * is the splash screen, the welcome carousel and the top of the report card.
 * Recolouring it was tried on the web and rejected by the client (handoff,
 * section 6), so this is the answer the web settled on instead: keep the mark
 * on a light ground. In the light theme the plate is the same colour as the
 * page behind it and cannot be seen at all.
 *
 * `colors.paper`, the light palette, deliberately and not `C.paper`: the plate
 * exists precisely because the artwork does not follow the theme.
 */
export function Wordmark({ width = 210, height = 40 }: { width?: number; height?: number }) {
  return (
    <View
      style={
        isDark()
          ? { backgroundColor: colors.paper, borderRadius: R.md, paddingHorizontal: 12, paddingVertical: 7 }
          : null
      }
    >
      <Image source={require('../../assets/wordmark.png')} style={{ width, height }} resizeMode="contain" />
    </View>
  );
}

/* ---------------------------------------------------------------- layout */

/**
 * Page wrapper. Handles the four things every screen needs:
 * the status-bar inset at the top, the gesture-bar inset at the bottom,
 * the keyboard when one is open, and on any wide screen a centred column
 * instead of full-bleed text.
 *
 * `tabbed`, set on the five tab roots, where the tab bar already occupies the
 * bottom inset and adding it again would leave a dead gap.
 *
 * The keyboard is not opt-in. It used to be, through an `avoidKeyboard` prop
 * that four screens passed and that did nothing on Android anyway, so in
 * practice every input in the app was typed at blind, behind the keyboard. A
 * screen with no input never sees a keyboard event, so handling it here costs
 * those screens two idle listeners and changes nothing else.
 *
 * `grow`, for a screen that centres its content in the space it has. The
 * content fills the screen when it is short and still scrolls when it is not:
 * a centred stack on a fixed screen ran under the footer on a short phone once
 * the text was Urdu or the font was large.
 */
export function Screen({
  children,
  scroll = true,
  footer,
  padded = true,
  tabbed = false,
  grow = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
  padded?: boolean;
  tabbed?: boolean;
  grow?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardOverlap();
  const { width: viewport } = useWindowDimensions();
  /**
   * One readable column, whatever the screen is doing.
   *
   * The web has always centred its content. Since phones are the only thing
   * still locked to portrait (core/orientation.ts), a tablet, a foldable or a
   * phone turned sideways now gets the same treatment rather than text run
   * edge to edge.
   */
  const columnMax = isWeb ? WEB_MAX : NATIVE_MAX;
  const column = isWeb || viewport > NATIVE_MAX ? { maxWidth: columnMax, width: '100%' as const, alignSelf: 'center' as const } : null;
  const scroller = useRef<ScrollView | null>(null);
  /** A plain View wrapped around the scroll area purely so there is something
   *  we can measure in window coordinates. Comparing an input's position
   *  against the area it has to fit inside is then one subtraction, with no
   *  assumptions about who is padding what. */
  const frame = useRef<View | null>(null);
  const offset = useRef(0);

  /**
   * Insets are the phone's hard edges, not a design margin. Padding by exactly
   * insets.top puts the first row of content in the very next pixel after the
   * clock, which reads as touching it, and the same at the gesture pill. So
   * every screen gets the inset plus real breathing room. On phones with
   * hardware buttons the inset is 0 and the fallbacks below keep the same
   * minimums, so older devices get identical margins rather than broken ones.
   */
  const topGap = insets.top + S.sm;
  const bottomGap = tabbed || footer ? S.lg : Math.max(insets.bottom, S.md) + S.sm;

  /**
   * Bringing the field the student is actually typing in above the keyboard.
   *
   * Shortening the screen is only half of it. React Native does scroll a child
   * into view when it takes focus, but that happens while the keyboard is
   * still opening, so it measures against the full-height screen, decides the
   * input is already visible, and does nothing. By the time the keyboard has
   * landed nobody looks again. So we look again here, once the padding below
   * has been applied.
   */
  useEffect(() => {
    if (!scroll || keyboard <= 0) return;
    const input = NativeTextInput.State.currentlyFocusedInput();
    if (!input) return;
    // One frame for the padding below to land, or we measure the old, taller
    // scroll area and the answer is always "nothing needs to move".
    const timer = setTimeout(() => {
      frame.current?.measureInWindow((_fx, frameY, _fw, frameH) => {
        if (!frameH) return;
        input.measureInWindow((_x, y, _w, h) => {
          // How far the bottom of the field, plus a little air, falls past the
          // bottom of what is still visible.
          const hidden = y + h + S.md - (frameY + frameH);
          if (hidden > 0) scroller.current?.scrollTo({ y: Math.max(0, offset.current + hidden), animated: true });
        });
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [keyboard, scroll]);

  const body = scroll ? (
    <ScrollView
      ref={scroller}
      style={{ flex: 1 }}
      contentContainerStyle={[
        { paddingHorizontal: padded ? S.lg : 0, paddingBottom: bottomGap },
        grow && { flexGrow: 1 },
        column,
      ]}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={32}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, width: '100%' }, column]}>
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: topGap, paddingBottom: keyboard }}>
      {/* collapsable={false}: without it Android flattens a View that draws
          nothing, and there is nothing left to measure. */}
      <View ref={frame} collapsable={false} style={{ flex: 1 }}>
        {body}
      </View>
      {footer ? (
        <View
          style={[
            {
              paddingHorizontal: S.lg,
              paddingTop: S.sm,
              /* The footer button clears the gesture pill instead of hugging
                 it, except when the keyboard is up: the pill is behind the
                 keyboard then, and the gap would just be dead space between
                 the button and the keys. */
              paddingBottom: keyboard > 0 ? S.md : tabbed ? S.md : Math.max(insets.bottom, S.md) + S.sm,
            },
            column,
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Three dots, breathing. The honest picture of "the tutor is reading your
 * question", which on a real answer is four or five seconds of nothing:
 * long enough that a line of static text reads as a screen that has hung.
 *
 * Hand-rolled rather than an ActivityIndicator because a spinner says
 * "loading a page" and this is somebody about to write.
 */
export function TypingDots({ color = C.ink3, size = 7 }: { color?: string; size?: number }) {
  const reduced = useReducedMotion();
  // useState, not useRef: these are read during render, and three Animated
  // values created once are exactly what a lazy initialiser is for.
  const [dots] = useState(() => [new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)]);

  useEffect(() => {
    if (reduced) return;
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots, reduced]);

  return (
    <View style={{ flexDirection: 'row', gap: size * 0.7, alignItems: 'center' }}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={{ width: size, height: size, borderRadius: size, backgroundColor: color, opacity: reduced ? 0.6 : v }}
        />
      ))}
    </View>
  );
}

/**
 * Text that arrives in lumps, shown as if it were being written.
 *
 * The tutor genuinely streams, but the model hands over 100 to 200 characters
 * at a time roughly once a second, so what a student saw was four or five
 * paragraph-sized jumps: indistinguishable from an answer that simply
 * appeared. Nothing here invents text. It only paces the reveal of text we
 * already have, and catches up proportionally so a big lump never takes
 * longer to draw than the next one takes to arrive.
 *
 * Mounted only while an answer is in flight, which is what owns the timer.
 */
export function useRevealed(text: string): string {
  const [shown, setShown] = useState('');
  const latest = useRef(text);
  const reduced = useReducedMotion();

  // The timer reads the newest text without being restarted by it.
  useEffect(() => {
    latest.current = text;
  }, [text]);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setShown((cur) => {
        const target = latest.current;
        // A retry or a correction: never animate backwards, just take it.
        if (!target.startsWith(cur)) return target;
        if (cur.length >= target.length) return cur;
        const step = Math.max(2, Math.ceil((target.length - cur.length) / 10));
        return target.slice(0, cur.length + step);
      });
    }, 26);
    return () => clearInterval(id);
  }, [reduced]);

  return reduced ? text : shown;
}

export function Header({
  title,
  sub,
  back,
  right,
  onBack,
}: {
  title?: string;
  sub?: string;
  back?: boolean;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  /**
   * A chevron only when there is somewhere to go.
   *
   * `router.back()` dispatches GO_BACK, which react-navigation drops when the
   * stack has one entry. The splash arrives at login and at the onboarding
   * class step with `replace`, so on the two screens most students start from,
   * the app drew a back button that did nothing at all when pressed. An
   * explicit `onBack` always shows, because the caller has said where it goes.
   */
  const showBack = back && (!!onBack || router.canGoBack());
  return (
    <View style={[st.header, { flexDirection: rowDir() }]}>
      {showBack ? (
        <View style={isRTL() ? { marginRight: -10 } : { marginLeft: -10 }}>
          <IconButton icon="back" onPress={onBack ?? (() => router.back())} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Screen titles are often a chapter or subject name, which is Urdu
            for an Urdu-medium student. */}
        {title ? isUrduScript(title) ? <Ur size={19}>{title}</Ur> : <H2>{title}</H2> : null}
        {sub ? (
          isUrduScript(sub) ? (
            <Ur size={13} style={{ color: C.ink2 }}>{sub}</Ur>
          ) : (
            <Small style={{ fontFamily: F.bodyBold }}>{sub}</Small>
          )
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Row({ children, gap = S.sm, style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  // Reversed in Urdu, so an icon that leads a row in English leads it on the
  // right instead of stranding itself on the wrong side of the label.
  return <View style={[{ flexDirection: rowDir(), alignItems: 'center', gap }, style]}>{children}</View>;
}
export function Col({ children, gap = S.sm, style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}
export const Spacer = ({ h = S.md }: { h?: number }) => <View style={{ height: h }} />;

/**
 * A two-column grid of equal tiles. React Native's percentage flexBasis
 * sizes wrapped children by their content, so a grid built that way goes
 * ragged the moment one caption runs longer than another, which is exactly
 * how the practice and tutor screens ended up with every card a different
 * width. Explicit pair rows with flex: 1 children make every tile the same
 * width and every row the same height. A tile marked `full` takes a row of
 * its own (the accented "special" tile); an odd leftover keeps half width
 * against an empty spacer instead of ballooning.
 */
export function TileGrid({ tiles }: { tiles: { key: string; full?: boolean; node: React.ReactNode }[] }) {
  const rows: (typeof tiles)[] = [];
  let pair: typeof tiles = [];
  for (const tile of tiles) {
    if (tile.full) {
      if (pair.length) {
        rows.push(pair);
        pair = [];
      }
      rows.push([tile]);
    } else {
      pair.push(tile);
      if (pair.length === 2) {
        rows.push(pair);
        pair = [];
      }
    }
  }
  if (pair.length) rows.push(pair);

  return (
    <View style={{ gap: S.sm }}>
      {rows.map((row, i) => (
        <View key={row[0].key} style={{ flexDirection: rowDir(), gap: S.sm }}>
          {row.map((tile) => (
            <View key={tile.key} style={{ flex: 1 }}>
              {tile.node}
            </View>
          ))}
          {row.length === 1 && !row[0].full ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  /* Section headings are often a subject name, which is Urdu for an Urdu
     student, and Nunito has no Urdu glyphs. Detected here rather than at every
     call site, the same way Header, Item and Pill already do it. It shrinks
     and wraps, so a long heading cannot push the action off the screen. */
  const heading =
    typeof children === 'string' && isUrduScript(children) ? (
      <Ur size={17} style={{ flexShrink: 1 }}>
        {children}
      </Ur>
    ) : (
      <H3 style={{ flexShrink: 1 }}>{children}</H3>
    );
  return (
    <View style={[st.sectionTitle, { flexDirection: rowDir() }]}>
      {heading}
      {action}
    </View>
  );
}

/* --------------------------------------------------------------- surfaces */

export function Card({
  children,
  style,
  onPress,
  flat,
  tint,
  border,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  flat?: boolean;
  tint?: string;
  border?: string;
}) {
  const body = (
    <View
      style={[
        st.card,
        { backgroundColor: C.card, borderColor: C.line },
        !flat && shadow,
        tint ? { backgroundColor: tint } : null,
        border ? { borderColor: border, borderWidth: 1.5 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
  // A pill is label-sized (about 22px tall), and several screens use one as
  // a control: playback speed, review filters, chat feedback. `hit` pads the
  // touchable area out to something a thumb can actually land on.
  return onPress ? (
    <Tap onPress={onPress} hit>
      {body}
    </Tap>
  ) : (
    body
  );
}

/** Pressable with feedback that feels native on each platform. */
export function Tap({
  children,
  onPress,
  style,
  disabled,
  hit,
  slop,
  label,
  role,
  checked,
  selected,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  hit?: boolean;
  /** A touch area bigger than the control on some sides only, for controls
   *  packed side by side where `hit` would overlap the neighbour. */
  slop?: { top?: number; bottom?: number; left?: number; right?: number };
  /** What a screen reader says for a control with no words on it (an icon,
   *  a switch). A control with text needs none: the text is read. */
  label?: string;
  role?: 'button' | 'switch' | 'checkbox' | 'link' | 'radio' | 'tab';
  checked?: boolean;
  /** One of a set of choices, and this one is picked: said aloud as "selected". */
  selected?: boolean;
}) {
  const interactive = !!onPress && !disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={!interactive}
      accessibilityLabel={label}
      accessibilityRole={role ?? (onPress ? 'button' : undefined)}
      accessibilityState={{
        disabled: !interactive,
        ...(checked === undefined ? {} : { checked }),
        ...(selected === undefined ? {} : { selected }),
      }}
      hitSlop={slop ?? (hit ? 12 : undefined)}
      android_ripple={interactive && !hit ? { color: 'rgba(9,106,139,0.10)', foreground: true } : undefined}
      style={({ pressed }) => [
        style,
        pressed && (Platform.OS !== 'android' || hit) ? { opacity: 0.7 } : null,
        isWeb ? ({ cursor: interactive ? 'pointer' : 'default' } as ViewStyle) : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Square checkbox for multi-select, round for single-select.
 * Selected state fills the box, an outline that turns into a floating tick
 * reads as two different controls, which is the bug this replaces.
 */
export function Check({
  on,
  round,
  size = 26,
  onPress,
}: {
  on: boolean;
  round?: boolean;
  size?: number;
  onPress?: () => void;
}) {
  const box = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? size / 2 : 9,
        borderWidth: on ? 0 : 2,
        // The unchecked box, from the palette rather than a literal: the old
        // hex was a light grey-green that stayed light after dark.
        borderColor: C.mute,
        backgroundColor: on ? C.teal : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on ? <Icon name="check" size={size * 0.62} color={C.onBrand} strokeWidth={3} /> : null}
    </View>
  );
  return onPress ? (
    <Tap onPress={onPress} hit>
      {box}
    </Tap>
  ) : (
    box
  );
}

/** Circular icon button used in headers, 44dp target, per platform guidance. */
/** The spoken name of an icon button when its caller gives none. */
const ICON_LABEL: Partial<Record<IconName, StringKey>> = {
  back: 'common.back',
  close: 'common.close',
  gear: 'account.settingsTitle',
  bell: 'account.notifications',
  edit: 'a11y.editProfile',
  camera: 'a11y.addPhoto',
  book: 'a11y.pickChapter',
};

export function IconButton({
  icon,
  onPress,
  tone = 'plain',
  badge,
  size = 44,
  label,
}: {
  icon: IconName;
  onPress?: () => void;
  tone?: 'plain' | 'card' | 'active';
  badge?: boolean;
  size?: number;
  /** Read out instead of the icon's default name; see ICON_LABEL. */
  label?: string;
}) {
  const t = useT();
  const named = label ?? (ICON_LABEL[icon] ? t(ICON_LABEL[icon]!) : undefined);
  const bg = tone === 'card' ? C.card : tone === 'active' ? C.greenTint : 'transparent';
  const border = tone === 'card' ? C.line : tone === 'active' ? C.green : 'transparent';
  const color = tone === 'active' ? C.green : C.ink;
  return (
    <Tap onPress={onPress} label={named}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 14,
          backgroundColor: bg,
          borderWidth: tone === 'plain' ? 0 : 1,
          borderColor: border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={21} color={color} />
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: 9,
              ...(isRTL() ? { left: 9 } : { right: 9 }),
              width: 9,
              height: 9,
              borderRadius: 99,
              backgroundColor: C.orange,
              borderWidth: 2,
              borderColor: C.card,
            }}
          />
        ) : null}
      </View>
    </Tap>
  );
}

/* ---------------------------------------------------------------- controls */

type BtnVariant = 'primary' | 'orange' | 'ghost' | 'line' | 'green' | 'danger' | 'whatsapp';
export function Btn({
  title,
  onPress,
  variant = 'primary',
  icon,
  sm,
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: BtnVariant;
  icon?: IconName;
  sm?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const bg: Record<BtnVariant, string> = {
    primary: C.teal,
    // The bright brand orange, the client's choice over a deeper one (16 Sep).
    orange: C.orange,
    green: C.green,
    danger: C.red,
    whatsapp: C.whatsapp,
    ghost: 'transparent',
    line: C.card,
  };
  // Every filled button carries a WHITE label, the client's explicit call
  // after seeing ink on the orange ("all buttons with dark bg should have
  // light label"). The extra-bold face is what keeps it legible on the
  // brighter fills. Same rule as the web button recipe.
  const fg = variant === 'ghost' || variant === 'line' ? C.teal : C.onBrand;
  return (
    <Tap onPress={onPress} disabled={disabled || loading} label={title} style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
      <View
        style={[
          st.btn,
          { flexDirection: rowDir() },
          { backgroundColor: bg[variant] },
          sm && { paddingVertical: 10, paddingHorizontal: 16, borderRadius: R.md },
          variant === 'line' && { borderWidth: 1.5, borderColor: C.tealTint2 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} size="small" />
        ) : (
          <>
            {icon ? <Icon name={icon} size={sm ? 16 : 18} color={fg} /> : null}
            {/* Shrinks beside the icon and wraps centred, rather than running
                out of the button when the label is long or the font is large. */}
            <Text style={{ fontFamily: F.display, fontSize: sm ? 14 : 16, color: fg, flexShrink: 1, textAlign: 'center' }}>
              {title}
            </Text>
          </>
        )}
      </View>
    </Tap>
  );
}

type Tone = 'teal' | 'orange' | 'green' | 'red' | 'grey';
export function Pill({
  children,
  tone = 'teal',
  icon,
  onPress,
  style,
  lines,
  selected,
}: {
  children?: React.ReactNode;
  tone?: Tone;
  icon?: IconName;
  onPress?: () => void;
  style?: ViewStyle;
  /** Truncate after this many lines, for a pill that has to stay one row
   *  tall. Without it a long label wraps inside the pill. */
  lines?: number;
  /** A pill used as one of a set of choices (a subject, a filter): whether
   *  it is the picked one, for a screen reader. The colour alone said so. */
  selected?: boolean;
}) {
  const map: Record<Tone, [string, string]> = {
    teal: [C.tealTint, C.teal],
    orange: [C.orangeTint, C.orangeDark],
    green: [C.greenTint, C.green],
    red: [C.redTint, C.red],
    grey: [C.grey, C.ink2],
  };
  const [bg, fg] = map[tone];
  // Anything that isn't already an element (string, number, or an interpolated
  // array of them) must be wrapped in <Text>, a bare text node inside a View
  // is invalid in React Native. The label shrinks, and the pill with it:
  // pills carry topics and chapter names, and at full width one of those
  // pushed everything beside it off the screen.
  const body = (
    <View style={[st.pill, { flexDirection: rowDir(), backgroundColor: bg }, style]}>
      {icon ? <Icon name={icon} size={12} color={fg} strokeWidth={2.4} /> : null}
      {children == null || React.isValidElement(children) ? (
        children
      ) : isUrduScript(String(children)) ? (
        <Ur size={12} lines={lines} style={{ color: fg, flexShrink: 1 }}>
          {String(children)}
        </Ur>
      ) : (
        <Text numberOfLines={lines} style={{ fontFamily: F.bodyBold, fontSize: 11.5, color: fg, flexShrink: 1 }}>
          {children}
        </Text>
      )}
    </View>
  );
  // A pill is label-sized (about 22px tall), and several screens use one as
  // a control: playback speed, review filters, chat feedback. `hit` pads the
  // touchable area out to something a thumb can actually land on.
  return onPress ? (
    <Tap onPress={onPress} hit style={st.pillTap} selected={selected}>
      {body}
    </Tap>
  ) : (
    body
  );
}

export function Seg<Tv extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: Tv; label: string; urdu?: boolean }[];
  value: Tv;
  onChange: (v: Tv) => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[st.seg, { flexDirection: rowDir(), backgroundColor: C.grey }, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          // Said as one of a set, with the picked one "selected", and a touch
          // area reaching above and below the 36dp bar to a thumb's 44 plus.
          <Tap
            key={o.value}
            onPress={() => onChange(o.value)}
            role="radio"
            selected={on}
            slop={{ top: 7, bottom: 7 }}
            style={[st.segBtn, on && { backgroundColor: C.card }]}
          >
            {/* One line height for both scripts; see LanguageToggle for why.
                One line, shrinking a little to fit: every slot is an equal
                share of the width, and at a large font "English" broke in the
                middle of the word and doubled the control's height. */}
            {o.urdu ? (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{
                  fontFamily: F.urduBold,
                  fontSize: 14,
                  lineHeight: 36,
                  includeFontPadding: false,
                  color: on ? C.teal : C.ink2,
                  textAlign: 'center',
                }}
              >
                {o.label}
              </Text>
            ) : (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{
                  fontFamily: F.bodyBold,
                  fontSize: 13,
                  lineHeight: 36,
                  includeFontPadding: false,
                  color: on ? C.teal : C.ink2,
                  textAlign: 'center',
                }}
              >
                {o.label}
              </Text>
            )}
          </Tap>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  icon,
  secure,
  keyboardType,
  error,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  /** When the student leaves the field: the moment to judge what they typed. */
  onBlur?: () => void;
  placeholder?: string;
  icon?: IconName;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  error?: string;
  autoCapitalize?: 'none' | 'words' | 'characters';
}) {
  const t = useT();
  const [hide, setHide] = useState(!!secure);
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: S.md }}>
      <Text style={[T.tiny, { marginBottom: 6, color: C.ink2 }]}>{label}</Text>
      <View style={[st.field, { flexDirection: rowDir(), backgroundColor: C.card, borderColor: C.line }, focus && { borderColor: C.teal }, !!error && { borderColor: C.red }]}>
        {icon ? <Icon name={icon} size={18} color={C.ink3} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.ink3}
          secureTextEntry={hide}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false);
            onBlur?.();
          }}
          style={[
            // What a student types reads the same way as everything else on
            // screen, and an Urdu keyboard filling an input from the left is
            // the first thing that gives away a half-mirrored app.
            { flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink, paddingVertical: 0, textAlign: textStart() },
            isWeb && ({ outlineStyle: 'none' } as object),
          ]}
        />
        {secure ? (
          <Tap onPress={() => setHide((h) => !h)} hit label={t(hide ? 'a11y.showPassword' : 'a11y.hidePassword')}>
            <Icon name={hide ? 'eye' : 'eyeOff'} size={18} color={C.ink3} />
          </Tap>
        ) : null}
      </View>
      {error ? <Text style={[T.tiny, { color: C.red, marginTop: 4 }]}>{error}</Text> : null}
    </View>
  );
}

export function Toggle({ on, onPress, label }: { on: boolean; onPress?: () => void; label?: string }) {
  // The track is 26px tall; `hit` pads the touchable to a real target.
  return (
    <Tap onPress={onPress} hit role="switch" checked={on} label={label}>
      {/* The off track and the knob are tokens now. Written as literals they
          kept their light values after dark, so a settings screen at night had
          a row of bright grey-green pills on it. */}
      <View style={[st.toggle, { backgroundColor: on ? C.teal : C.mute }]}>
        <View style={[st.knob, { backgroundColor: C.card }, (on ? !isRTL() : isRTL()) ? { right: 3 } : { left: 3 }]} />
      </View>
    </Tap>
  );
}

/* ------------------------------------------------------------ indicators */

export function Bar({ pct, tone = 'orange', h = 7 }: { pct: number; tone?: 'orange' | 'teal' | 'green' | 'red'; h?: number }) {
  const col = { orange: C.orange, teal: C.teal, green: C.green, red: C.red }[tone];
  return (
    <View
      style={{
        height: h,
        backgroundColor: C.track,
        borderRadius: R.pill,
        overflow: 'hidden',
        // Progress grows the way the language reads, so a bar filling left to
        // right under Urdu text would read as emptying.
        alignItems: isRTL() ? 'flex-end' : 'flex-start',
      }}
    >
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: col, borderRadius: R.pill }} />
    </View>
  );
}

export function Ring({
  pct,
  size = 54,
  stroke = 7,
  color = C.teal,
  fill,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  /** Paints the ring's whole interior. Drawn inside the same SVG, tucked
   *  1px under the stroke, so no layout rounding can open a hairline gap
   *  the way a separately positioned disc did. */
  fill?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', transform: isRTL() ? [{ rotate: '-90deg' }, { scaleY: -1 }] : [{ rotate: '-90deg' }] }}>
        <Svg width={size} height={size}>
          {fill ? <Circle cx={size / 2} cy={size / 2} r={r - stroke / 2 + 1} fill={fill} /> : null}
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.track} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - Math.max(0, Math.min(100, pct)) / 100)}
          />
        </Svg>
      </View>
      {/* zIndex keeps the content above the ring's SVG: on the web an
          absolutely positioned sibling paints over static children, which
          swallowed the icon the moment the interior gained an opaque fill. */}
      <View style={{ zIndex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}

export function Kpi({ value, label, small }: { value: string; label: string; small?: boolean }) {
  /**
   * Tiles that share a row share a height. Values wrap differently ("2h 15m"
   * against "94%"), and without a floor each tile sized to its own content,
   * so one KPI in a row of three stood taller than its siblings. The floor
   * plus centred content means ragged text can never move the chrome, and
   * tabular figures keep the numbers from shifting as they change.
   */
  return (
    <View style={[st.kpi, { backgroundColor: C.card, borderColor: C.line }, small ? { paddingVertical: 10, paddingHorizontal: 10, minHeight: 58 } : { minHeight: 74 }]}>
      <Text
        style={{ fontFamily: F.display, fontSize: small ? 17 : 22, color: C.ink, fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
      >
        {value}
      </Text>
      {/* Two lines: in a row of narrow tiles, and at a large font, one line
          cut "Active days" down to "Active d…". */}
      <Text style={{ fontFamily: F.bodyBold, fontSize: small ? 10.5 : 11.5, color: C.ink2 }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/** List row used across study, practice, settings. */
export function Item({
  title,
  sub,
  icon,
  emoji,
  tone = 'teal',
  right,
  onPress,
  pct,
  urduTitle,
  last,
  dim,
  checked,
}: {
  title: string;
  sub?: string;
  icon?: IconName;
  emoji?: string;
  tone?: 'teal' | 'orange' | 'green' | 'red' | 'grey';
  right?: React.ReactNode;
  onPress?: () => void;
  pct?: number;
  urduTitle?: boolean;
  last?: boolean;
  dim?: boolean;
  /** A row that is one of a list of choices with a tick beside it: whether it
   *  is ticked, for a screen reader, which heard only the title. */
  checked?: boolean;
}) {
  const bgMap = { teal: C.tealTint, orange: C.orangeTint, green: C.greenTint, red: C.redTint, grey: C.grey };
  const fgMap = { teal: C.teal, orange: C.orangeDark, green: C.green, red: C.red, grey: C.ink2 };
  /**
   * Rows carry content, not just labels: weak topics, chat titles, AI set
   * names and chapter names all land here and any of them can be Urdu. The
   * script decides the face and the direction, so a caller cannot forget to
   * say so. `urduTitle` stays as an override for a title we know is Urdu
   * before it arrives.
   */
  const rtl = isRTL() || urduTitle || isUrduScript(title) || isUrduScript(sub ?? '');
  return (
    <Tap
      onPress={onPress}
      role={checked === undefined ? undefined : 'checkbox'}
      checked={checked}
      style={[
        st.item,
        { borderBottomColor: C.line },
        rtl && { flexDirection: 'row-reverse' },
        last && { borderBottomWidth: 0 },
        dim && { opacity: 0.6 },
      ]}
    >
      {emoji || icon ? (
        <View style={[st.itemIcon, { backgroundColor: bgMap[tone] }]}>
          {emoji ? <Text style={{ fontSize: 19 }}>{emoji}</Text> : <Icon name={icon!} size={20} color={fgMap[tone]} />}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {urduTitle || isUrduScript(title) ? (
          <Ur size={15}>{title}</Ur>
        ) : (
          <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>{title}</Text>
        )}
        {sub ? (
          isUrduScript(sub) ? (
            <Ur size={13} style={{ color: C.ink2, marginTop: 1 }}>{sub}</Ur>
          ) : (
            <Small style={{ marginTop: 1 }}>{sub}</Small>
          )
        ) : null}
        {pct != null ? (
          <View style={{ marginTop: 7 }}>
            <Bar pct={pct} tone="teal" />
          </View>
        ) : null}
      </View>
      {right ?? (onPress ? <Chevron /> : null)}
    </Tap>
  );
}

/**
 * The "go on" arrow. Mirrored in Urdu, because an arrow is a direction, not a
 * decoration: pointing right in a right-to-left app points back the way the
 * student came.
 */
export function Chevron({ size = 18, color = C.ink3 }: { size?: number; color?: string }) {
  // Icon mirrors the directional glyphs itself now, so there is nothing left
  // for this to do but name the role.
  return <Icon name="chevron" size={size} color={color} />;
}

/* ------------------------------------------------------------ feedback */

/**
 * Ask before doing something that cannot be undone.
 *
 * Every confirmation in the app was the same six lines written out again:
 * a Sheet, a title, a sentence, the action, a spacer, and a ghost "no". Six
 * copies meant six chances for the spacing, the button order or the tone to
 * drift, and two of them already had. One component means the answer button is
 * always in the same place and the way out is always the same word.
 *
 * The cancel is a ghost button AND the backdrop, so there are two ways out and
 * neither is the destructive one. `tone` colours only the confirm.
 */
export function Confirm({
  visible,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  cancelLabel,
  tone = 'danger',
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** A string, or your own nodes when the sentence needs more than one style. */
  body: string | React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel: string;
  tone?: 'danger' | 'orange' | 'primary';
  loading?: boolean;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {typeof body === 'string' ? <Small>{body}</Small> : body}
      <Spacer h={S.lg} />
      <Btn title={confirmLabel} variant={tone} onPress={onConfirm} loading={loading} />
      <Spacer h={S.sm} />
      <Btn title={cancelLabel} variant="ghost" onPress={onClose} disabled={loading} />
    </Sheet>
  );
}

export function Skeleton({
  w = '100%',
  h = 14,
  tone = 'default',
  style,
}: {
  w?: number | `${number}%`;
  h?: number;
  /**
   * Tints the bar with the colour of the text it stands in for, instead of the
   * neutral track. Worth it on a tinted card, where a grey bar reads as a
   * foreign object and a faint ink one reads as the sentence arriving. The
   * default stays neutral for the skeletons that stand in for something other
   * than prose.
   */
  tone?: 'default' | 'ink' | 'ink2';
  style?: ViewStyle;
}) {
  /**
   * `useState` with a lazy initialiser, not `useRef(new Animated.Value(…)).current`.
   *
   * The ref form is everywhere in React Native tutorials and it is wrong twice
   * over: it builds a fresh Animated.Value on every render only to discard it,
   * and reading `.current` while rendering is exactly what refs are not for.
   * A lazy initialiser runs once and React guarantees the value survives, which
   * is the property the animation actually needs.
   */
  const [a] = useState(() => new Animated.Value(0.5));
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 620, useNativeDriver: !isWeb }),
        Animated.timing(a, { toValue: 0.5, duration: 620, useNativeDriver: !isWeb }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  // Eight-digit hex, so the tint composes with the pulse rather than replacing
  // it. 1F is 12%, which the 0.5 to 1 pulse renders as roughly 6% to 12%.
  const fill = tone === 'ink' ? `${C.ink}1F` : tone === 'ink2' ? `${C.ink2}1F` : C.track;
  return <Animated.View style={[{ width: w, height: h, borderRadius: R.md, backgroundColor: fill, opacity: a }, style]} />;
}

/**
 * A fetch failed and the screen would otherwise render its empty state, which
 * lies: "no results" and "the network is down" call for opposite reactions.
 * Every consumer of useAsync that can fail user-visibly should branch to this
 * with the hook's own reload.
 */
export function ErrorState({ title, sub, retry, onRetry }: { title: string; sub: string; retry: string; onRetry: () => void }) {
  return (
    <Card flat tint={C.redTint} style={{ alignItems: 'center', gap: S.sm, paddingVertical: 22 }}>
      <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>{title}</Text>
      <Small style={{ textAlign: 'center' }}>{sub}</Small>
      <Btn title={retry} variant="line" sm onPress={onRetry} />
    </Card>
  );
}

export function Empty({
  emoji = '📭',
  title,
  sub,
  cta,
}: {
  emoji?: string;
  title: string;
  sub?: string;
  cta?: React.ReactNode;
}) {
  return (
    <Card flat style={{ alignItems: 'center', paddingVertical: 26 }}>
      {/* The emoji sits on a soft tinted disc so an empty screen still looks
          designed rather than abandoned. */}
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 99,
          backgroundColor: C.tealTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 34 }}>{emoji}</Text>
      </View>
      <H3 style={{ marginTop: 10, textAlign: 'center' }}>{title}</H3>
      {sub ? <Small style={{ textAlign: 'center', marginTop: 3 }}>{sub}</Small> : null}
      {cta ? <View style={{ marginTop: S.md }}>{cta}</View> : null}
    </Card>
  );
}


/* --------------------------------------------------------------- toast */

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

/** What the toast is showing right now, for every layer that draws it. */
const ToastShownCtx = createContext<{ msg: string | null; op: Animated.Value } | null>(null);

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [op] = useState(() => new Animated.Value(0));
  // A real ref: only ever written and read from the show handler, never in render.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (m: string) => {
      setMsg(m);
      Animated.timing(op, { toValue: 1, duration: 160, useNativeDriver: !isWeb }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: !isWeb }).start(() => setMsg(null));
      }, 2000);
    },
    [op]
  );

  const value = useMemo(() => show, [show]);
  const shown = useMemo(() => ({ msg, op }), [msg, op]);
  return (
    <ToastCtx.Provider value={value}>
      <ToastShownCtx.Provider value={shown}>
        {children}
        <ToastLayer />
      </ToastShownCtx.Provider>
    </ToastCtx.Provider>
  );
}

/**
 * The toast itself, near the top of the screen.
 *
 * It sat 100dp off the bottom, which on a phone with three-button navigation
 * is on top of the tab bar, over a screen's footer button, and behind the
 * keyboard in chat. The top of the screen has none of those.
 *
 * Drawn by the host and again inside every open Sheet, at the same spot. A
 * Sheet is a window of its own on Android, above the one the host draws in,
 * so "link copied" from inside the locked-content sheet was being shown
 * underneath it where nobody could see it.
 */
function ToastLayer() {
  const shown = useContext(ToastShownCtx);
  const insets = useSafeAreaInsets();
  if (!shown?.msg) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[st.toast, { top: insets.top + 56, opacity: shown.op, backgroundColor: C.ink }]}
    >
      <Text style={{ color: C.paper, fontFamily: F.bodyBold, fontSize: 13, textAlign: 'center' }}>{shown.msg}</Text>
    </Animated.View>
  );
}

/** Space above an open sheet, below the status bar, so it still reads as a sheet over the page. */
const SHEET_TOP_GAP = 56;

/**
 * Bottom sheet used for paywall, confirmations, Ask AI.
 *
 * Everything below the title scrolls. The panel used to be capped at 82% of
 * the screen with no way to scroll, so a long Ask AI answer, the chapter
 * picker's last rows and, in Urdu on a short phone, the last reminder times
 * ran off the bottom edge where nobody could reach them.
 *
 * `scroll={false}` is for content that brings its own scroller and wants to
 * keep something above it pinned, as the chapter picker keeps its search box.
 */
export function Sheet({
  visible,
  onClose,
  children,
  title,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  scroll?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SheetPanel onClose={onClose} title={title} scroll={scroll}>
        {children}
      </SheetPanel>
      <ToastLayer />
    </Modal>
  );
}

/**
 * The panel, split out so its listeners only exist while a sheet is open: a
 * screen can hold several closed sheets, and Modal renders nothing for those.
 */
function SheetPanel({
  onClose,
  children,
  title,
  scroll,
}: {
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  scroll: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardOverlap();
  /**
   * The modal is drawn edge to edge, under the status bar and the navigation
   * bar, so it has to clear both itself. A fixed 28dp at the bottom left the
   * last button half under the system buttons on a three-button phone. When
   * the keyboard is up it covers the navigation bar, so the panel sits on the
   * keys instead: the chapter picker's search box and its results used to be
   * hidden behind them.
   */
  const bottom = keyboard > 0 ? keyboard + S.md : Math.max(insets.bottom, S.md) + S.lg;
  return (
    <Pressable style={[st.sheetBack, { paddingTop: insets.top + SHEET_TOP_GAP }]} onPress={onClose}>
      <Pressable style={[st.sheet, { backgroundColor: C.paper, paddingBottom: bottom }]} onPress={() => {}}>
        <View style={[st.grab, { backgroundColor: C.mute }]} />
        {title ? (
          isUrduScript(title) ? (
            <Ur size={19} style={{ marginBottom: S.sm }}>{title}</Ur>
          ) : (
            <H2 style={{ marginBottom: S.sm }}>{title}</H2>
          )
        ) : null}
        {scroll ? (
          // Hugs its content until the panel reaches the top gap, then
          // scrolls. flexShrink is what lets it give way; the panel above
          // shrinks to fit the screen and this is the part that absorbs it.
          // The scrollbar stays on screen whenever there is more below. It was
          // hidden, so a long answer cut off at the bottom edge looked like
          // text overflowing the sheet, with nothing to say it would scroll.
          <ScrollView
            style={{ flexGrow: 0, flexShrink: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            persistentScrollbar
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </Pressable>
    </Pressable>
  );
}

/* --------------------------------------------------------------- styles */

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    paddingTop: S.sm,
    paddingBottom: S.sm,
    minHeight: 52,
  },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: S.sm,
    marginTop: S.lg,
    marginBottom: S.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: R.lg,
    padding: S.lg,
    /**
     * Deliberately NOT `overflow: 'hidden'`.
     *
     * Clipping to a rounded corner makes Android render the card into an
     * offscreen layer, and on some devices that layer intermittently comes
     * back empty: the reader's tinted example and definition boxes would
     * paint as blank coloured rectangles over real text. A border was added
     * earlier and helped, because it pushes the view onto a different draw
     * path, but it did not remove the clip that causes it.
     *
     * Nothing inside a card needs clipping. The two children that have square
     * corners of their own, the progress bar and the segmented control, clip
     * themselves.
     */
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    paddingVertical: 14,
    paddingHorizontal: S.lg,
    borderRadius: R.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: R.pill,
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
  },
  // The touchable around a pressable pill is what sits in the row, so it has
  // to be the thing that gives way.
  pillTap: { flexShrink: 1, maxWidth: '100%' },
  seg: { flexDirection: 'row', borderRadius: 13, padding: 3, gap: 3 },
  // overflow hidden clips Android's ripple layer to the radius; without it the
  // pressed and selected states could paint a square outside the corners. The
  // elevation shadow went for the same reason: a white pill on a grey track
  // needs no shadow, and elevation drew its own rectangle behind the radius.
  // No fixed height and no overflow clip: Nastaliq needs about twice the
  // leading of Latin and its ink hangs below the baseline, so a 36px box with
  // `overflow: hidden` cut the descenders off its own Urdu label. (The same
  // clip is what made example boxes render blank on Android.)
  segBtn: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
    borderRadius: R.sm,
    alignItems: 'center',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  toggle: { width: 44, height: 26, borderRadius: R.pill, justifyContent: 'center' },
  knob: { position: 'absolute', width: 20, height: 20, borderRadius: R.pill },
  kpi: {
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: R.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingVertical: 14,
    minHeight: 62,
    borderBottomWidth: 1,
  },
  itemIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  // `top` is set where it is drawn, from the status-bar inset.
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 320,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: R.pill,
  },
  sheetBack: { flex: 1, backgroundColor: 'rgba(11,46,58,0.45)', justifyContent: 'flex-end' },
  // No height cap of its own: the backdrop's top padding is the cap, and
  // flexShrink lets the panel give way to it instead of running off the top.
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: S.lg,
    flexShrink: 1,
    width: '100%',
    ...(isWeb ? { maxWidth: 520, alignSelf: 'center' } : null),
  },
  grab: { width: 44, height: 5, borderRadius: R.pill, alignSelf: 'center', marginBottom: S.md },
});

export { st as uiStyles };
