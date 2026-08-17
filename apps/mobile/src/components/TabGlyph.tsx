/**
 * The tab bar's chunky two-tone icons, painted from the shared glyph data in
 * @matricmate/core so the website's navigation wears the same set.
 *
 * The active glyph gets sticker depth: the same silhouette drawn once more
 * in a darker tone, dropped 1.2px underneath, plus one soft highlight. Depth
 * is state: the resting tabs stay flat and quiet, so the active one reads as
 * the raised piece on the board. This component is deliberately static; the
 * tab bar owns the single landing animation.
 */
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { TAB_GLYPHS, TabGlyphName } from '@matricmate/core';
import { C, isDark } from '../theme';
import type { IconName } from './Icon';

type Tone = { main: string; accent: string; hole: string };

/**
 * Functions, not constants. As constants these were evaluated once when the
 * module was first imported, which pinned the tab bar to whichever theme was
 * loaded at launch: switching to dark left five pale stickers glowing on a
 * dark bar. Called per render, they follow the palette like everything else.
 *
 * The two off-palette tones stay off-palette because they are not roles that
 * appear anywhere else: the under-layer is the drop-shadow copy that gives the
 * active glyph its sticker depth, and the resting tone is deliberately quieter
 * than any text colour we have. Both keep their light values exactly, and gain
 * a dark counterpart chosen the same way: the under-layer a step darker than
 * the colour it sits beneath, the resting glyph lifted just clear of the bar.
 */
const ACTIVE = (): Tone => ({ main: C.teal, accent: C.orange, hole: C.card });

const ACTIVE_UNDER = (): Tone =>
  isDark()
    ? { main: '#1B6F8C', accent: '#B36A12', hole: '#1B6F8C' }
    : { main: '#075B78', accent: '#C96D00', hole: '#075B78' };

const REST = (): Tone =>
  isDark()
    ? { main: '#63838F', accent: '#4B6875', hole: C.card }
    : { main: '#AEBEB6', accent: '#C6D2CB', hole: C.card };

function Pieces({ name, tone }: { name: TabGlyphName; tone: Tone }) {
  return (
    <>
      {TAB_GLYPHS[name].pieces.map((p, i) => {
        const f = tone[p.tone];
        switch (p.k) {
          case 'path':
            return <Path key={i} d={p.d} fill={f} />;
          case 'rect':
            return <Rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={f} />;
          case 'circle':
            return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={f} />;
        }
      })}
    </>
  );
}

export function TabGlyph({ name, focused }: { name: IconName; focused: boolean }) {
  const glyph = (name in TAB_GLYPHS ? name : 'home') as TabGlyphName;
  const { gloss } = TAB_GLYPHS[glyph];
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      {focused ? (
        // A string transform, because the translateY prop leaks to the DOM
        // as an unknown attribute when react-native-svg renders on the web.
        <G transform="translate(0 1.2)">
          <Pieces name={glyph} tone={ACTIVE_UNDER()} />
        </G>
      ) : null}
      <Pieces name={glyph} tone={focused ? ACTIVE() : REST()} />
      {focused ? <Ellipse cx={gloss.cx} cy={gloss.cy} rx={3.4} ry={2.1} fill="#FFFFFF" opacity={0.32} /> : null}
    </Svg>
  );
}
