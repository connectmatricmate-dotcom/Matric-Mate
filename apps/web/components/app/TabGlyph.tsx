/**
 * Web renderer for the shared navigation glyphs in @matricmate/core: the
 * same chunky two-tone shapes the Android tab bar paints, so the product
 * carries one icon language.
 *
 * The active glyph gets sticker depth (its own silhouette dropped 1.2px in a
 * darker tone, plus one soft highlight); resting glyphs stay flat. Depth is
 * state, not decoration.
 */
import { TAB_GLYPHS, TabGlyphName } from '@matricmate/core';

type Tone = { main: string; accent: string; hole: string };

const ACTIVE: Tone = { main: 'var(--color-teal)', accent: 'var(--color-orange)', hole: 'var(--color-card)' };
const ACTIVE_UNDER: Tone = { main: '#075B78', accent: '#C96D00', hole: '#075B78' };
const REST: Tone = { main: '#AEBEB6', accent: '#C6D2CB', hole: 'var(--color-card)' };

function Pieces({ name, tone }: { name: TabGlyphName; tone: Tone }) {
  return (
    <>
      {TAB_GLYPHS[name].pieces.map((p, i) => {
        const f = tone[p.tone];
        switch (p.k) {
          case 'path':
            return <path key={i} d={p.d} fill={f} />;
          case 'rect':
            return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx} fill={f} />;
          case 'circle':
            return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={f} />;
        }
      })}
    </>
  );
}

export function TabGlyph({ name, focused, size = 22 }: { name: string; focused: boolean; size?: number }) {
  const glyph = (name in TAB_GLYPHS ? name : 'home') as TabGlyphName;
  const { gloss } = TAB_GLYPHS[glyph];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {focused ? (
        <g transform="translate(0 1.2)">
          <Pieces name={glyph} tone={ACTIVE_UNDER} />
        </g>
      ) : null}
      <Pieces name={glyph} tone={focused ? ACTIVE : REST} />
      {focused ? <ellipse cx={gloss.cx} cy={gloss.cy} rx={3.4} ry={2.1} fill="#FFFFFF" opacity={0.32} /> : null}
    </svg>
  );
}
