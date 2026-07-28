import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, Header, Pill, Row, Screen, Skeleton, Small, Spacer } from '../../src/components/ui';
import { api } from '../../src/core/api';
import { subjectById } from '../../src/core/content';
import { useAsync } from '../../src/core/useAsync';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

export default function Papers() {
  const { derived } = useApp();
  const [subjectId, setSubjectId] = useState<string>('phy');
  const { data: papers, loading } = useAsync(() => api.getPastPapers(subjectId), [subjectId]);

  const subjects = useMemo(() => derived.subjects.filter((s) => ['phy', 'chem', 'bio', 'math'].includes(s)), [derived.subjects]);

  return (
    <Screen>
      <Header title="Past papers" sub="FBISE · Class 9" back />

      <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
        {subjects.map((sid) => (
          <Pill key={sid} tone={sid === subjectId ? 'teal' : 'grey'} onPress={() => setSubjectId(sid)} style={{ paddingVertical: 8, paddingHorizontal: 14 }}>
            {subjectById(sid)?.name ?? sid}
          </Pill>
        ))}
      </Row>

      <Spacer h={S.md} />
      {loading ? (
        <View style={{ gap: S.sm }}>
          {[0, 1, 2].map((i) => (
            <Card key={i} flat>
              <Skeleton w="60%" h={14} />
              <Spacer h={S.sm} />
              <Skeleton w="35%" h={11} />
            </Card>
          ))}
        </View>
      ) : (
        <View style={{ gap: S.sm }}>
          {(papers ?? []).map((p) => (
            <Card key={p.id} flat>
              <Row gap={S.md}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tealTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="doc" color={C.teal} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>
                    FBISE {p.year} · {p.session}
                  </Text>
                  <Small>
                    {p.marks} marks · {Math.floor(p.minutes / 60)}h {p.minutes % 60}m
                  </Small>
                </View>
                {p.downloaded ? <Pill tone="green" icon="check">Offline</Pill> : null}
              </Row>
              <Row gap={S.sm} style={{ marginTop: S.md }}>
                <View style={{ flex: 1 }}>
                  <Btn title="View paper" variant="line" sm onPress={() => router.push(`/session/paper/${p.id}`)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Btn title="Practice as exam" sm onPress={() => router.push(`/session/exam-intro?subject=${p.subjectId}&paper=${p.year}`)} />
                </View>
              </Row>
            </Card>
          ))}
        </View>
      )}
      <Spacer h={S.lg} />
      <Small>Papers shown are placeholders — the client supplies the real FBISE papers.</Small>
    </Screen>
  );
}
