import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { biometricAvailable, biometricEnabled, enableBiometrics, disableBiometrics, type BiometricIdentity } from '@/lib/biometrics';
export function BiometricSettings({ identity }: { identity: BiometricIdentity }) {
  const [available, setAvailable] = useState(false), [enabled, setEnabled] = useState(false), [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let live = true;
    void Promise.all([biometricAvailable(), biometricEnabled(identity)]).then(([a,e]) => {
      if (live) { setAvailable(a); setEnabled(e); }
    }).catch(() => { if (live) setNotice('Biometric settings are unavailable.'); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [identity.kind, identity.id, identity.token]);
  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) { await disableBiometrics(); setEnabled(false); setNotice('Biometric unlock disabled.'); }
      else if (await enableBiometrics(identity)) { setEnabled(true); setNotice('Biometric unlock enabled.'); }
      else setNotice('Biometric verification cancelled or unavailable.');
    } catch { setNotice('Unable to change biometric settings.'); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 10 }}>
    <Text variant="bodyStrong">Biometric unlock</Text>
    <Text variant="bodySm">Optional fingerprint or face unlock on this device. New or expired sessions still require OTP.</Text>
    {notice ? <Text variant="caption">{notice}</Text> : null}
    <Button block variant="secondary" disabled={busy || (!available && !enabled)} onPress={() => void toggle()}>{enabled ? 'Disable biometric unlock' : 'Enable biometric unlock'}</Button>
    {!available ? <Text variant="caption">Enrolled device biometrics required.</Text> : null}
  </View>;
}
