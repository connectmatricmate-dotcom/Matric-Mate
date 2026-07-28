/**
 * Android-side resolution of the shared audio track ids to bundled files.
 * The web app maps the same ids to public URLs.
 */
const FILES: Record<string, number> = {
  'dynamics-en': require('../../assets/audio/dynamics-en.mp3'),
  'dynamics-ur': require('../../assets/audio/dynamics-ur.mp3'),
};

export const audioSource = (trackId?: string) => (trackId ? (FILES[trackId] ?? null) : null);
