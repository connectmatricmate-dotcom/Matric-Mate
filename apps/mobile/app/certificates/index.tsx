import { router } from 'expo-router';
import { Card, Empty, ErrorState, Header, Item, Screen, Skeleton, Small, Spacer } from '../../src/components/ui';
import { useAsync } from '../../src/core/useAsync';
import { useT } from '../../src/i18n';
import { supabase } from '../../src/lib/supabase';
import { S } from '../../src/theme';

export type CertRow = {
  id: string;
  teacher: string;
  title: string | null;
  issued_on: string | null;
};

/**
 * The teacher roster: everyone who reviewed the study material and issued a
 * certificate. Trust material, so it is deliberately plain: real names,
 * real schools, and the certificate itself one tap away.
 */
export default function Certificates() {
  const t = useT();
  const { data, loading, error, reload } = useAsync<CertRow[]>(async () => {
    const { data: rows, error: qErr } = await supabase
      .from('certificates')
      .select('id,teacher,title,issued_on')
      .order('position')
      .limit(50);
    if (qErr) throw qErr;
    return (rows ?? []) as CertRow[];
  }, []);

  return (
    <Screen>
      <Header title={t('cert.title')} sub={t('cert.sub')} back />
      {loading ? (
        <Skeleton h={160} />
      ) : error ? (
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
      ) : !data?.length ? (
        <Empty emoji="🎓" title={t('cert.emptyTitle')} sub={t('cert.emptyBody')} />
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {data.map((c, i) => (
            <Item
              key={c.id}
              title={c.teacher}
              sub={c.title ?? undefined}
              emoji="🎓"
              tone="green"
              last={i === data.length - 1}
              onPress={() => router.push(`/certificates/${c.id}`)}
            />
          ))}
        </Card>
      )}
      <Spacer h={S.md} />
      <Small>{t('cert.sub')}</Small>
    </Screen>
  );
}
