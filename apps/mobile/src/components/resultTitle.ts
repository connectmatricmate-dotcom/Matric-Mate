import { chapterById, chapterName, subjectById, subjectName, translate } from '@matricmate/core';
import type { Language, TestResult } from '@matricmate/core';

/**
 * A saved session's title in the language the app is in now.
 *
 * The title is written into the result when the session ends, in whatever
 * language the app was in then, and results synced from the website arrive in
 * the website's. So "Physics · Mixed, all chapters" sat in an Urdu list after
 * a language switch. The standard titles are rebuilt from the result's own
 * chapter and subject; anything else (a mock paper's own title) is left as the
 * student saw it.
 */
export function resultTitle(r: TestResult, lang: Language): string {
  const shapes = (l: Language): string[] => {
    const subject = subjectName(subjectById(r.subjectId), l);
    const chapter = r.chapterId ? chapterName(chapterById(r.chapterId), l) : '';
    if (r.mode === 'exam') {
      const exam = translate(l, 'session.examTitle');
      return [
        chapter && `${chapter} · ${exam}`,
        subject && `${subject} · ${exam}`,
        `${translate(l, 'tutor.aiTestTitle')} · ${exam}`,
      ];
    }
    return [chapter, subject && `${subject} · ${translate(l, 'session.mixed')}`, translate(l, 'tutor.aiMade')];
  };
  const other: Language = lang === 'ur' ? 'en' : 'ur';
  const i = shapes(other).findIndex((shape) => shape && shape === r.label);
  return i < 0 ? r.label : shapes(lang)[i] || r.label;
}
