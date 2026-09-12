import { chapterById, chapterName } from './content';

/**
 * Turning "you should revise Kinematics" into a button that opens Kinematics.
 *
 * A tutor that can only talk is half a tutor. The student is inside an app
 * that already has the notes, the flashcards, the revision sheet and a
 * practice set for every chapter, and the answer used to end by describing
 * where those things were and leaving them to go and find them.
 *
 * So the model is allowed to emit action tags, and only action tags:
 *
 *     [[practice:phy-9-3]]
 *
 * No label in the tag, deliberately. The model writes prose, not interface
 * copy, and a label it invented would be English in front of an Urdu-medium
 * student and would drift in tone from every other button in the app. The
 * verb picks a localised label; the chapter id supplies the name.
 *
 * Ids are checked against the real catalogue before anything is rendered, so
 * a hallucinated chapter becomes nothing at all rather than a button that
 * leads to an error screen. The model is given the true ids in its context
 * (see buildStandingContext in the tutor route), which is what makes that
 * rare rather than routine.
 */

export type TutorActionKind = 'read' | 'audio' | 'sheet' | 'flashcards' | 'practice' | 'shortq' | 'blanks' | 'chapter';

export type TutorAction = { kind: TutorActionKind; chapterId: string; chapterTitle: string };

/**
 * Where each verb goes. Identical in both apps, which is not a coincidence:
 * expo-router and the Next app router were given the same route names for
 * exactly this sort of thing.
 */
export const TUTOR_ACTION_ROUTE: Record<TutorActionKind, (id: string) => string> = {
  read: (id) => `/learn/reader/${id}`,
  audio: (id) => `/learn/audio/${id}`,
  sheet: (id) => `/learn/sheet/${id}`,
  chapter: (id) => `/learn/chapter/${id}`,
  flashcards: (id) => `/session/flashcards?chapter=${id}`,
  practice: (id) => `/session/setup?chapter=${id}`,
  shortq: (id) => `/session/shortq?chapter=${id}`,
  blanks: (id) => `/session/blanks?chapter=${id}`,
};

/** The i18n key for each verb's button label. */
export const TUTOR_ACTION_LABEL: Record<TutorActionKind, string> = {
  read: 'tutor.actionRead',
  audio: 'tutor.actionAudio',
  sheet: 'tutor.actionSheet',
  chapter: 'tutor.actionChapter',
  flashcards: 'tutor.actionFlashcards',
  practice: 'tutor.actionPractice',
  shortq: 'tutor.actionShortq',
  blanks: 'tutor.actionBlanks',
};

const KINDS = Object.keys(TUTOR_ACTION_ROUTE) as TutorActionKind[];

/** `[[verb:chapter-id]]`, with room for stray spaces the model may add. */
const TAG = /\[\[\s*([a-z]+)\s*:\s*([a-z0-9-]+)\s*\]\]/gi;

/**
 * A tag that is still being typed, at the very end of the text.
 *
 * Only matters while streaming: without this the student watches "[", then
 * "[[pra", then "[[practice:phy-" appear in the middle of their answer before
 * it turns into a button. Anchored to the end so a real bracket earlier in the
 * answer, which chemistry and maths both use, is left alone.
 */
const PARTIAL = /\[\[?[^[\]]*$/;

/**
 * Split an answer into the prose to show and the buttons to draw under it.
 *
 * `streaming` true also hides a half-written tag at the end. Pass false once
 * the answer is complete, or a genuine trailing bracket would be eaten.
 *
 * `lang` names the chapter in the student's language. Without it the button
 * carried the English title in front of an Urdu reader, which the rest of the
 * interface never does.
 */
export function parseTutorActions(raw: string, streaming = false, lang = 'en'): { text: string; actions: TutorAction[] } {
  const actions: TutorAction[] = [];
  const seen = new Set<string>();

  let text = raw.replace(TAG, (_match, verb: string, id: string) => {
    const kind = verb.toLowerCase() as TutorActionKind;
    const key = `${kind}:${id}`;
    // An id the catalogue does not know is a hallucination. Drop it silently:
    // a button to nowhere is worse than no button.
    const chapter = KINDS.includes(kind) && !seen.has(key) ? chapterById(id) : undefined;
    if (chapter) {
      seen.add(key);
      actions.push({ kind, chapterId: id, chapterTitle: chapterName(chapter, lang) });
    }
    return '';
  });

  if (streaming) text = text.replace(PARTIAL, '');

  /*
   * The tags sit on their own line at the end, so removing them leaves a tail
   * of blank lines. Collapse runs of three or more newlines and trim, rather
   * than trimming only the end: a tag mid-answer would otherwise leave a hole.
   */
  text = text.replace(/\n{3,}/g, '\n\n').trimEnd();

  // Two is the cap, whatever the model sent. Past that it stops reading as
  // "here is where to go next" and starts reading as a menu.
  return { text, actions: actions.slice(0, 2) };
}
