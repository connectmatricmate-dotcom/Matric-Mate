import { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { StringKey } from '../i18n';
import { useT } from '../i18n';
import { C, F, R, S } from '../theme';
import { Body, H2, Small } from './ui';

/**
 * The screen a student looks at while the AI writes something.
 *
 * Twenty to forty seconds is a long time to hold a phone. A spinner inside a
 * button is the wrong size of feedback for it: the client's words were that
 * the tap looked like it had missed. So this takes the whole screen, names
 * what is being made, and keeps moving.
 *
 * What it does not do is claim a percentage. The route gives us no progress
 * to report, and a bar creeping to 90% and sitting there is the oldest lie in
 * software. The stages below rotate on a timer and every one of them names
 * something the route genuinely does.
 *
 * Reduce-motion gets the same screen with the animation held still, not a
 * lesser one: the words are the information, the movement is the reassurance.
 */

const STAGES: StringKey[] = [
  'states.workReading',
  'states.workPattern',
  'states.workWriting',
  'states.workChecking',
  'states.workAlmost',
];

/** How long each line holds. The last one keeps the screen until it is done. */
const STAGE_MS = 6500;

/** Three bars of the brand, breathing out of phase. Deliberately not a
 *  spinner: a spinner is what a page load looks like, and this is writing. */
function Pulse({ reduced }: { reduced: boolean }) {
  const bars = [useSharedValue(0.4), useSharedValue(0.4), useSharedValue(0.4)];
  const colours = [C.teal, C.orange, C.green];

  useEffect(() => {
    if (reduced) return;
    bars.forEach((b, i) => {
      b.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 520 + i * 90, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.4, { duration: 520 + i * 90, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      );
    });
    // Shared values are stable for the life of the component; the array
    // literal around them is not, which is why it is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 9, height: 54 }}>
      {bars.map((b, i) => (
        <Bar key={i} progress={b} color={colours[i]} />
      ))}
    </View>
  );
}

function Bar({ progress, color }: { progress: { value: number }; color: string }) {
  const style = useAnimatedStyle(() => ({ height: 20 + progress.value * 34, opacity: 0.55 + progress.value * 0.45 }));
  return <Animated.View style={[{ width: 12, borderRadius: 6, backgroundColor: color }, style]} />;
}

export function AiWorking({ visible, title }: { visible: boolean; title: string }) {
  // Mounted only while it is wanted, so the stage counter starts at the first
  // line every time rather than wherever the last run left it.
  if (!visible) return null;
  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent onRequestClose={() => {}}>
      <Working title={title} />
    </Modal>
  );
}

function Working({ title }: { title: string }) {
  const t = useT();
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStage((n) => Math.min(n + 1, STAGES.length - 1)), STAGE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', padding: S.xl }}>
      <Pulse reduced={reduced} />

      <View style={{ height: S.xl }} />
      <H2 style={{ textAlign: 'center' }}>{title}</H2>

      {/* Fixed height, so a longer line does not shove the heading up the
          screen every time the stage changes. */}
      <View style={{ height: 52, justifyContent: 'center' }}>
        <Body style={{ textAlign: 'center', color: C.ink2 }}>{t(STAGES[stage])}</Body>
      </View>

      <View
        style={{
          marginTop: S.sm,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: R.pill,
          backgroundColor: C.tealTint,
          maxWidth: 320,
        }}
      >
        <Small style={{ textAlign: 'center', color: C.teal, fontFamily: F.bodyBold }}>{t('states.workStay')}</Small>
      </View>
    </View>
  );
}
