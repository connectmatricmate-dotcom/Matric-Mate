import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../../src/components/Icon';
import {
  Btn,
  Card,
  H2,
  Header,
  Item,
  Pill,
  Row,
  Screen,
  Small,
  Spacer,
  Tap,
  useToast,
} from '../../../src/components/ui';
import { api } from '../../../src/core/api';
import { chapterPct } from '../../../src/core/domain';
import { useAsync } from '../../../src/core/useAsync';
import { subjectById } from '../../../src/core/content';
import { useApp } from '../../../src/store/app';
import { C, F, S } from '../../../src/theme';

export default function ChapterHub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, actions } = useApp();
  const toast = useToast();
  const { data: chapter } = useAsync(() => api.getChapter(id), [id]);
  const { data: content } = useAsync(() => api.getChapterContent(id), [id]);

  const pct = chapterPct(id, state.readSections, state.attempts);
  const downloaded = state.downloads.includes(id);
  const readCount = content ? content.sections.filter((s) => state.readSections.includes(s.id)).length : 0;
  const bestResult = state.results.filter((r) => r.chapterId === id).sort((a, b) => b.score / b.total - a.score / a.total)[0];
  const knownCards = content ? content.flashcards.filter((f) => state.cardsKnown.includes(f.id)).length : 0;

  return (
    <Screen
      footer={
        <Btn
          title={readCount ? 'Continue reading' : 'Start reading'}
          onPress={() => router.push(`/learn/reader/${id}`)}
        />
      }
    >
      <Header
        title={chapter ? `Chapter ${chapter.number}` : 'Chapter'}
        sub={chapter ? `${subjectById(chapter.subjectId)?.name} · Class 9 FBISE` : ' '}
        back
        right={
          <Tap
            onPress={() => {
              actions.toggleDownload(id);
              toast(downloaded ? 'Removed from downloads' : 'Saved for offline ✓');
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: downloaded ? C.greenTint : C.card,
                borderWidth: 1,
                borderColor: downloaded ? C.green : C.line,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name={downloaded ? 'check' : 'download'} size={20} color={downloaded ? C.green : C.ink} />
            </View>
          </Tap>
        }
      />

      <Card style={{ backgroundColor: C.teal, borderColor: C.teal }}>
        <H2 style={{ color: '#fff' }}>{chapter?.title ?? ''}</H2>
        <Text style={{ fontFamily: F.body, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
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
      <Card flat style={{ paddingVertical: 2 }}>
        <Item
          title="Notes & examples"
          sub={content ? `${content.sections.length} sections · ${readCount} read` : 'Loading…'}
          icon="book"
          pct={content?.sections.length ? (readCount / content.sections.length) * 100 : 0}
          onPress={() => router.push(`/learn/reader/${id}`)}
        />
        <Item
          title="Audio lesson"
          sub={chapter ? `${chapter.audioMinutes} min · Urdu & English` : ''}
          icon="headphones"
          onPress={() => router.push(`/learn/audio/${id}`)}
        />
        <Item
          title="Flashcards"
          sub={content ? `${content.flashcards.length} cards · ${knownCards} known` : ''}
          icon="cards"
          onPress={() => router.push(`/session/flashcards?chapter=${id}`)}
        />
        <Item
          title="Practice MCQs"
          sub={content ? `${content.mcqs.length} questions${bestResult ? ` · best ${bestResult.score}/${bestResult.total}` : ''}` : ''}
          icon="target"
          onPress={() => router.push(`/session/setup?chapter=${id}`)}
        />
        <Item
          title="Short questions"
          sub={content ? `${content.shortQs.length} with model answers` : ''}
          icon="quill"
          onPress={() => router.push(`/session/shortq?chapter=${id}`)}
        />
        <Item
          title="Fill in the blanks"
          sub={content ? `${content.blanks.length} items` : ''}
          icon="edit"
          onPress={() => router.push(`/session/blanks?chapter=${id}`)}
          last
        />
      </Card>

      <Spacer h={S.lg} />
      <Row gap={S.sm}>
        <Pill tone={downloaded ? 'green' : 'grey'} icon={downloaded ? 'check' : 'download'}>
          {downloaded ? 'Available offline' : 'Not downloaded'}
        </Pill>
        <Pill tone="orange">≈ 2 MB</Pill>
      </Row>
    </Screen>
  );
}
