import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme, type ColorTokens } from '@/theme';
import { iconData, type IconName } from './icon-data';

export type { IconName };

type Props = {
  name: IconName;
  size?: number;
  color?: keyof ColorTokens;
  /** Raw colour, for icons on fills such as accent-fill. */
  tint?: string;
  /** Set when the icon carries meaning without a visible label. */
  label?: string;
};

/** Bootstrap Icons (the web app's set) drawn with react-native-svg. */
export function Icon({ name, size = 24, color = 'ink', tint, label }: Props) {
  const { c } = useTheme();
  // react-native-svg passes props straight to the DOM on web, which only knows aria-*.
  const a11y =
    Platform.OS === 'web'
      ? { 'aria-hidden': !label, 'aria-label': label, role: label ? ('img' as const) : undefined }
      : {
          accessibilityElementsHidden: !label,
          importantForAccessibility: label ? ('yes' as const) : ('no-hide-descendants' as const),
          accessibilityLabel: label,
          accessibilityRole: label ? ('image' as const) : undefined,
        };
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill={tint ?? c[color]} {...a11y}>
      {iconData[name].map((p, i) => (
        <Path key={i} d={p.d} fillRule={'fillRule' in p ? (p.fillRule as 'evenodd') : undefined} />
      ))}
    </Svg>
  );
}
