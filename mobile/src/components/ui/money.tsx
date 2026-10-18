import { formatPeso } from '@/lib/money';
import type { ColorTokens } from '@/theme';
import { Text } from './text';

type Props = {
  value: number;
  size?: 'xl' | 'md' | 'sm';
  tone?: 'default' | 'success' | 'danger' | 'struck';
  sign?: boolean;
};

const VARIANT = { xl: 'figureXl', md: 'figure', sm: 'figureSm' } as const;
const COLOR: Record<NonNullable<Props['tone']>, keyof ColorTokens> = {
  default: 'ink', success: 'successInk', danger: 'dangerInk', struck: 'inkMuted',
};

/** A peso amount in tabular mono figures. */
export function Money({ value, size = 'md', tone = 'default', sign }: Props) {
  return (
    <Text
      variant={VARIANT[size]}
      color={COLOR[tone]}
      numberOfLines={1}
      style={tone === 'struck' ? { textDecorationLine: 'line-through' } : undefined}>
      {formatPeso(value, { sign })}
    </Text>
  );
}
