/**
 * The avatar cast: eight sticker-style characters, drawn as data.
 *
 * The client's feedback was that emoji as profile pictures read as lazy, and
 * he wanted playful artwork. These are hand-authored flat illustrations kept
 * as shape lists so one definition renders everywhere: react-native-svg on
 * Android, an inline <svg> on the web. No image files, no licensing, a few
 * hundred bytes each, and they inherit nothing from the platform emoji font.
 *
 * All coordinates live in a 48x48 box. Settings.avatar indexes this array,
 * so ORDER IS API: append new characters, never reorder or remove.
 */

export type AvatarShape =
  | { k: 'c'; cx: number; cy: number; r: number; f: string }
  | { k: 'e'; cx: number; cy: number; rx: number; ry: number; f: string }
  | { k: 'r'; x: number; y: number; w: number; h: number; rx: number; f: string }
  | { k: 'p'; d: string; f?: string; s?: string; sw?: number };

export type Avatar = { id: string; name: string; bg: string; shapes: AvatarShape[] };

const INK = '#25333B';

export const AVATARS: Avatar[] = [
  {
    id: 'cat',
    name: 'Billi',
    bg: '#FFB84D',
    shapes: [
      { k: 'p', d: 'M11.5 17 L14 5.5 L21.5 12.5 Z', f: '#F79009' },
      { k: 'p', d: 'M36.5 17 L34 5.5 L26.5 12.5 Z', f: '#F79009' },
      { k: 'p', d: 'M13.8 14.6 L15.1 9.4 L18.6 12.7 Z', f: '#FFD8A8' },
      { k: 'p', d: 'M34.2 14.6 L32.9 9.4 L29.4 12.7 Z', f: '#FFD8A8' },
      { k: 'c', cx: 24, cy: 27, r: 13.5, f: '#FFE8C7' },
      { k: 'c', cx: 19, cy: 25, r: 1.9, f: INK },
      { k: 'c', cx: 29, cy: 25, r: 1.9, f: INK },
      { k: 'p', d: 'M22.4 29.2 h3.2 l-1.6 2.1 Z', f: '#F97316' },
      { k: 'p', d: 'M19.5 33 Q24 36.4 28.5 33', s: INK, sw: 1.7 },
    ],
  },
  {
    id: 'robot',
    name: 'Robo',
    bg: '#4FB3CF',
    shapes: [
      { k: 'r', x: 22.9, y: 6.5, w: 2.2, h: 6, rx: 1.1, f: '#FFFFFF' },
      { k: 'c', cx: 24, cy: 6.4, r: 2.6, f: '#FF8A00' },
      { k: 'r', x: 10.5, y: 13, w: 27, h: 22, rx: 8, f: '#F2F7F5' },
      { k: 'c', cx: 18.5, cy: 23, r: 3.1, f: '#0B6E8E' },
      { k: 'c', cx: 29.5, cy: 23, r: 3.1, f: '#0B6E8E' },
      { k: 'c', cx: 19.6, cy: 22, r: 1, f: '#FFFFFF' },
      { k: 'c', cx: 30.6, cy: 22, r: 1, f: '#FFFFFF' },
      { k: 'r', x: 18.5, y: 29, w: 11, h: 2.6, rx: 1.3, f: '#9FB4AC' },
      { k: 'r', x: 6.8, y: 20, w: 3, h: 8, rx: 1.5, f: '#D7E4DF' },
      { k: 'r', x: 38.2, y: 20, w: 3, h: 8, rx: 1.5, f: '#D7E4DF' },
    ],
  },
  {
    id: 'owl',
    name: 'Ullu',
    bg: '#8B7FE8',
    shapes: [
      { k: 'p', d: 'M12 14 L16 8 L20 13 Z', f: '#6C5CE0' },
      { k: 'p', d: 'M36 14 L32 8 L28 13 Z', f: '#6C5CE0' },
      { k: 'e', cx: 24, cy: 27, rx: 14, ry: 13, f: '#A99DF5' },
      { k: 'c', cx: 18, cy: 24, r: 6.4, f: '#FFFFFF' },
      { k: 'c', cx: 30, cy: 24, r: 6.4, f: '#FFFFFF' },
      { k: 'c', cx: 18.6, cy: 24.6, r: 2.6, f: INK },
      { k: 'c', cx: 29.4, cy: 24.6, r: 2.6, f: INK },
      { k: 'p', d: 'M22.4 30.6 h3.2 l-1.6 2.6 Z', f: '#FF8A00' },
      { k: 'p', d: 'M17 35.5 Q19.5 38 22 35.5 M26 35.5 Q28.5 38 31 35.5', s: '#6C5CE0', sw: 1.6 },
    ],
  },
  {
    id: 'fox',
    name: 'Lomri',
    bg: '#FF9466',
    shapes: [
      { k: 'p', d: 'M10.5 20 L11.5 7 L21 14 Z', f: '#E8500F' },
      { k: 'p', d: 'M37.5 20 L36.5 7 L27 14 Z', f: '#E8500F' },
      { k: 'c', cx: 24, cy: 26, r: 13.5, f: '#FB6F1D' },
      { k: 'e', cx: 24, cy: 31.5, rx: 8.5, ry: 6.5, f: '#FFF3E4' },
      { k: 'c', cx: 18.5, cy: 23, r: 1.9, f: INK },
      { k: 'c', cx: 29.5, cy: 23, r: 1.9, f: INK },
      { k: 'p', d: 'M22.5 29.5 h3 l-1.5 2 Z', f: INK },
      { k: 'p', d: 'M20.5 33.5 Q24 36 27.5 33.5', s: INK, sw: 1.6 },
    ],
  },
  {
    id: 'astro',
    name: 'Khalabaz',
    bg: '#1E4B74',
    shapes: [
      { k: 'c', cx: 24, cy: 23, r: 14, f: '#F4F8F6' },
      { k: 'e', cx: 24, cy: 22.5, rx: 9.5, ry: 7.5, f: '#123A54' },
      { k: 'c', cx: 20.5, cy: 20, r: 2, f: '#7FD1EC' },
      { k: 'r', x: 14, y: 36, w: 20, h: 6.5, rx: 3.2, f: '#FF8A00' },
      { k: 'c', cx: 40, cy: 10, r: 1.4, f: '#FFFFFF' },
      { k: 'c', cx: 7.5, cy: 32, r: 1.1, f: '#FFFFFF' },
      { k: 'c', cx: 10, cy: 12, r: 0.9, f: '#FFFFFF' },
    ],
  },
  {
    id: 'frog',
    name: 'Mendak',
    bg: '#5FBF63',
    shapes: [
      { k: 'c', cx: 16.5, cy: 13, r: 5.4, f: '#8BD68E' },
      { k: 'c', cx: 31.5, cy: 13, r: 5.4, f: '#8BD68E' },
      { k: 'c', cx: 16.5, cy: 13, r: 2.2, f: INK },
      { k: 'c', cx: 31.5, cy: 13, r: 2.2, f: INK },
      { k: 'e', cx: 24, cy: 28, rx: 14.5, ry: 11.5, f: '#8BD68E' },
      { k: 'p', d: 'M16 29 Q24 36.5 32 29', s: INK, sw: 1.8 },
      { k: 'c', cx: 13.5, cy: 27, r: 2, f: '#FFB3AB' },
      { k: 'c', cx: 34.5, cy: 27, r: 2, f: '#FFB3AB' },
    ],
  },
  {
    id: 'panda',
    name: 'Panda',
    bg: '#9BB0BC',
    shapes: [
      { k: 'c', cx: 13, cy: 12.5, r: 5, f: INK },
      { k: 'c', cx: 35, cy: 12.5, r: 5, f: INK },
      { k: 'c', cx: 24, cy: 26, r: 14, f: '#FFFFFF' },
      { k: 'e', cx: 17.5, cy: 23.5, rx: 4.4, ry: 5.4, f: INK },
      { k: 'e', cx: 30.5, cy: 23.5, rx: 4.4, ry: 5.4, f: INK },
      { k: 'c', cx: 18.4, cy: 22.6, r: 1.5, f: '#FFFFFF' },
      { k: 'c', cx: 29.6, cy: 22.6, r: 1.5, f: '#FFFFFF' },
      { k: 'e', cx: 24, cy: 31, rx: 2.4, ry: 1.8, f: INK },
      { k: 'p', d: 'M21 34.5 Q24 36.5 27 34.5', s: INK, sw: 1.5 },
    ],
  },
  {
    id: 'star',
    name: 'Sitara',
    bg: '#FFD54F',
    shapes: [
      {
        k: 'p',
        d: 'M24 5 L29.2 16.2 L41.5 17.8 L32.4 26.3 L34.8 38.5 L24 32.5 L13.2 38.5 L15.6 26.3 L6.5 17.8 L18.8 16.2 Z',
        f: '#FFB300',
      },
      { k: 'c', cx: 20, cy: 22.5, r: 1.8, f: INK },
      { k: 'c', cx: 28, cy: 22.5, r: 1.8, f: INK },
      { k: 'p', d: 'M20 27 Q24 30.2 28 27', s: INK, sw: 1.7 },
      { k: 'c', cx: 16.2, cy: 26, r: 1.7, f: '#FF8A65' },
      { k: 'c', cx: 31.8, cy: 26, r: 1.7, f: '#FF8A65' },
    ],
  },
];
