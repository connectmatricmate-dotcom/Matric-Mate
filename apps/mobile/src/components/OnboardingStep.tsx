import { View } from 'react-native';
import { Btn, Card, Check, H3, Header, Pill, Screen, Small, Tap, Ur } from './ui';
import { C, S, rowDir } from '../theme';

export function Steps({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <View style={{ flexDirection: rowDir(), gap: 6, justifyContent: 'center', marginBottom: S.lg }}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <View
          key={n}
          style={{
            width: n === step ? 22 : 8,
            height: 8,
            borderRadius: 99,
            backgroundColor: n <= step ? C.teal : C.mute,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Selectable card used by every onboarding choice.
 * `round` marks single-choice (class, board, medium); square is multi-select.
 */
export function ChoiceCard({
  title,
  sub,
  urduTitle,
  selected,
  disabled,
  disabledLabel,
  onPress,
  round = true,
}: {
  title: string;
  sub?: string;
  urduTitle?: string;
  selected?: boolean;
  disabled?: boolean;
  disabledLabel?: string;
  onPress?: () => void;
  round?: boolean;
}) {
  // The handler stays when disabled: the Class 10 card uses it to explain
  // WHY it cannot be picked, and suppressing it made the tap dead air.
  return (
    <Tap onPress={onPress}>
      <Card
        flat={!selected}
        tint={selected ? C.tealTint : undefined}
        border={selected ? C.teal : undefined}
        style={{ flexDirection: rowDir(), alignItems: 'center', gap: S.md, opacity: disabled ? 0.55 : 1 }}
      >
        <View style={{ flex: 1 }}>
          <H3>{title}</H3>
          {urduTitle ? <Ur size={16}>{urduTitle}</Ur> : null}
          {sub ? <Small style={{ marginTop: 2 }}>{sub}</Small> : null}
        </View>
        {disabled ? <Pill tone="grey">{disabledLabel}</Pill> : <Check on={!!selected} round={round} />}
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
  footnote,
  auto,
}: {
  step: number;
  title: string;
  sub: string;
  children: React.ReactNode;
  cta: string;
  onNext: () => void;
  disabled?: boolean;
  footnote?: string;
  /**
   * The first run: a tap on a card is the answer and moves on, so the four
   * steps are four taps. The same screens reached from Edit profile keep the
   * button, because a change there can cost progress and asks first.
   */
  auto?: boolean;
}) {
  return (
    <Screen footer={auto ? undefined : <Btn title={cta} onPress={onNext} disabled={disabled} />}>
      <Header title={title} sub={sub} back />
      <Steps step={step} />
      <View style={{ gap: S.md }}>{children}</View>
      {footnote ? <Small style={{ marginTop: S.lg }}>{footnote}</Small> : null}
    </Screen>
  );
}
