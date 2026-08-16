/**
 * The one header every in-session screen wears, mirroring the web app's
 * SessionHeader: the way out on the left, progress in the middle, the
 * screen's one piece of meta on the right.
 *
 * Progress is a row of segments, one per item, because "how many are left"
 * is the question a student mid-session actually has. Past segments are
 * filled, the current one wears a ring, the rest wait. Practice screens
 * colour the past by correctness; the exam keeps every fill teal because a
 * running test must not leak the score. Beyond 16 items segments would
 * shrink into noise, so it falls back to the continuous bar.
 */
import { Text, View } from 'react-native';
import { Bar, IconButton } from './ui';
import { C, F, isRTL, rowDir } from '../theme';

const MAX_SEGMENTS = 16;

export type SegmentMark = 'ok' | 'bad' | 'done' | 'todo' | 'current';

const SEGMENT_COLOR: Record<Exclude<SegmentMark, 'current'>, string> = {
  ok: C.green,
  bad: C.red,
  done: C.teal,
  todo: C.track,
};

/**
 * The bare segment strip, for screens whose header has its own layout.
 * Past MAX_SEGMENTS items it degrades to the continuous bar on its own,
 * using how much of the list is behind the student as the fill.
 */
export function SegmentTrack({ segments }: { segments: SegmentMark[] }) {
  if (segments.length > MAX_SEGMENTS) {
    const passed = segments.filter((m) => m !== 'todo' && m !== 'current').length;
    return <Bar pct={(passed / segments.length) * 100} tone="teal" h={6} />;
  }
  return (
    <View style={{ flexDirection: rowDir(), gap: 4 }}>
      {segments.map((m, i) =>
        m === 'current' ? (
          <View
            key={i}
            style={{ flex: 1, height: 7, borderRadius: 99, backgroundColor: C.card, borderWidth: 2, borderColor: C.teal }}
          />
        ) : (
          <View key={i} style={{ flex: 1, height: 7, borderRadius: 99, backgroundColor: SEGMENT_COLOR[m] }} />
        ),
      )}
    </View>
  );
}

export function SessionHeader({
  onClose,
  pct,
  label,
  right,
  segments,
}: {
  onClose: () => void;
  pct: number;
  label: string;
  right?: React.ReactNode;
  /** One mark per item. Omit (or exceed 16) to keep the continuous bar. */
  segments?: SegmentMark[];
}) {
  const segmented = segments && segments.length > 1 && segments.length <= MAX_SEGMENTS;
  return (
    <View style={{ flexDirection: rowDir(), alignItems: 'center', gap: 10, paddingTop: 4 }}>
      <View style={isRTL() ? { marginRight: -10 } : { marginLeft: -10 }}>
        <IconButton icon="close" onPress={onClose} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {segmented ? <SegmentTrack segments={segments} /> : <Bar pct={pct} tone="teal" h={6} />}
        <Text numberOfLines={1} style={{ fontFamily: F.bodyBold, fontSize: 11.5, color: C.ink2, marginTop: 4 }}>
          {label}
        </Text>
      </View>
      {right}
    </View>
  );
}
