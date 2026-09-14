import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { hasStudyMaterial, subjectOpen, type Chapter } from '@matricmate/core';
import { defaultChapterId, getAiSession, getChapter, getChapters, getSubjects } from '@/lib/content-readers';
import { currentAccess } from '@/lib/entitlement';

/**
 * The chapter a flashcards, blanks or short-question page opens on.
 *
 * A `?chapter=` that is not the student's own is a 404, not a page of some
 * other syllabus's content. getChapter answers under the student's session,
 * which row level security scopes to their board and class, and on the server
 * it no longer falls back to the chapter index other students' requests fill.
 *
 * With no id, the last chapter they read; that can belong to a board or class
 * they have since left, so it is checked the same way, and past it the first
 * chapter that has anything to practise.
 *
 * On a free trial, only a chapter of the trial's subject. The database serves
 * nothing else to a trial, so another subject's chapter would open as an
 * empty set; a link to one goes to that chapter's page instead, which says
 * why it is locked.
 */
export async function practiceChapter(requested?: string): Promise<Chapter> {
  const access = await currentAccess();
  if (requested) {
    const chapter = await getChapter(requested);
    if (!chapter) notFound();
    if (!subjectOpen(access, chapter.subjectId)) redirect(`/learn/chapter/${chapter.id}`);
    return chapter;
  }
  const last = await getChapter(await defaultChapterId());
  if (last && subjectOpen(access, last.subjectId)) return last;
  for (const subject of await getSubjects()) {
    if (!subjectOpen(access, subject.id)) continue;
    const first = (await getChapters(subject.id)).find(hasStudyMaterial);
    if (first) return first;
  }
  notFound();
}

/**
 * An AI-built set named by `?ai=`, with the chapter it was built from.
 *
 * A set that cannot be read under the student's own session is a 404. It used
 * to fall through to the chapter's ordinary bank set, so a student who opened
 * one of their saved sets silently got different questions, and a builder that
 * pushed `?ai=undefined` after a refusal looked like it had worked.
 */
export async function aiPracticeSet(id: string, requested?: string) {
  const set = await getAiSession(id);
  if (!set) notFound();
  const chapter = await practiceChapter(set.chapterId ?? requested);
  return { set, chapter };
}
