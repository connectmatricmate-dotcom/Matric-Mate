import { View } from 'react-native';
import { Btn, Card, H3, Pill, Screen, Header, Small, Tap, Ur } from './ui';
import { C, S } from '../theme';
import { Icon } from './Icon';

export function Steps({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: S.lg }}>
      {[1, 2, 3, 4].map((n) => (
        <View
          key={n}
          style={{
            width: n === step ? 22 : 8,
            height: 8,
            borderRadius: 99,
            backgroundColor: n <= step ? C.teal : '#DDE6E1',
          }}
        />
      ))}
    </View>
  );
}

/** Big selectable card used by all four onboarding choice screens. */
export function ChoiceCard({
  title,
  sub,
  urduTitle,
  urduSub,
  selected,
  disabled,
  onPress,
}: {
  title?: string;
  sub?: string;
  urduTitle?: string;
  urduSub?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Tap onPress={disabled ? undefined : onPress}>
      <Card
        flat={!selected}
        tint={selected ? C.tealTint : undefined}
        border={selected ? C.teal : undefined}
        style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, opacity: disabled ? 0.55 : 1 }}
      >
        <View style={{ flex: 1 }}>
          {urduTitle ? <Ur size={19}>{urduTitle}</Ur> : <H3>{title}</H3>}
          {urduSub ? <Ur size={13} style={{ color: C.ink2 }}>{urduSub}</Ur> : sub ? <Small>{sub}</Small> : null}
        </View>
        {disabled ? (
          <Pill tone="grey">Coming soon</Pill>
        ) : selected ? (
          <View style={{ width: 26, height: 26, borderRadius: 99, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={15} color="#fff" strokeWidth={3} />
          </View>
        ) : (
          <View style={{ width: 26, height: 26, borderRadius: 99, borderWidth: 2, borderColor: '#DDE6E1' }} />
        )}
      </Card>
    </Tap>
  );
}

export function StepScreen({
  step,
  title,
  sub,
  children,
  cta,
  onNext,
  disabled,
}: {
  step: number;
  title: string;
  sub: string;
  children: React.ReactNode;
  cta: string;
  onNext: () => void;
  disabled?: boolean;
}) {
  return (
    <Screen footer={<Btn title={cta} onPress={onNext} disabled={disabled} />}>
      <Header title={title} sub={sub} back />
      <Steps step={step} />
      <View style={{ gap: S.md }}>{children}</View>
    </Screen>
  );
}
