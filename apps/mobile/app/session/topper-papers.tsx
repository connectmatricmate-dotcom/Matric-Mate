import { Linking, Text, View } from 'react-native';
import { fbiseToppersFor, fbiseTopperSubjectIds, subjectById } from '@matricmate/core';
import { Icon, SUBJECT_ICON } from '../../src/components/Icon';
import { Btn, Card, Empty, Header, Row, Screen, Small, Spacer, Ur, useToast } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import { C, F, S } from '../../src/theme';

export default function TopperPapers() {
  const t = useT();
  const toast = useToast();
  const groups = fbiseTopperSubjectIds().map((subjectId) => ({
    subjectId,
    scripts: fbiseToppersFor(subjectId),
  }));

  async function openScript(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      toast(t('common.openLinkError'));
    }
  }

  return (
    <Screen>
      <Header title={t('session.toppersTitle')} sub={t('session.toppersSub')} back />

      <Card border={C.tealTint2}>
        <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: C.tealTint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="award" size={18} color={C.teal} />
          </View>
          <Small style={{ flex: 1, lineHeight: 19 }}>{t('session.toppersIntro')}</Small>
        </Row>
      </Card>

      <Spacer h={S.md} />

      {groups.length === 0 ? (
        <Empty emoji="🏆" title={t('session.papersEmptyTitle')} sub={t('session.papersEmptyBody')} />
      ) : (
        <View style={{ gap: S.sm }}>
          {groups.map(({ subjectId, scripts }) => {
            const subject = subjectById(subjectId);
            if (!subject || scripts.length === 0) return null;
            return (
              <Card key={subjectId} flat style={{ gap: S.md }}>
                <Row gap={S.md}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      backgroundColor: C.tealTint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={SUBJECT_ICON[subjectId] ?? 'book'} size={22} color={C.teal} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
                      <Text style={{ fontFamily: F.bodyBold, fontSize: 15.5, color: C.ink }}>{subject.name}</Text>
                      {subject.urduName ? <Ur size={15} style={{ color: C.ink2 }}>{subject.urduName}</Ur> : null}
                    </Row>
                    <Small>{t('session.toppersCount', { n: scripts.length })}</Small>
                  </View>
                </Row>
                <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
                  {scripts.map((s) => (
                    <Btn
                      key={s.url}
                      title={t('session.toppersScript', { n: s.n })}
                      variant="line"
                      sm
                      onPress={() => openScript(s.url)}
                    />
                  ))}
                </Row>
              </Card>
            );
          })}
        </View>
      )}

      <Spacer h={S.md} />
      <Small>{t('session.toppersFootnote')}</Small>
    </Screen>
  );
}
