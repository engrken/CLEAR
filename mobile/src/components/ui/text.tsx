import { Text as RNText, type TextProps } from 'react-native';

import { type, useTheme, type ColorTokens, type TypeStyle } from '@/theme';

type Props = TextProps & {
  variant?: TypeStyle;
  color?: keyof ColorTokens;
};

/** Text set in a design-system type style and colour token. */
export function Text({ variant = 'body', color = 'ink', style, ...rest }: Props) {
  const { c } = useTheme();
  return <RNText {...rest} style={[type[variant], { color: c[color] }, style]} />;
}
