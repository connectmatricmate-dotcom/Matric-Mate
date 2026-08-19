import {
  AlertTriangle,
  ArrowRight,
  Atom,
  Award,
  Bell,
  BookOpen,
  BookText,
  Calculator,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  Dna,
  Download,
  Eye,
  EyeOff,
  Feather,
  FileText,
  Flame,
  FlaskConical,
  Globe,
  GraduationCap,
  Headphones,
  HelpCircle,
  House,
  Inbox,
  KeyRound,
  Landmark,
  Languages,
  Layers,
  Leaf,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Mic,
  Monitor,
  Moon,
  MoonStar,
  MoreHorizontal,
  PartyPopper,
  Pause,
  Pencil,
  Phone,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  User,
  WalletCards,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';
import { IconName } from '@matricmate/core';
import { C, isRTL } from '../theme';

export type { IconName };
export { SUBJECT_ICON } from '@matricmate/core';

/**
 * One icon system for the whole app: Lucide, the maintained successor to
 * Feather. Rounded caps and a single stroke weight match the app's soft
 * geometry, and Record<IconName, LucideIcon> means a missing mapping fails
 * the typecheck instead of rendering an empty square on a student's phone.
 */
const GLYPHS: Record<IconName, LucideIcon> = {
  home: House,
  book: BookOpen,
  book2: BookText,
  target: Target,
  spark: Sparkles,
  chart: TrendingUp,
  user: User,
  bell: Bell,
  flame: Flame,
  back: ChevronLeft,
  chevron: ChevronRight,
  close: X,
  play: Play,
  pause: Pause,
  download: Download,
  check: Check,
  lock: Lock,
  search: Search,
  camera: Camera,
  mic: Mic,
  send: Send,
  doc: FileText,
  clock: Clock,
  gear: Settings,
  card: CreditCard,
  share: Share2,
  trash: Trash2,
  plus: Plus,
  dots: MoreHorizontal,
  eye: Eye,
  eyeOff: EyeOff,
  wifiOff: WifiOff,
  refresh: RefreshCw,
  edit: Pencil,
  logout: LogOut,
  help: HelpCircle,
  headphones: Headphones,
  cards: WalletCards,
  mail: Mail,
  phone: Phone,
  calendar: Calendar,
  key: KeyRound,
  award: Award,
  layers: Layers,
  arrowRight: ArrowRight,
  quill: Feather,
  flask: FlaskConical,
  calc: Calculator,
  leaf: Leaf,
  globe: Globe,
  moon: Moon,
  bolt: Zap,
  star: Star,
  whatsapp: MessageCircle,
  alert: AlertTriangle,
  crown: Crown,
  thumbsUp: ThumbsUp,
  thumbsDown: ThumbsDown,
  menu: Menu,
  inbox: Inbox,
  receipt: Receipt,
  gradCap: GraduationCap,
  party: PartyPopper,
  phy: Atom,
  chem: FlaskConical,
  bio: Dna,
  math: Calculator,
  eng: Languages,
  urd: Feather,
  isl: MoonStar,
  pst: Landmark,
  cs: Monitor,
};

/**
 * Glyphs that point somewhere, and so have to turn round in Urdu.
 *
 * `Chevron` in the UI kit already mirrors itself and says why: an arrow is a
 * direction, not a decoration, and one pointing right in a right-to-left app
 * points back the way the student came. `back` was rendered raw, so every
 * header's back arrow pointed left in Urdu, and in the reader's footer both
 * the previous and the next control ended up pointing the same way.
 */
const DIRECTIONAL: ReadonlySet<IconName> = new Set<IconName>(['back', 'chevron', 'arrowRight', 'send']);

export function Icon({
  name,
  size = 20,
  color = C.ink,
  strokeWidth = 1.9,
  fill = 'none',
}: {
  name: IconName;
  size?: number;
  color?: string;
  /** Solid fill for celebratory icons like the result stars. */
  fill?: string;
  strokeWidth?: number;
}) {
  const Glyph = GLYPHS[name];
  const glyph = <Glyph size={size} color={color} strokeWidth={strokeWidth} fill={fill} />;
  return isRTL() && DIRECTIONAL.has(name) ? (
    <View style={{ transform: [{ scaleX: -1 }] }}>{glyph}</View>
  ) : (
    glyph
  );
}
