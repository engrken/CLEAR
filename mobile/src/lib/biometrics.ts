import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getItem, setItem, deleteItem } from './secure-storage';

const PREFERENCE = 'clear.biometric.optin.v2';
const PROOF = 'clear.biometric.proof.v2';
export type BiometricIdentity = { kind: 'officer' | 'global'; id: string; token: string };
const scope = (identity: BiometricIdentity) => identity.kind + ':' + identity.id;

// Android Keystore / iOS Keychain biometric-gated secret. No account bearer
// token is copied to the proof. Changed biometric enrollment invalidates it.
export async function biometricAvailable(): Promise<boolean> {
  return Platform.OS !== 'web' && SecureStore.canUseBiometricAuthentication();
}
export async function biometricEnabled(identity: BiometricIdentity): Promise<boolean> {
  if (!(await biometricAvailable())) return false;
  return (await getItem(PREFERENCE)) === scope(identity);
}
export async function disableBiometrics(): Promise<void> {
  await deleteItem(PREFERENCE);
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(PROOF);
}
export async function enableBiometrics(identity: BiometricIdentity): Promise<boolean> {
  if (!(await biometricAvailable())) return false;
  try {
    const proof = 'CLEAR:' + scope(identity);
    await SecureStore.setItemAsync(PROOF, proof, { requireAuthentication: true, authenticationPrompt: 'Enable biometric unlock for CLEAR' });
    const confirmed = await SecureStore.getItemAsync(PROOF, { requireAuthentication: true, authenticationPrompt: 'Confirm biometric unlock for CLEAR' });
    if (confirmed !== proof) { await disableBiometrics(); return false; }
    await setItem(PREFERENCE, scope(identity));
    return true;
  } catch {
    await disableBiometrics();
    return false;
  }
}
export async function unlockWithBiometrics(identity: BiometricIdentity): Promise<boolean> {
  if (!(await biometricEnabled(identity))) return false;
  try {
    const proof = await SecureStore.getItemAsync(PROOF, { requireAuthentication: true, authenticationPrompt: 'Unlock CLEAR' });
    return proof === 'CLEAR:' + scope(identity);
  } catch { return false; }
}
