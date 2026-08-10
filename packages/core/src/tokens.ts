/**
 * Design tokens, sampled from the client's logo (docs/assets/brand/BRAND.md).
 *
 * Shared so the two apps cannot drift: the Android app reads these objects
 * directly, and the web app generates CSS custom properties from them. Change a
 * colour here and both surfaces move.
 */

export const colors = {
  /** Primary. Brightened from #096A8B: the old one read as grey-blue on a
   * phone in daylight and the client could not tell it apart from the ink. */
  teal: '#0A7EA4',
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
   * twice: #8AA4AD sat at 2.5:1, #6E8B96 at 3.5:1 still failed AA. Now 4.4:1. */
  ink3: '#587A87',
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
  green: '#2E9E5B',
  greenTint: '#E7F5EC',
  red: '#D9534F',
  redTint: '#FBECEB',
  grey: '#EFF3F0',
  whatsapp: '#25D366',
} as const;

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
