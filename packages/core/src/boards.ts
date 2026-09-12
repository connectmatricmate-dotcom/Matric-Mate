import type { Board } from './types';

/**
 * How a board is named to a model and in a label. FBISE is known by its
 * initials; the Punjab boards are nine (Lahore, Rawalpindi, Multan and the
 * rest) setting papers from one textbook, so they are named together.
 */
export const BOARD_LABEL: Record<Board, string> = {
  fbise: 'FBISE',
  punjab: 'Punjab Board',
};

/** A board value from anywhere untrusted (a profile row, a request), defaulting to FBISE. */
export const asBoard = (value: unknown): Board => (value === 'punjab' ? 'punjab' : 'fbise');

/** The same name after "a" or "an", for prompts that say "an FBISE examiner". */
export const BOARD_WITH_ARTICLE: Record<Board, string> = {
  fbise: 'an FBISE',
  punjab: 'a Punjab Board',
};

/**
 * The board an account actually chose, from its saved onboarding, or null
 * when it has not chosen one there.
 *
 * Deliberately not profiles.board. That column defaults to 'fbise', so on a
 * brand-new account it cannot tell "chose FBISE" from "has not chosen", and a
 * phone that onboarded as Punjab before signing in would be reset to FBISE by
 * the first sync. The onboarding record only carries a board once a student
 * has picked one, and 0036 keeps the column in step with it.
 */
export const boardChoice = (onboarding: unknown): Board | null => {
  const board = (onboarding as { board?: unknown } | null)?.board;
  return board === 'fbise' || board === 'punjab' ? board : null;
};

/**
 * The class an account actually chose, from its saved onboarding, or null when
 * it has not chosen one there. The same reasoning as boardChoice: profiles.grade
 * is `not null default 9`, so a brand-new account reads as Class 9 whether or
 * not anyone picked it, and a phone that onboarded as Class 10 before signing
 * up was turned into Class 9 by its first sync.
 */
export const gradeChoice = (onboarding: unknown): 9 | 10 | null => {
  const level = Number((onboarding as { classLevel?: unknown } | null)?.classLevel);
  return level === 9 || level === 10 ? level : null;
};

/**
 * The language a subject is written in, for a student reading in `medium`.
 *
 * Most subjects follow the student's medium. The language subjects do not:
 * Urdu is taught in Urdu and English in English whatever medium a student
 * reads in, and Punjab's Islamiyat is in Urdu, the only language its book
 * exists in. Content for those is written once and filed under both mediums,
 * so anything that asks a model for more of it, labels its narration, or
 * decides which way its text runs has to ask this rather than the medium.
 *
 * Takes a subject id or a chapter id: the subject leads every chapter id, and
 * Punjab's carry `-pj-`, so a chapter id settles the board on its own.
 */
export function subjectMedium(subjectOrChapterId: string, board: Board | null | undefined, medium: 'en' | 'ur'): 'en' | 'ur' {
  const subject = subjectOrChapterId.split('-')[0];
  const punjab = board === 'punjab' || subjectOrChapterId.includes('-pj-');
  if (subject === 'urd') return 'ur';
  if (subject === 'eng') return 'en';
  if (subject === 'isl' && punjab) return 'ur';
  return medium;
}

/** True when a subject reads in one language for every student. See subjectMedium. */
export const isOneLanguageSubject = (subjectOrChapterId: string, board?: Board | null): boolean =>
  subjectMedium(subjectOrChapterId, board, 'en') === subjectMedium(subjectOrChapterId, board, 'ur');
