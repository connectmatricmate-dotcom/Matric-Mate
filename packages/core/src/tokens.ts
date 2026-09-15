/**
 * Design tokens, sampled from the client's logo (docs/assets/brand/BRAND.md).
 *
 * Shared so the two apps cannot drift: the Android app reads these objects
 * directly, and the web app generates CSS custom properties from them. Change a
 * colour here and both surfaces move.
 */

export const colors = {
  /** Primary. Brightened from #096A8B: the old one read as grey-blue on a
   * phone in daylight and the client could not tell it apart from the ink.
   * Then a shade back from #0A7EA4, which as text sat at 4.0:1 on its own tint
   * and 4.5 on paper; this one clears 4.5:1 on every light ground and carries
   * white at 5.2:1. */
  teal: '#087598',
  tealDark: '#063D52',
  /** The darkest ground, for the landing hero and any full-bleed dark band.
   * White sits on it at 16:1. */
  night: '#04222F',
  /** Glow accent. Only ever appears on a dark ground, where it reads at 8:1,
   * in gradients, focus glows and the live-demo highlight. Never on paper. */
  cyan: '#22C7D6',
  tealTint: '#E4F1F6',
  tealTint2: '#C9E4EE',
  ink: '#0F3D4C',
  /** Secondary copy. Darkened from #517682 (4.7:1 on paper) after the client
   * reported the greyer text was hard to read; now 6.2:1. */
  ink2: '#3E6473',
  /** Fine print and placeholders only; meaningful copy uses ink2. Darkened
   * three times: #8AA4AD sat at 2.5:1, #6E8B96 at 3.5:1, #587A87 at 4.0:1 on
   * the tints. Now 4.8:1 on the palest tint and 5.3:1 on paper. */
  ink3: '#4D6D7A',
  paper: '#FAFBF7',
  card: '#FFFFFF',
  /** Borders. #E4EAE6 read as invisible (1.2:1 against card), so grouped
   * content looked like one sheet; this step keeps borders quiet but present. */
  line: '#D9E2DC',
  /** The one neutral for empty progress tracks, rings and skeletons. Five
   * hand-picked greys used to share this role; this is the survivor. */
  track: '#EAF0EC',
  /** Inactive control surfaces: an off toggle, an unchecked box, a step dot. */
  mute: '#D7E0DB',
  /** Hotter than the old #F29329, which went muddy next to the brighter
   * primary. Reads at 7:1 on night, and carries ink at 5:1. */
  orange: '#FF8A00',
  /** Orange as TEXT (labels on tints and cards). Fills stay `orange`. */
  orangeDark: '#A85700',
  orangeTint: '#FFF0DC',
  /** Deepened from #2E9E5B, which as text on its own tint was 3.0:1 and
   * carried a white label at 3.4:1. Now 4.7:1 and 5.3:1. */
  green: '#1E7B45',
  greenTint: '#E7F5EC',
  /** Deepened from #D9534F, which carried a white label (Delete, Missed) at
   * 4.0:1 and was 3.5:1 as text on its own tint. Now 5.4:1 and 4.7:1. */
  red: '#C0392B',
  redTint: '#FBECEB',
  grey: '#EFF3F0',
  whatsapp: '#25D366',
  /**
   * Text and icons sitting ON a saturated fill: a primary button, a tone
   * badge, the play control on a teal disc.
   *
   * It was written as a literal white in both apps, which is correct here and
   * wrong after dark. A dark theme's brand colours have to brighten to stay
   * visible on a dark ground, and white on a brightened teal falls to 2.4:1.
   * Naming the foreground lets it flip with the palette: dark text on a bright
   * fill is what every dark interface ends up doing.
   */
  onBrand: '#FFFFFF',
} as const;

/** Every colour role, as one object. `ColorToken` is declared further down. */
export type Palette = Record<ColorToken, string>;

/**
 * The same tokens after dark, so nothing in either app has to know a second
 * set of names.
 *
 * Every screen in both apps already styles exclusively through these keys, so
 * dark mode is this object plus a switch: no component chooses a colour, and
 * none of them needs a dark variant. That is the whole reason the palette was
 * kept semantic rather than literal.
 *
 * It is not an inversion. Flipping lightness turns a warm paper white into a
 * flat grey and leaves the brand teal glowing at a strength that hurts at
 * night. This is built from the brand's own dark end instead, `night` and
 * `tealDark`, so the dark app reads as the same product with the lights off:
 *
 *   · grounds are the deep blue-teal of the landing hero, not neutral black,
 *     which is also why a pure #000 never appears here
 *   · surfaces get lighter as they come forward: paper, then card, then grey
 *   · text lightens rather than dimming; ink holds ~15:1 on paper, ink2 ~8:1
 *     and ink3 ~5:1, so the same three tiers stay legible and stay distinct
 *   · saturated colours are lifted, because a mid-tone that sings on white
 *     goes muddy on a dark ground: teal, orange, green and red all brighten
 *   · the tints inverted their job. On paper a tint is a pale wash of a hue;
 *     here it is a dark, desaturated version of it, still clearly that hue
 *     but able to carry light text
 *   · `orangeDark` is the one that catches people out. It exists to write
 *     orange as TEXT, so on a dark ground it has to become lighter than
 *     `orange`, not darker. Same for `tealDark`, which is a hover state.
 */
export const darkColors: Palette = {
  /* Brand, lifted so it reads on a dark ground rather than sinking into it. */
  teal: '#3FB6DC',
  /* A hover and pressed state, and inline code. Lighter than teal here. */
  tealDark: '#8FD6EE',
  /* Unchanged: it was always the dark end, and the hero still uses it. */
  night: '#04222F',
  cyan: '#22C7D6',
  /* Tints are now dark washes that carry light text, not pale ones. */
  tealTint: '#103848',
  tealTint2: '#164C61',
  ink: '#EAF4F7',
  ink2: '#A9C6D1',
  ink3: '#7FA3B1',
  /* The three grounds, in the order they stack. */
  paper: '#07202B',
  card: '#0E2E3B',
  grey: '#143A48',
  /* Quiet but present, the same job the light border has. */
  line: '#1D4757',
  track: '#173F4E',
  mute: '#2A5A6B',
  orange: '#FF9F2E',
  orangeDark: '#FFC178',
  orangeTint: '#3A2712',
  green: '#48C77A',
  greenTint: '#123322',
  red: '#F2726E',
  redTint: '#3A1E1D',
  /* Their own brand colours, and not ours to restyle. */
  whatsapp: '#25D366',
  /* Dark ink on the lifted fills, 7:1 on teal and no worse than 5.8:1 on any
     of them. White here would have been 2.4:1. */
  onBrand: '#04222F',
};

/** Font families. The web app self-hosts the same three faces. */
export const fonts = {
  display: 'Baloo2_700Bold',
  displayMd: 'Baloo2_600SemiBold',
  body: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_800ExtraBold',
  bodyReg: 'Nunito_400Regular',
  urdu: 'NotoNastaliqUrdu_400Regular',
  urduBold: 'NotoNastaliqUrdu_600SemiBold',
} as const;

/** Web equivalents. CSS font stacks for the same faces. */
export const webFontStacks = {
  display: '"Baloo 2", ui-rounded, system-ui, sans-serif',
  body: 'Nunito, system-ui, -apple-system, "Segoe UI", sans-serif',
  urdu: '"Noto Nastaliq Urdu", serif',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Type scale, in px. Both platforms step through these sizes only. */
export const fontSize = {
  h1: 26,
  h2: 21,
  h3: 17,
  body: 15,
  read: 15.5,
  small: 13,
  tiny: 11,
} as const;

/** Urdu needs far more leading than Latin at the same size. */
export const URDU_LINE_HEIGHT = 2.1;

/** Content column width on wide screens. */
export const CONTENT_MAX = 1040;
export const READING_MAX = 720;

export type ColorToken = keyof typeof colors;

/**
 * Each subject's colour identity, used to tint its icon, ring and chip in
 * both apps. Chosen to stay legible on white and on their own tints, and to
 * make the study list read as a friendly shelf of different books rather
 * than nine copies of the same teal one.
 */
export const SUBJECT_COLORS: Record<string, { main: string; tint: string }> = {
  phy: { main: '#7C4DDB', tint: '#EFE8FB' },
  chem: { main: '#0E8FB5', tint: '#E2F4FA' },
  bio: { main: '#2E9E5B', tint: '#E7F5EC' },
  math: { main: '#E8590C', tint: '#FDEEE3' },
  eng: { main: '#C2255C', tint: '#FBE9F0' },
  urd: { main: '#0B7285', tint: '#E1F1F4' },
  isl: { main: '#5F3DC4', tint: '#ECE7FA' },
  pst: { main: '#087F5B', tint: '#E3F4EE' },
  cs: { main: '#364FC7', tint: '#E8ECFA' },
};
