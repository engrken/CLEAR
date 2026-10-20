import * as WebBrowser from 'expo-web-browser';

// Public pages on the web app. Always production: the policy is the same for every build.
const WEB_URL = 'https://clear.rupertbulquerin.com';

export const PRIVACY_URL = `${WEB_URL}/privacy`;
export const ACCOUNT_DELETION_URL = `${WEB_URL}/account-deletion`;

/** Open a web page in the in-app browser tab. */
export function openWebPage(url: string) {
  return WebBrowser.openBrowserAsync(url);
}
