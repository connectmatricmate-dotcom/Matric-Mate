/**
 * Icon NAMES only. The glyphs themselves come from Lucide, rendered by each
 * app's own Icon component (lucide-react on the web, lucide-react-native on
 * Android). The hand-drawn path data that used to live here is gone: it read
 * as machine-made because it was, and a maintained set with one stroke system
 * is what makes fifty icons look like one family.
 *
 * The name union stays here so screens on both apps keep sharing one
 * vocabulary, and so a typo in a name is a compile error, not a blank box.
 */
export const ICON_NAMES = [
  'home',
  'book',
  'book2',
  'target',
  'spark',
  'chart',
  'user',
  'bell',
  'flame',
  'back',
  'chevron',
  'close',
  'play',
  'pause',
  'download',
  'check',
  'lock',
  'search',
  'camera',
  'mic',
  'send',
  'doc',
  'clock',
  'gear',
  'card',
  'share',
  'trash',
  'plus',
  'dots',
  'eye',
  'eyeOff',
  'wifiOff',
  'refresh',
  'edit',
  'logout',
  'help',
  'headphones',
  'cards',
  'mail',
  'phone',
  'calendar',
  'key',
  'award',
  'layers',
  'arrowRight',
  'quill',
  'flask',
  'calc',
  'leaf',
  'globe',
  'moon',
  'bolt',
  'star',
  'whatsapp',
  'alert',
  'crown',
  'phy',
  'chem',
  'bio',
  'math',
  'eng',
  'urd',
  'isl',
  'pst',
  'cs',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/** Subject glyphs: each subject finally looks like itself. */
export const SUBJECT_ICON: Record<string, IconName> = {
  phy: 'phy',
  chem: 'chem',
  bio: 'bio',
  math: 'math',
  eng: 'eng',
  urd: 'urd',
  isl: 'isl',
  pst: 'pst',
  cs: 'cs',
};
