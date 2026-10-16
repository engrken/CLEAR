import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { colors, radius, size, spacing, type, type ColorTokens, type ThemeName } from './tokens';

export { colors, radius, size, spacing, type };
export type { ColorTokens, ThemeName, TypeStyle } from './tokens';

type Theme = { name: ThemeName; c: ColorTokens };

const ThemeContext = createContext<Theme>({ name: 'dark', c: colors.dark });

/** Dark is the default, as on the web app; light follows the device setting. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const name: ThemeName = scheme === 'light' ? 'light' : 'dark';
  return <ThemeContext.Provider value={{ name, c: colors[name] }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
