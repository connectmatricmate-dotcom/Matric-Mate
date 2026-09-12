import { Linking, View } from 'react-native';
import { fbiseToppersFor, fbiseTopperSubjectIds, subjectById, subjectName, topperYears } from '@matricmate/core';
import { Icon, SUBJECT_ICON } from '../../src/components/Icon';
import { Btn, Card, Empty, Header, Row, Screen, ScriptText, Small, Spacer, useToast } from '../../src/components/ui';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';

export default function TopperPapers() {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const { state } = useApp();
  // FBISE's own scripts. Not offered to a Punjab student anywhere, and a link
  // that lands here anyway says why there are none rather than showing them.
  const punjab = state.onboarding?.board === 'punjab';
  const groups = punjab
    ? []
    : fbiseTopperSubjectIds().map((subjectId) => ({
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

      {/* FBISE's own wording, so not for a Punjab student who arrives by a
          link: the empty state below says why there are none for them. */}
      {punjab ? null : (
        <>
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
              <Small style={{ flex: 1 }}>{t('session.toppersIntro')}</Small>
            </Row>
          </Card>

          <Spacer h={S.md} />
        </>
      )}

      {groups.length === 0 ? (
        <Empty
          emoji="🏆"
          title={t(punjab ? 'session.toppersNonePunjabTitle' : 'session.papersEmptyTitle')}
          sub={t(punjab ? 'session.toppersNonePunjabBody' : 'session.papersEmptyBody')}
        />
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
                    <ScriptText text={subjectName(subject, lang)} face="bodyBold" size={15.5} />
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

      {/* Which examination these are from. Without it a Class 10 student reads
          a list of scripts with no year or level on it as their own. Not
          said over the Punjab empty state, where there are no scripts. */}
      {punjab ? null : (
        <>
          <Spacer h={S.md} />
          <Small>{t('session.toppersSource', { year: topperYears()[0] ?? '' })}</Small>
          <Small style={{ marginTop: 2 }}>{t('session.toppersFootnote')}</Small>
        </>
      )}
    </Screen>
  );
}
