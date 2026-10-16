// The single entry point screens import. EXPO_PUBLIC_API_MODE picks the
// backend (see config.ts); both implement the same ClearApi contract.
import { API_MODE } from './config';
import { httpApi } from './http';
import { mockApi } from './mock';
import type { ClearApi } from './types';

export const api: ClearApi = API_MODE === 'mock' ? mockApi : httpApi;
export { DEMO_OTP } from './mock';
export { setUnauthorizedHandler } from './http';
export { API_MODE, API_URL } from './config';
export * from './types';
