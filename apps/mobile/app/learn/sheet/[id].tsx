import { useLocalSearchParams } from 'expo-router';
import { Card, Empty, ErrorState, Header, Screen, Skeleton, Small, Spacer } from '../../../src/components/ui';
import { api, chapterById, chapterName, fetchCheatSheet, subjectMedium } from '@matricmate/core';
import type { AiFail } from '@matricmate/core';
import { aiFailureKey, aiRetryable } from '../../../src/components/aiFailure';
import { useAsync } from '../../../src/core/useAsync';
import { useLang, useT } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { S } from '../../../src/theme';
import { Markdown } from '../../../src/components/Markdown';
import { AiLocked } from '../../../src/components/AiLocked';

/**
 * The AI revision sheet: one page per chapter, definitions, formulas,
 * must-know points, common mistakes and likely questions. Generated once
 * per chapter and medium, cached for every student, so opening it a second
 * time is instant and free.
 */
/**
 * AI, so not in Basic: the lock in its place (see AiLocked). Decided before
 * the screen's own hooks run, so it never starts a request it cannot make.
 */
export default function RevisionSheetGate() {
  const { derived } = useApp();
  if (derived.access.active && !derived.access.ai) return <AiLocked titleKey="tutor.sheetTitle" />;
  return <RevisionSheet />;
}

function RevisionSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, contentKey } = useApp();
  const t = useT();
  const { lang } = useLang();
  const { data: fetched } = useAsync(() => api.getChapter(id), [id, contentKey]);
  const chapter = fetched ?? chapterById(id);
  // The subject's own language: an English chapter gets an English sheet and
  // an Urdu one an Urdu sheet whatever the student reads in, and the sheet is
  // cached for everyone in the language it was written in.
  const medium = subjectMedium(id, state.onboarding?.board, state.settings.contentMedium);

  /**
   * Resolves with the sheet or with why there is none. It used to throw the
   * reason away, so offline, a spent allowance, no plan and a refusal all read
   * "Something went wrong" over a Retry that could not help most of them.
   */
  const sheet = useAsync(async (): Promise<{ ok: true; text: string } | { ok: false; reason: AiFail['reason'] }> => {
    const res = await fetchCheatSheet({ chapterId: id, medium });
    return res.ok ? { ok: true, text: res.sheet } : { ok: false, reason: res.reason };
  }, [id, medium]);
  const result = sheet.data;

  return (
    <Screen>
      <Header title={t('tutor.sheetTitle')} sub={chapter ? chapterName(chapter, lang) : ''} back />
      {sheet.loading ? (
        <>
          <Small>{t('tutor.sheetBusy')}</Small>
          <Spacer h={S.sm} />
          <Skeleton h={340} />
        </>
      ) : sheet.error || !result ? (
        <>
          <Spacer h={S.lg} />
          <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={sheet.reload} />
        </>
      ) : !result.ok ? (
        <>
          <Spacer h={S.lg} />
          {aiRetryable(result.reason) ? (
            <ErrorState title={t('states.errorTitle')} sub={t(aiFailureKey(result.reason))} retry={t('common.retry')} onRetry={sheet.reload} />
          ) : (
            // Nothing a retry can change: said plainly, with no button.
            <Empty emoji="📝" title={t('tutor.sheetTitle')} sub={t(aiFailureKey(result.reason))} />
          )}
        </>
      ) : (
        <>
          <Card flat>
            <Markdown text={result.text} size={13.5} />
          </Card>
          <Spacer h={S.md} />
          <Small style={{ textAlign: 'center' }}>{t('tutor.aiMade')} · {t('tutor.disclaimer')}</Small>
          <Spacer h={S.lg} />
        </>
      )}
    </Screen>
  );
}
