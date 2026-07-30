/**
 * Design tokens, sampled from the client's logo (docs/assets/brand/BRAND.md).
 *
 * Shared so the two apps cannot drift: the Android app reads these objects
 * directly, and the web app generates CSS custom properties from them. Change a
 * colour here and both surfaces move.
 */

export const colors = {
  teal: '#096A8B',
  tealDark: '#0F5064',
  tealTint: '#E9F2F5',
  tealTint2: '#D5E7ED',
  ink: '#0F3D4C',
  ink2: '#517682',
  /** Fine print and placeholders only; meaningful copy uses ink2. Darkened
   * from #8AA4AD, which sat at 2.5:1 on paper and was unreadable in sunlight. */
  ink3: '#6E8B96',
  paper: '#FAFBF7',
  card: '#FFFFFF',
  line: '#E4EAE6',
  /** The one neutral for empty progress tracks, rings and skeletons. Five
   * hand-picked greys used to share this role; this is the survivor. */
  track: '#EAF0EC',
  /** Inactive control surfaces: an off toggle, an unchecked box, a step dot. */
  mute: '#D7E0DB',
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
