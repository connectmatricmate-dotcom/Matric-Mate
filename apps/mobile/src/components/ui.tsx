/**
 * MatricMate shared UI kit. Every screen composes these, no screen styles colours directly.
 * Works identically on Android and web (React Native Web).
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { C, F, R, S, T, WEB_MAX, isRTL, isWeb, rowDir, shadow, textStart, urdu } from '../theme';
import { isUrduScript } from '@matricmate/core';
import { Icon, IconName } from './Icon';

/* ------------------------------------------------------------------ text */

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
export function Ur({ children, size = 16, style }: { children: React.ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return <Text style={[urdu(size), style]}>{children}</Text>;
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
  const fontFamily = face === 'display' ? F.display : face === 'bodyBold' ? F.bodyBold : F.body;
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

/* ---------------------------------------------------------------- layout */

/**
 * Page wrapper. Handles the three things every screen needs:
 * the status-bar inset at the top, the gesture-bar inset at the bottom, and
 * (on web) a centred column instead of full-bleed text.
 *
 * `tabbed`, set on the five tab roots, where the tab bar already occupies the
 * bottom inset and adding it again would leave a dead gap.
 */
export function Screen({
  children,
  scroll = true,
  footer,
  padded = true,
  tabbed = false,
  avoidKeyboard = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  footer?: React.ReactNode;
  padded?: boolean;
  tabbed?: boolean;
  avoidKeyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();

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

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        { paddingHorizontal: padded ? S.lg : 0, paddingBottom: bottomGap },
        isWeb && { maxWidth: WEB_MAX, width: '100%', alignSelf: 'center' },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, width: '100%' }, isWeb && { maxWidth: WEB_MAX, alignSelf: 'center' }]}>
      {children}
    </View>
  );

  const content = (
    <View style={{ flex: 1, backgroundColor: C.paper, paddingTop: topGap }}>
      {body}
      {footer ? (
        <View
          style={[
            {
              paddingHorizontal: S.lg,
              paddingTop: S.sm,
              // The footer button clears the gesture pill instead of hugging it.
              paddingBottom: tabbed ? S.md : Math.max(insets.bottom, S.md) + S.sm,
            },
            isWeb && { maxWidth: WEB_MAX, width: '100%', alignSelf: 'center' },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );

  // Forms need the keyboard pushed out of the way rather than covering the CTA.
  return avoidKeyboard ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );
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
  return (
    <View style={[st.header, { flexDirection: rowDir() }]}>
      {back ? (
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
  return (
    <View style={[st.sectionTitle, { flexDirection: rowDir() }]}>
      <H3>{children}</H3>
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
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  hit?: boolean;
}) {
  const interactive = !!onPress && !disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={!interactive}
      hitSlop={hit ? 12 : undefined}
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
        borderColor: '#CBD8D3',
        backgroundColor: on ? C.teal : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on ? <Icon name="check" size={size * 0.62} color="#fff" strokeWidth={3} /> : null}
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
export function IconButton({
  icon,
  onPress,
  tone = 'plain',
  badge,
  size = 44,
}: {
  icon: IconName;
  onPress?: () => void;
  tone?: 'plain' | 'card' | 'active';
  badge?: boolean;
  size?: number;
}) {
  const bg = tone === 'card' ? C.card : tone === 'active' ? C.greenTint : 'transparent';
  const border = tone === 'card' ? C.line : tone === 'active' ? C.green : 'transparent';
  const color = tone === 'active' ? C.green : C.ink;
  return (
    <Tap onPress={onPress}>
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
  const fg = variant === 'ghost' || variant === 'line' ? C.teal : '#fff';
  return (
    <Tap onPress={onPress} disabled={disabled || loading} style={[{ opacity: disabled ? 0.45 : 1 }, style]}>
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
            <Text style={{ fontFamily: F.display, fontSize: sm ? 14 : 16, color: fg }}>{title}</Text>
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
}: {
  children?: React.ReactNode;
  tone?: Tone;
  icon?: IconName;
  onPress?: () => void;
  style?: ViewStyle;
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
  // is invalid in React Native.
  const body = (
    <View style={[st.pill, { flexDirection: rowDir(), backgroundColor: bg }, style]}>
      {icon ? <Icon name={icon} size={12} color={fg} strokeWidth={2.4} /> : null}
      {children == null || React.isValidElement(children) ? (
        children
      ) : isUrduScript(String(children)) ? (
        // Pills carry topics and chapter names, not only fixed labels.
        <Ur size={12} style={{ color: fg }}>{String(children)}</Ur>
      ) : (
        <Text style={{ fontFamily: F.bodyBold, fontSize: 11.5, color: fg }}>{children}</Text>
      )}
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
    <View style={[st.seg, { flexDirection: rowDir() }, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Tap key={o.value} onPress={() => onChange(o.value)} style={[st.segBtn, on && st.segBtnOn]}>
            {/* One line height for both scripts; see LanguageToggle for why. */}
            {o.urdu ? (
              <Text
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
  placeholder?: string;
  icon?: IconName;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  error?: string;
  autoCapitalize?: 'none' | 'words';
}) {
  const [hide, setHide] = useState(!!secure);
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: S.md }}>
      <Text style={[T.tiny, { marginBottom: 6, color: C.ink2 }]}>{label}</Text>
      <View style={[st.field, { flexDirection: rowDir() }, focus && { borderColor: C.teal }, !!error && { borderColor: C.red }]}>
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
          onBlur={() => setFocus(false)}
          style={[
            // What a student types reads the same way as everything else on
            // screen, and an Urdu keyboard filling an input from the left is
            // the first thing that gives away a half-mirrored app.
            { flex: 1, fontFamily: F.body, fontSize: 15, color: C.ink, paddingVertical: 0, textAlign: textStart() },
            isWeb && ({ outlineStyle: 'none' } as object),
          ]}
        />
        {secure ? (
          <Tap onPress={() => setHide((h) => !h)} hit>
            <Icon name={hide ? 'eye' : 'eyeOff'} size={18} color={C.ink3} />
          </Tap>
        ) : null}
      </View>
      {error ? <Text style={[T.tiny, { color: C.red, marginTop: 4 }]}>{error}</Text> : null}
    </View>
  );
}

export function Toggle({ on, onPress }: { on: boolean; onPress?: () => void }) {
  // The track is 26px tall; `hit` pads the touchable to a real target.
  return (
    <Tap onPress={onPress} hit>
      <View style={[st.toggle, { backgroundColor: on ? C.teal : '#D7E0DB' }]}>
        <View style={[st.knob, (on ? !isRTL() : isRTL()) ? { right: 3 } : { left: 3 }]} />
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
        backgroundColor: '#EAF0EC',
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
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#EAF0EC" strokeWidth={stroke} fill="none" />
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
    <View style={[st.kpi, small ? { paddingVertical: 10, paddingHorizontal: 10, minHeight: 58 } : { minHeight: 74 }]}>
      <Text
        style={{ fontFamily: F.display, fontSize: small ? 17 : 22, color: C.ink, fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={{ fontFamily: F.bodyBold, fontSize: small ? 10.5 : 11.5, color: C.ink2 }} numberOfLines={1}>
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
      style={[
        st.item,
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
  return (
    <View style={isRTL() ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Icon name="chevron" size={size} color={color} />
    </View>
  );
}

/* ------------------------------------------------------------ feedback */

export function Skeleton({ w = '100%', h = 14, style }: { w?: number | `${number}%`; h?: number; style?: ViewStyle }) {
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
  return <Animated.View style={[{ width: w, height: h, borderRadius: R.md, backgroundColor: '#EAF0EC', opacity: a }, style]} />;
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
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {msg ? (
        <Animated.View pointerEvents="none" style={[st.toast, { opacity: op }]}>
          <Text style={{ color: '#fff', fontFamily: F.bodyBold, fontSize: 13, textAlign: 'center' }}>{msg}</Text>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

/** Bottom sheet used for paywall, confirmations, Ask AI. */
export function Sheet({
  visible,
  onClose,
  children,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.sheetBack} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <View style={st.grab} />
          {title ? (
            isUrduScript(title) ? (
              <Ur size={19} style={{ marginBottom: S.sm }}>{title}</Ur>
            ) : (
              <H2 style={{ marginBottom: S.sm }}>{title}</H2>
            )
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
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
    marginTop: S.lg,
    marginBottom: S.sm,
  },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
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
  },
  seg: { flexDirection: 'row', backgroundColor: C.grey, borderRadius: 13, padding: 3, gap: 3 },
  // overflow hidden clips Android's ripple layer to the radius; without it the
  // pressed and selected states could paint a square outside the corners. The
  // elevation shadow went for the same reason: a white pill on a grey track
  // needs no shadow, and elevation drew its own rectangle behind the radius.
  // No fixed height and no overflow clip: Nastaliq needs about twice the
  // leading of Latin and its ink hangs below the baseline, so a 36px box with
  // `overflow: hidden` cut the descenders off its own Urdu label. (The same
  // clip is what made example boxes render blank on Android.)
  segBtn: { flex: 1, minHeight: 36, paddingVertical: 4, justifyContent: 'center', borderRadius: R.sm, alignItems: 'center' },
  segBtnOn: { backgroundColor: C.card },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  toggle: { width: 44, height: 26, borderRadius: R.pill, justifyContent: 'center' },
  knob: { position: 'absolute', width: 20, height: 20, borderRadius: R.pill, backgroundColor: '#fff' },
  kpi: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
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
    borderBottomColor: C.line,
  },
  itemIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    maxWidth: 320,
    backgroundColor: C.ink,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: R.pill,
  },
  sheetBack: { flex: 1, backgroundColor: 'rgba(11,46,58,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: S.lg,
    paddingBottom: S.xxl,
    maxHeight: '82%',
    width: '100%',
    ...(isWeb ? { maxWidth: 520, alignSelf: 'center' } : null),
  },
  grab: { width: 44, height: 5, borderRadius: R.pill, backgroundColor: '#C9D6D2', alignSelf: 'center', marginBottom: S.md },
});

export { st as uiStyles };
