/**
 * The reward layer: confetti, pop-ins, shakes and counting numbers.
 *
 * Hand-rolled on Reanimated rather than pulled in as a Lottie or a confetti
 * package, for three deliberate reasons: zero new native modules (so Expo Go
 * and the existing APK toolchain keep working), zero licensing questions on
 * a client deliverable, and everything runs on the UI thread so a cheap
 * Android phone, which is our actual student, stays smooth.
 *
 * Everything here respects the system reduce-motion setting: celebration is
 * seasoning, and a student who turned animations off gets the plain dish.
 */
import { useEffect, useRef, useState } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { C } from '../theme';

/* ------------------------------------------------------------- confetti */

/* A function, so the confetti is mixed from the palette in force when it is
   thrown rather than the one loaded at launch. */
const pieceColors = () => [C.teal, C.orange, C.green, '#F7C948', C.tealTint2, C.orangeDark];

type Seed = { x: number; delay: number; sway: number; spin: number; size: number; color: string; height: number };

/**
 * Rolled outside render, because randomness during render is impure and the
 * lint rules rightly refuse it. The burst component rolls one batch in an
 * effect and hands each piece its fate as a prop.
 */
function rollSeeds(count: number): Seed[] {
  const { width, height } = Dimensions.get('window');
  const palette = pieceColors();
  return Array.from({ length: count }, (_, i) => ({
    x: ((i + 0.5) / count) * width + (Math.random() - 0.5) * 40,
    delay: Math.random() * 350,
    sway: (Math.random() - 0.5) * 90,
    spin: (Math.random() - 0.5) * 720,
    size: 7 + Math.random() * 6,
    color: palette[i % palette.length],
    height,
  }));
}

/** One falling rectangle. Its whole life is a single 0→1 progress value. */
function Piece({ seed, duration }: { seed: Seed; duration: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(seed.delay, withTiming(1, { duration, easing: Easing.in(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    opacity: interpolate(progress.value, [0, 0.1, 0.75, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: seed.x + Math.sin(progress.value * Math.PI * 2) * seed.sway },
      { translateY: interpolate(progress.value, [0, 1], [-30, seed.height * 0.85]) },
      { rotate: `${progress.value * seed.spin}deg` },
      { scale: interpolate(progress.value, [0, 0.1, 1], [0.4, 1, 0.9]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        style,
        { width: seed.size, height: seed.size * 1.6, borderRadius: 2, backgroundColor: seed.color },
      ]}
    />
  );
}

/**
 * A one-shot confetti burst over the whole screen.
 *
 * Mount it when the moment happens; it cleans itself out of the tree when
 * the last piece lands, so there is nothing for the parent to manage and no
 * invisible views left eating the compositor.
 */
export function Confetti({ count = 26, duration = 1700 }: { count?: number; duration?: number }) {
  const reduced = useReducedMotion();
  const [seeds, setSeeds] = useState<Seed[] | null>(null);

  useEffect(() => {
    // Rolled a frame after mount: randomness is impure in render, and a state
    // write inside the effect body itself would be synchronous. One invisible
    // frame of delay buys a clean conscience on both rules.
    const roll = requestAnimationFrame(() => setSeeds(rollSeeds(count)));
    const t = setTimeout(() => setSeeds([]), duration + 850);
    return () => {
      cancelAnimationFrame(roll);
      clearTimeout(t);
    };
  }, [count, duration]);

  if (reduced || !seeds || seeds.length === 0) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}>
      {seeds.map((seed, i) => (
        <Piece key={i} seed={seed} duration={duration} />
      ))}
    </View>
  );
}

/* --------------------------------------------------------------- pop-in */

/**
 * Spring-scales its children into existence, optionally after a delay.
 * The reveal beat of the result screen: score, then stars, then buttons.
 */
export function Pop({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: object }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (!reduced) scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 180 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const a = useAnimatedStyle(() => ({ opacity: Math.min(1, scale.value), transform: [{ scale: scale.value }] }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

/* ---------------------------------------------------------------- shake */

/** [style, trigger]. Attach the style, call the trigger on a wrong answer. */
export function useShake() {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const trigger = () => {
    if (reduced) return;
    // The compiler lint cannot tell this closure is only ever an event
    // handler, and flags the shared-value write as a render mutation.
    // eslint-disable-next-line react-hooks/immutability
    x.value = withSequence(
      withTiming(-7, { duration: 45 }),
      withTiming(7, { duration: 45 }),
      withTiming(-5, { duration: 40 }),
      withTiming(5, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  };
  return [style, trigger] as const;
}

/* ---------------------------------------------------------------- pulse */

/**
 * A slow heartbeat for something alive, like the streak flame.
 * Renders children statically when the system asks for reduced motion.
 */
export function Pulse({ children, on = true }: { children: React.ReactNode; on?: boolean }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (on && !reduced) {
      scale.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 620 }), withTiming(1, { duration: 620 })),
        -1,
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, reduced]);

  const a = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

/* ------------------------------------------------------------- count-up */

/**
 * 0 → target with an ease-out, for score and XP reveals.
 *
 * Plain JS state on requestAnimationFrame rather than an animated text trick:
 * the value feeds ordinary <Text> and the render cost of ~40 updates over a
 * second is nothing. Snaps straight to the target under reduced motion.
 */
export function useCountUp(target: number, duration = 900): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = Date.now();
    const step = () => {
      // Everything lands through this async callback, including the snap for
      // reduced motion, so no state is written synchronously in the effect.
      if (reduced) {
        setValue(target);
        return;
      }
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [target, duration, reduced]);

  return value;
}

/* ------------------------------------------------------------ equalizer */

/** One dancing bar. Staggered phase per index, honest stillness when idle. */
function EqBar({ index, playing, color }: { index: number; playing: boolean; color: string }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(6);

  useEffect(() => {
    if (playing && !reduced) {
      h.value = withDelay(
        index * 130,
        withRepeat(withSequence(withTiming(18, { duration: 320 }), withTiming(7, { duration: 300 })), -1),
      );
    } else {
      h.value = withTiming(6, { duration: 180 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, reduced]);

  const a = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[a, { width: 4, borderRadius: 2, backgroundColor: color }]} />;
}

/**
 * The little dancing bars that say "sound is coming out of your phone".
 * Sits next to the lesson title while audio plays and rests flat when paused.
 */
export function Equalizer({ playing, color }: { playing: boolean; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 20 }}>
      {[0, 1, 2, 3].map((i) => (
        <EqBar key={i} index={i} playing={playing} color={color} />
      ))}
    </View>
  );
}
