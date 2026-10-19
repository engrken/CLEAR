import { formatPeso } from '@/lib/money';
import type { ColorTokens } from '@/theme';
import { Text } from './text';

type Props = {
  value: number;
  size?: 'xl' | 'md' | 'sm';
  tone?: 'default' | 'success' | 'danger' | 'struck' | 'inverse';
  sign?: boolean;
  /** Whole pesos (home tiles only); every other amount shows centavos. */
  whole?: boolean;
};

const VARIANT = { xl: 'figureXl', md: 'figure', sm: 'figureSm' } as const;
const COLOR: Record<NonNullable<Props['tone']>, keyof ColorTokens> = {
  default: 'ink', success: 'mintInk', danger: 'coralInk', struck: 'inkMuted', inverse: 'onAccent',
};

/** A peso amount in Bricolage tabular figures. */
export function Money({ value, size = 'md', tone = 'default', sign, whole }: Props) {
  return (
    <Text
      variant={VARIANT[size]}
      color={COLOR[tone]}
      numberOfLines={1}
      adjustsFontSizeToFit={size === 'xl'}
      style={tone === 'struck' ? { textDecorationLine: 'line-through' } : undefined}>
      {formatPeso(value, { sign, whole })}
    </Text>
  );
}
