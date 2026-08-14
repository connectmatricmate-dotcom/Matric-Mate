import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, ErrorState, Header, Label, Screen, Skeleton, Small, Spacer } from '../../src/components/ui';
import { useAsync } from '../../src/core/useAsync';
import { useT } from '../../src/i18n';
import { supabase } from '../../src/lib/supabase';
import { C, F, S } from '../../src/theme';

type CertDetail = {
  id: string;
  teacher: string;
  title: string | null;
  bio: string | null;
  image_url: string;
  issued_on: string | null;
};

/**
 * One teacher, one certificate. The picture is the point: it renders at
 * its own aspect ratio, full width, inside a plain frame, because a trust
 * document should look like a document and not like app chrome.
 */
export default function Certificate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const { data: cert, loading, error, reload } = useAsync<CertDetail | null>(async () => {
    const { data, error: qErr } = await supabase
      .from('certificates')
      .select('id,teacher,title,bio,image_url,issued_on')
      .eq('id', id)
      .maybeSingle();
    if (qErr) throw qErr;
    return (data as CertDetail) ?? null;
  }, [id]);

  // The image keeps its own proportions: measured once, never squashed.
  const [ratio, setRatio] = useState(1.414);
  useEffect(() => {
    if (cert?.image_url) {
      Image.getSize(
        cert.image_url,
        (w, h) => setRatio(w && h ? w / h : 1.414),
        () => {},
      );
    }
  }, [cert?.image_url]);

  return (
    <Screen>
      <Header title={t('cert.title')} back />
      {loading ? (
        <Skeleton h={260} />
      ) : error || !cert ? (
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
      ) : (
        <>
          <Card>
            <Text style={{ fontFamily: F.display, fontSize: 19, color: C.ink }}>{cert.teacher}</Text>
            {cert.title ? <Small style={{ marginTop: 2 }}>{cert.title}</Small> : null}
            {cert.issued_on ? (
              <Small style={{ marginTop: 2 }}>
                {t('cert.issued', {
                  date: new Date(cert.issued_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
                })}
              </Small>
            ) : null}
            {cert.bio ? (
              <Text style={{ fontFamily: F.body, fontSize: 13.5, lineHeight: 21, color: C.ink2, marginTop: S.sm }}>
                {cert.bio}
              </Text>
            ) : null}
          </Card>

          <Spacer h={S.md} />
          <Label style={{ marginBottom: 6 }}>{t('cert.viewCertificate')}</Label>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: C.line, overflow: 'hidden', backgroundColor: C.card }}>
            <Image
              source={{ uri: cert.image_url }}
              style={{ width: '100%', aspectRatio: ratio }}
              resizeMode="contain"
              accessibilityLabel={t('cert.viewCertificate')}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
