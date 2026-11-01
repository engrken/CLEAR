import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { getItem, setItem, deleteItem } from './secure-storage';
const KEY = 'clear.biometric.optin.v1';
export type BiometricIdentity = { kind: 'officer' | 'global'; id: string; token: string };
const scope = (i: BiometricIdentity) => i.kind + ':' + i.id;
export async function biometricAvailable() {
  return Platform.OS !== 'web' && await LocalAuthentication.hasHardwareAsync() && await LocalAuthentication.isEnrolledAsync();
}
export async function biometricEnabled(i: BiometricIdentity) { return await getItem(KEY) === scope(i); }
export async function disableBiometrics() { await deleteItem(KEY); }
async function verify(promptMessage: string) {
  if (!await biometricAvailable()) return false;
  const r = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: true, cancelLabel: 'Cancel' });
  return r.success;
}
export async function enableBiometrics(i: BiometricIdentity) {
  if (!await verify('Enable biometric unlock for CLEAR')) return false;
  await setItem(KEY, scope(i));
  return true;
}
export async function unlockWithBiometrics() { return verify('Unlock CLEAR'); }
