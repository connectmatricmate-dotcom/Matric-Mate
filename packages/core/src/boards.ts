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
