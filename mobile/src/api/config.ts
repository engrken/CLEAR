// Which backend the app talks to. Set in mobile/.env (or the EAS build profile):
//
//   EXPO_PUBLIC_API_MODE=mock                 # offline demo on in-memory data
//   EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/mobile   # Android emulator -> host dev server
//
// Defaults: the local web app in development, production otherwise.

const PROD_URL = 'https://clear.rupertbulquerin.com/api/mobile';
const DEV_URL = 'http://localhost:3000/api/mobile';

export const API_MODE: 'http' | 'mock' = process.env.EXPO_PUBLIC_API_MODE === 'mock' ? 'mock' : 'http';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? DEV_URL : PROD_URL)).replace(/\/+$/, '');
