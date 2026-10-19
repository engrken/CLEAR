import { createContext, useContext, type ReactNode } from 'react';

import { colors, radius, size, spacing, type, type ColorTokens, type ThemeName } from './tokens';

export { colors, radius, size, spacing, type };
export type { ColorTokens, ThemeName, TypeStyle } from './tokens';

type Theme = { name: ThemeName; c: ColorTokens };

const LIGHT: Theme = { name: 'light', c: colors.light };
const ThemeContext = createContext<Theme>(LIGHT);

/** Bright Campus (1.1.0) is light only, whatever the phone's dark-mode setting. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={LIGHT}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
