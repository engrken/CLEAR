// The Android integration build exclusively uses the real, authenticated API.
// Mock backend selection is disabled to prevent test data in financial workflows.
import { httpApi } from './http';
import type { ClearApi } from './types';

export const api: ClearApi = httpApi;
export const DEMO_OTP = '';
export { setUnauthorizedHandler } from './http';
export { API_MODE, API_URL } from './config';
export * from './types';
