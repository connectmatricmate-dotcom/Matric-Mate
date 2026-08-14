/**
 * The avatar cast: emoji characters on designed tint discs.
 *
 * The client's verdict after seeing both directions: the emoji profile
 * pictures were the ones he liked. So emoji it is, dressed up rather than
 * bare: every character sits on its own soft colour disc from the app's
 * palette, which is what separates "designed sticker" from "default emoji".
 *
 * One definition renders everywhere: a Text glyph on Android, a span on the
 * web, both on the same tinted circle. No image files, no licensing, and the
 * characters read instantly at any size.
 *
 * Settings.avatar indexes this array, so ORDER IS API: append new characters,
 * never reorder or remove. The first five are the original line-up.
 */

export type Avatar = { id: string; name: string; emoji: string; bg: string };

export const AVATARS: Avatar[] = [
  { id: 'scholar', name: 'Scholar', emoji: '🧑🏽‍🎓', bg: '#E4F1F6' },
  { id: 'topper', name: 'Topper', emoji: '👩🏽‍🎓', bg: '#FBE9F0' },
  { id: 'hijabi', name: 'Aapi', emoji: '🧕🏽', bg: '#FFF0DC' },
  { id: 'coder', name: 'Coder', emoji: '👨🏽‍💻', bg: '#E8ECFA' },
  { id: 'hero', name: 'Hero', emoji: '🦸🏽', bg: '#EFE8FB' },
  { id: 'scientist', name: 'Scientist', emoji: '👩🏽‍🔬', bg: '#E7F5EC' },
  { id: 'astro', name: 'Khalabaz', emoji: '🧑🏽‍🚀', bg: '#E2F4FA' },
  { id: 'star', name: 'Sitara', emoji: '🌟', bg: '#FFF3C4' },
  { id: 'cricketer', name: 'All-rounder', emoji: '🏏', bg: '#E3F4EE' },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', bg: '#E1F1F4' },
  { id: 'lion', name: 'Sher', emoji: '🦁', bg: '#FDEEE3' },
  { id: 'cat', name: 'Billi', emoji: '🐱', bg: '#FFF0DC' },
  { id: 'panda', name: 'Panda', emoji: '🐼', bg: '#EFF3F0' },
  { id: 'owl', name: 'Ullu', emoji: '🦉', bg: '#ECE7FA' },
  { id: 'robot', name: 'Robo', emoji: '🤖', bg: '#E2F4FA' },
  { id: 'target', name: 'Nishana', emoji: '🎯', bg: '#FBECEB' },
];
