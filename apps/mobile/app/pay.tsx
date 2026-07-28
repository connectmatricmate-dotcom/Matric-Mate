import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../src/components/Icon';
import { Body, Btn, Card, Field, H2, Header, Pill, Row, Screen, Seg, Small, Spacer } from '../src/components/ui';
import { api } from '../src/core/api';
import { useApp } from '../src/store/app';
import { C, F, S } from '../src/theme';

type Method = 'card' | 'jazzcash' | 'easypaisa';

export default function Pay() {
  const { actions } = useApp();
  const [method, setMethod] = useState<Method>('jazzcash');
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string; validTill: number } | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.pay({ method, amount: 1000 });
      actions.subscribe(res);
      setDone(res);
    } catch {
      setError('Payment could not be completed. Try again or use another method.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Spacer h={S.xxl} />
        <View style={{ alignItems: 'center', gap: S.md }}>
          <View style={{ width: 92, height: 92, borderRadius: 99, backgroundColor: C.greenTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" size={44} color={C.green} strokeWidth={2.6} />
          </View>
          <H2 style={{ textAlign: 'center' }}>Shabash! You’re Premium 🎉</H2>
          <Body style={{ textAlign: 'center', color: C.ink2 }}>
            Active till{' '}
            {new Date(done.validTill).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Body>
          <Pill tone="grey">Receipt {done.ref}</Pill>
        </View>
        <Spacer h={S.xl} />
        <Btn title="Let’s start" variant="orange" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  return (
    <Screen footer={<Btn title="Pay Rs 1,000" onPress={pay} loading={busy} />}>
      <Header title="Payment" sub="Secured by Safepay" back />

      <Seg
        value={method}
        onChange={setMethod}
        options={[
          { value: 'jazzcash', label: 'JazzCash' },
          { value: 'easypaisa', label: 'EasyPaisa' },
          { value: 'card', label: 'Card' },
        ]}
      />
      <Spacer h={S.md} />

      {error ? (
        <Card flat tint={C.redTint} border={C.red} style={{ marginBottom: S.md }}>
          <Body style={{ color: C.red, fontSize: 13.5 }}>{error}</Body>
        </Card>
      ) : null}

      {method === 'card' ? (
        <>
          <Field label="Card number" value={card} onChangeText={setCard} placeholder="4242 4242 4242 4242" icon="card" keyboardType="numeric" />
          <Row gap={S.sm}>
            <View style={{ flex: 1 }}>
              <Field label="Expiry" value={expiry} onChangeText={setExpiry} placeholder="12/27" icon="clock" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="CVC" value={cvc} onChangeText={setCvc} placeholder="123" icon="lock" keyboardType="numeric" secure />
            </View>
          </Row>
        </>
      ) : (
        <>
          <Field
            label={`${method === 'jazzcash' ? 'JazzCash' : 'EasyPaisa'} mobile number`}
            value={phone}
            onChangeText={setPhone}
            placeholder="03001234567"
            icon="send"
            keyboardType="phone-pad"
          />
          <Card flat tint={C.tealTint} style={{ marginBottom: S.md }}>
            <Small>
              After you tap pay, approve the request in your {method === 'jazzcash' ? 'JazzCash' : 'EasyPaisa'} app. We
              wait for confirmation and unlock Premium automatically.
            </Small>
          </Card>
        </>
      )}

      <Card flat style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>Premium · 1 month</Text>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>Rs 1,000</Text>
      </Card>
      <Spacer h={S.md} />
      <Small>
        Demo build: no real payment is taken. The live app uses Safepay hosted checkout with a server webhook.
      </Small>
    </Screen>
  );
}
