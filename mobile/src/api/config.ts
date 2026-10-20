// Backend configuration. Release builds must never use mock data or plaintext HTTP.
// Development builds may use an emulator's local HTTP endpoint.
const PROD_URL = 'https://clear.rupertbulquerin.com/api/mobile';
// Integration branch safety gate: payment writes must not be enabled until
// the canonical web transaction service has been ported and verified.
export const PAYMENT_WRITES_ENABLED = false;
const DEV_URL = 'http://localhost:3000/api/mobile';

const configuredMode = process.env.EXPO_PUBLIC_API_MODE;
const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
const apiUrl = (configuredUrl || (__DEV__ ? DEV_URL : PROD_URL)).replace(/\/+$/, '');

if (!__DEV__) {
  if (configuredMode === 'mock') {
    throw new Error('CLEAR security policy: mock API is prohibited in release builds.');
  }
  if (!/^https:\/\/[^\s/?#]+(?:\/|$)/i.test(apiUrl)) {
    throw new Error('CLEAR security policy: release API endpoint must use HTTPS.');
  }
}

export const API_MODE: 'http' | 'mock' = __DEV__ && configuredMode === 'mock' ? 'mock' : 'http';
export const API_URL = apiUrl;
