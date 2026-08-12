import { useState } from 'react';
import { ActivityIndicator, Text , View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Empty, H2, Header, IconButton, Item, Pill, Row, Screen, Small, Spacer, useToast } from '../../../src/components/ui';
import { api , chapterPct, hasStudyMaterial , subjectById } from '@matricmate/core';
import { chapterDownloadBytes, formatBytes } from '../../../src/core/downloads';
import { useAsync } from '../../../src/core/useAsync';
import { useT } from '../../../src/i18n';
import { useApp } from '../../../src/store/app';
import { C, F, S } from '../../../src/theme';

export default function ChapterHub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { data: chapter } = useAsync(() => api.getChapter(id), [id]);
  const { data: content } = useAsync(() => api.getChapterContent(id), [id]);

  // Guards a direct link or an old bookmark to a chapter the board doesn't
  // examine: no notes, audio, flashcards, MCQs, short questions or blanks
  // exist for it, so there is nothing the usual grid could open.
  if (chapter && !hasStudyMaterial(chapter)) {
    return (
      <Screen>
        <Header title={`Chapter ${chapter.number}`} sub={subjectById(chapter.subjectId)?.name} back />
        <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
          <H2 style={{ color: '#fff' }}>{chapter.title}</H2>
          <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 21, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
            {chapter.blurb}
          </Text>
        </Card>
        <Spacer h={S.lg} />
        <Empty title={t('study.emptyChapterTitle')} sub={t('study.emptyChapterBody')} />
      </Screen>
    );
  }

  const pct = chapterPct(id, state.readSections, state.attempts);
  const downloaded = state.downloads.includes(id);

  async function toggleDownload() {
    setBusy(true);
    const result = await actions.toggleDownload(id);
    setBusy(false);
    if (result === 'downloaded') toast(t('study.saveOffline'));
    else if (result === 'removed') toast(t('study.removedOffline'));
    else toast(t('downloads.saveFailed'));
  }
  const readCount = content ? content.sections.filter((s) => state.readSections.includes(s.id)).length : 0;
  const best = state.results.filter((r) => r.chapterId === id).sort((a, b) => b.score / b.total - a.score / a.total)[0];
  const knownCards = content ? content.flashcards.filter((f) => state.cardsKnown.includes(f.id)).length : 0;

  return (
    <Screen
      footer={
        <Btn
          title={readCount ? t('study.continueReading') : t('study.startReading')}
          onPress={() => router.push(`/learn/reader/${id}`)}
        />
      }
    >
      <Header
        title={`Chapter ${chapter?.number ?? ''}`}
        sub={chapter ? subjectById(chapter.subjectId)?.name : ' '}
        back
        right={
          busy ? (
            <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={C.teal} />
            </View>
          ) : (
            <IconButton icon={downloaded ? 'check' : 'download'} tone={downloaded ? 'active' : 'card'} onPress={toggleDownload} />
          )
        }
      />

      <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
        <H2 style={{ color: '#fff' }}>{chapter?.title ?? ''}</H2>
        <Text style={{ fontFamily: F.body, fontSize: 13, lineHeight: 21, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
          {chapter?.blurb}
        </Text>
        <Row gap={S.md} style={{ marginTop: S.md }}>
          <View style={{ flex: 1, height: 7, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 99, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.orange, borderRadius: 99 }} />
          </View>
          <Text style={{ fontFamily: F.display, fontSize: 15, color: '#fff' }}>{pct}%</Text>
        </Row>
      </Card>

      <Spacer h={S.lg} />
      <Small style={{ fontFamily: F.bodyBold, marginBottom: S.sm }}>{t('study.sections')}</Small>
      <Card flat style={{ paddingVertical: 0 }}>
        <Item
          title={t('study.notes')}
          sub={content ? t('study.notesSub', { n: content.sections.length, read: readCount }) : t('common.loading')}
          icon="book"
          pct={content?.sections.length ? (readCount / content.sections.length) * 100 : 0}
          onPress={() => router.push(`/learn/reader/${id}`)}
        />
        <Item
          title={t('study.audio')}
          sub={chapter ? t('study.audioSub', { n: chapter.audioMinutes }) : ''}
          icon="headphones"
          onPress={() => router.push(`/learn/audio/${id}`)}
        />
        <Item
          title={t('study.flashcards')}
          sub={content ? t('study.flashcardsSub', { n: content.flashcards.length, known: knownCards }) : ''}
          icon="cards"
          onPress={() => router.push(`/session/flashcards?chapter=${id}`)}
        />
        <Item
          title={t('study.mcqs')}
          sub={
            content
              ? best
                ? t('study.mcqsBest', { n: content.mcqs.length, score: `${best.score}/${best.total}` })
                : t('study.mcqsSub', { n: content.mcqs.length })
              : ''
          }
          icon="target"
          onPress={() => router.push(`/session/setup?chapter=${id}`)}
        />
        <Item
          title={t('study.shortQ')}
          sub={content ? t('study.shortQSub', { n: content.shortQs.length }) : ''}
          icon="quill"
          onPress={() => router.push(`/session/shortq?chapter=${id}`)}
        />
        <Item
          title={t('study.blanks')}
          sub={content ? t('study.blanksSub', { n: content.blanks.length }) : ''}
          icon="edit"
          last
          onPress={() => router.push(`/session/blanks?chapter=${id}`)}
        />
      </Card>

      <Spacer h={S.lg} />
      <Row gap={S.sm}>
        <Pill tone={downloaded ? 'green' : 'grey'} icon={downloaded ? 'check' : 'download'}>
          {downloaded ? t('study.savedOffline') : t('study.notDownloaded')}
        </Pill>
        {downloaded ? <Pill tone="grey">{formatBytes(chapterDownloadBytes(id))}</Pill> : null}
      </Row>
    </Screen>
  );
}
