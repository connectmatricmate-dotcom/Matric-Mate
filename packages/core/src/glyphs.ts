/**
 * The five navigation glyphs, drawn as data so Android and the web paint the
 * same chunky two-tone shapes from one file (the same arrangement the avatar
 * cast uses).
 *
 * Each glyph is a list of filled pieces in a 24x24 box. `tone` names a slot,
 * not a colour: the renderer decides what `main`, `accent` and `hole` mean in
 * its state (active teal with an orange accent, or resting grey). `gloss` is
 * where the sticker highlight sits when the renderer draws the active tab
 * with depth: glyphs differ in where their visual mass is, so the spot is
 * data, not a constant.
 */

export type GlyphTone = 'main' | 'accent' | 'hole';

export type GlyphPiece =
  | { k: 'path'; d: string; tone: GlyphTone }
  | { k: 'rect'; x: number; y: number; w: number; h: number; rx: number; tone: GlyphTone }
  | { k: 'circle'; cx: number; cy: number; r: number; tone: GlyphTone };

export type TabGlyphName = 'home' | 'book' | 'target' | 'spark' | 'chart';

export const TAB_GLYPHS: Record<TabGlyphName, { pieces: GlyphPiece[]; gloss: { cx: number; cy: number } }> = {
  home: {
    pieces: [
      {
        k: 'path',
        d: 'M3.8 10.2 12 3.4l8.2 6.8c.5.4.8 1 .8 1.7v7.1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7.1c0-.7.3-1.3.8-1.7Z',
        tone: 'main',
      },
      { k: 'rect', x: 9.4, y: 13.4, w: 5.2, h: 7.6, rx: 1.6, tone: 'accent' },
    ],
    gloss: { cx: 8.6, cy: 8.2 },
  },
  book: {
    pieces: [
      {
        k: 'path',
        d: 'M12 5.6C10.2 4 7.4 3.4 4.6 3.7c-.9.1-1.6.9-1.6 1.8v11.6c0 1.1 1 1.9 2.1 1.8 2.4-.2 5 .3 6.9 1.9V5.6Z',
        tone: 'main',
      },
      {
        k: 'path',
        d: 'M12 5.6c1.8-1.6 4.6-2.2 7.4-1.9.9.1 1.6.9 1.6 1.8v11.6c0 1.1-1 1.9-2.1 1.8-2.4-.2-5 .3-6.9 1.9V5.6Z',
        tone: 'accent',
      },
    ],
    gloss: { cx: 7.4, cy: 7.4 },
  },
  target: {
    pieces: [
      { k: 'circle', cx: 12, cy: 12, r: 9.4, tone: 'main' },
      { k: 'circle', cx: 12, cy: 12, r: 5.8, tone: 'hole' },
      { k: 'circle', cx: 12, cy: 12, r: 3.1, tone: 'accent' },
    ],
    gloss: { cx: 8.4, cy: 7.6 },
  },
  spark: {
    pieces: [
      {
        k: 'path',
        d: 'M12 2.6c.5 3.9 1.6 6.4 3.2 8 1.6 1.6 4.1 2.7 8 3.2v.4c-3.9.5-6.4 1.6-8 3.2-1.6 1.6-2.7 4.1-3.2 8h-.4c-.5-3.9-1.6-6.4-3.2-8-1.6-1.6-4.1-2.7-8-3.2v-.4c3.9-.5 6.4-1.6 8-3.2 1.6-1.6 2.7-4.1 3.2-8h.4Z',
        tone: 'main',
      },
      { k: 'circle', cx: 18.6, cy: 5, r: 2, tone: 'accent' },
    ],
    gloss: { cx: 9.8, cy: 8.6 },
  },
  chart: {
    pieces: [
      { k: 'rect', x: 3.2, y: 12.4, w: 4.8, h: 8.4, rx: 1.8, tone: 'main' },
      { k: 'rect', x: 9.6, y: 7.2, w: 4.8, h: 13.6, rx: 1.8, tone: 'accent' },
      { k: 'rect', x: 16, y: 3.2, w: 4.8, h: 17.6, rx: 1.8, tone: 'main' },
    ],
    gloss: { cx: 11.6, cy: 9 },
  },
};
