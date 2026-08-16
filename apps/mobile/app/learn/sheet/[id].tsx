
import { useLocalSearchParams } from 'expo-router';
import { Card, ErrorState, Header, Screen, Skeleton, Small, Spacer } from '../../../src/components/ui';
import { chapterById, fetchCheatSheet } from '@matricmate/core';
import { useAsync } from '../../../src/core/useAsync';
import { useT } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { S } from '../../../src/theme';
import { Markdown } from '../../../src/components/Markdown';

/**
 * The AI revision sheet: one page per chapter, definitions, formulas,
 * must-know points, common mistakes and likely questions. Generated once
 * per chapter and medium, cached for every student, so opening it a second
 * time is instant and free.
 */
export default function RevisionSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useApp();
  const t = useT();
  const chapter = chapterById(id);

  const sheet = useAsync(async () => {
    const res = await fetchCheatSheet({ chapterId: id, medium: state.settings.contentMedium });
    if (!res.ok) throw new Error(res.reason);
    return res.sheet;
  }, [id, state.settings.contentMedium]);

  return (
    <Screen>
      <Header title={t('tutor.sheetTitle')} sub={chapter?.title ?? ''} back />
      {sheet.loading ? (
        <>
          <Small>{t('tutor.sheetBusy')}</Small>
          <Spacer h={S.sm} />
          <Skeleton h={340} />
        </>
      ) : sheet.error || !sheet.data ? (
        <>
          <Spacer h={S.lg} />
          <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={sheet.reload} />
        </>
      ) : (
        <>
          <Card flat>
            <Markdown text={sheet.data} size={13.5} />
          </Card>
          <Spacer h={S.md} />
          <Small style={{ textAlign: 'center' }}>{t('tutor.aiMade')} · {t('tutor.disclaimer')}</Small>
          <Spacer h={S.lg} />
        </>
      )}
    </Screen>
  );
}
