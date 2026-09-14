import { useState } from 'react';
import { View } from 'react-native';
import { buildCareer, fetchCareer, formatDate, subjectById, subjectName, type CareerState } from '@matricmate/core';
import { AiLocked } from '../../src/components/AiLocked';
import { aiFailureKey } from '../../src/components/aiFailure';
import { Icon } from '../../src/components/Icon';
import { Bar, Btn, Card, ErrorState, H3, Header, Row, Screen, ScriptText, SectionTitle, Skeleton, Small, Spacer, Text, useToast } from '../../src/components/ui';
import { useOnline } from '../../src/core/connectivity';
import { useAsync } from '../../src/core/useAsync';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, rowDir } from '../../src/theme';

/**
 * AI, so not in Basic: the lock in its place (see AiLocked). Decided before
 * the screen's own hooks run, so it never starts a request it cannot make.
 */
export default function CareerGate() {
  const { derived } = useApp();
  if (derived.access.active && !derived.access.ai) return <AiLocked titleKey="career.title" />;
  return <Career />;
}

/**
 * Career guidance: the student's results, subject by subject, and what an AI
 * counsellor reads in them. The website's screen, on the phone; the reading
 * itself is written and kept by the server (/api/ai/career).
 *
 * The numbers come first and are always shown, so the guidance under them is
 * visibly about this student. Below enough answers there is no button, only
 * how many more to answer: advice from a handful of questions would be a
 * guess, and it would cost a question to get it.
 */
function Career() {
  const t = useT();
  const { lang } = useLang();
  const { state } = useApp();
  const online = useOnline();
  const toast = useToast();
  const [built, setBuilt] = useState<CareerState | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: read, loading, reload } = useAsync(async () => {
    if (!online || !state.user?.id) return null;
    const res = await fetchCareer();
    return res.ok ? res.data : null;
  }, [online, state.user?.id ?? '']);
  const career = built ?? read;

  async function build() {
    if (busy) return;
    setBusy(true);
    const res = await buildCareer(lang);
    setBusy(false);
    if (res.ok) setBuilt(res.data);
    else toast(t(res.reason === 'refused' || res.reason === 'syllabus' || res.reason === 'error' ? 'career.failed' : aiFailureKey(res.reason)));
  }

  const date = (iso: string) => formatDate(iso, lang, { day: 'numeric', month: 'long' });
  const report = career?.report ?? null;
  const subjects = career?.stats.filter((s) => s.answered > 0) ?? [];

  return (
    <Screen>
      <Header title={t('career.title')} sub={t('career.cardSub')} back />

      {!online ? (
        <ErrorState title={t('offline.title')} sub={t('career.failed')} retry={t('common.retry')} onRetry={reload} />
      ) : loading && !career ? (
        <View style={{ gap: S.md }}>
          <Card flat style={{ gap: S.md }}>
            <Skeleton w="40%" h={14} />
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ gap: 6 }}>
                <Skeleton w="60%" h={12} />
                <Skeleton h={7} />
              </View>
            ))}
          </Card>
          <Skeleton h={110} style={{ borderRadius: 16 }} />
        </View>
      ) : !career ? (
        <ErrorState title={t('states.errorTitle')} sub={t('career.failed')} retry={t('common.retry')} onRetry={reload} />
      ) : (
        <>
          {subjects.length ? (
            <>
              <SectionTitle>{t('career.yourResults')}</SectionTitle>
              <Card flat style={{ gap: S.md }}>
                {subjects.map((s) => (
                  <View key={s.subject}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <ScriptText text={subjectName(subjectById(s.subject), lang) || s.subject} face="bodyBold" size={13.5} style={{ flex: 1 }} />
                      <Small>
                        {t('career.answered', { n: s.answered })} · <Text style={{ fontFamily: F.bodyBold, color: C.ink }}>{`${s.accuracy}%`}</Text>
                      </Small>
                    </Row>
                    <View style={{ marginTop: 6 }}>
                      <Bar pct={s.accuracy} tone={s.answered < career.need ? 'orange' : 'teal'} />
                    </View>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {!career.enough && !report ? (
            <>
              <Spacer h={S.md} />
              <Card flat tint={C.tealTint}>
                <H3>{t('career.notEnoughTitle')}</H3>
                <Spacer h={4} />
                <Small style={{ color: C.ink2 }}>{t('career.notEnoughBody', { n: career.need })}</Small>
              </Card>
            </>
          ) : null}

          {career.enough && !report ? (
            <>
              <Spacer h={S.md} />
              <Card>
                <Small style={{ color: C.ink2 }}>{t('career.intro')}</Small>
                <Spacer h={S.md} />
                <Btn title={busy ? t('career.building') : t('career.build')} variant="orange" icon="spark" loading={busy} onPress={() => void build()} />
              </Card>
            </>
          ) : null}

          {report ? (
            <>
              <Spacer h={S.md} />
              <Card tint={C.tealTint} border={C.teal}>
                <ScriptText text={report.summary} size={14.5} />
                {career.createdAt ? (
                  <Small style={{ marginTop: S.sm }}>{t('career.basedOn', { n: career.answered, s: subjects.length, date: date(career.createdAt) })}</Small>
                ) : null}
              </Card>

              <Section title={t('career.streams')} icon="gradCap" rows={report.streams.map((s) => ({ name: s.name, why: s.why }))} />
              <Section title={t('career.fields')} icon="target" rows={report.fields.map((f) => ({ name: f.name, why: f.why }))} />
              <Section title={t('career.strengths')} icon="award" rows={report.strengths.map((s) => ({ name: s.subject, why: s.why }))} />

              <SectionTitle>{t('career.nextSteps')}</SectionTitle>
              <Card flat style={{ gap: S.sm }}>
                {report.nextSteps.slice(0, 3).map((step, i) => (
                  <View key={i} style={{ flexDirection: rowDir(), alignItems: 'flex-start', gap: S.sm }}>
                    <View style={{ width: 20, height: 20, borderRadius: 99, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                      <Text style={{ fontFamily: F.bodyBold, fontSize: 11, color: C.onBrand }}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <ScriptText text={step.replace(/^\s*\d{1,2}[.)]\s*/, '')} size={13.5} />
                    </View>
                  </View>
                ))}
              </Card>

              <Spacer h={S.md} />
              <Small>{t('career.disclaimer')}</Small>
              <Spacer h={S.sm} />
              {career.nextAt ? (
                <Small style={{ color: C.ink3 }}>{t('career.rebuildAfter', { date: date(career.nextAt) })}</Small>
              ) : career.enough ? (
                <Btn title={busy ? t('career.building') : t('career.rebuild')} variant="line" icon="refresh" sm loading={busy} onPress={() => void build()} />
              ) : null}
            </>
          ) : null}
        </>
      )}
      <Spacer h={S.lg} />
    </Screen>
  );
}

function Section({ title, icon, rows }: { title: string; icon: 'gradCap' | 'target' | 'award'; rows: { name: string; why: string }[] }) {
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card flat style={{ gap: S.md }}>
        {rows.map((r) => (
          <View key={r.name}>
            <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
              <Icon name={icon} size={16} color={C.teal} />
              <View style={{ flex: 1 }}>
                <ScriptText text={r.name} face="bodyBold" size={14} />
                <ScriptText text={r.why} size={13} color={C.ink2} style={{ marginTop: 2 }} />
              </View>
            </Row>
          </View>
        ))}
      </Card>
    </>
  );
}

