import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Keychain (iOS) / Keystore-backed storage (Android). Expo web has no secure
// store, so the browser preview falls back to localStorage.

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Private browsing or blocked storage: the session just won't survive a reload.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // nothing stored
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
