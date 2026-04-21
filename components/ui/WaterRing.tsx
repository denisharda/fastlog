import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Theme } from '../../constants/theme';

interface WaterRingProps {
  size?: number;
  pct: number; // 0-1
  theme: Theme;
}

/**
 * Water ring — circular gradient fill showing daily hydration progress.
 * Two static sine wave paths surface the fill — per design spec, waves do NOT animate.
 */
export function WaterRing({ size = 240, pct, theme }: WaterRingProps) {
  const clamped = Math.max(0, Math.min(1, pct));
  const r = size / 2;
  const fillHeight = size - size * clamped;
  const gradId = `water-grad-${Math.round(size)}`;
  const clipId = `water-clip-${Math.round(size)}`;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <ClipPath id={clipId}>
            <Circle cx={r} cy={r} r={r - 2} />
          </ClipPath>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={theme.waterSoft} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={theme.water} stopOpacity={1} />
          </LinearGradient>
        </Defs>

        {/* Outer ring hairline */}
        <Circle cx={r} cy={r} r={r - 1} fill="none" stroke={theme.hairline} strokeWidth={2} />
        {/* Inner surface tint */}
        <Circle cx={r} cy={r} r={r - 6} fill={theme.surface2} opacity={0.5} />

        <G clipPath={`url(#${clipId})`}>
          <Rect x={0} y={fillHeight} width={size} height={size} fill={`url(#${gradId})`} />
          <Path
            d={`M 0 ${fillHeight} Q ${size * 0.25} ${fillHeight - 8}, ${size * 0.5} ${fillHeight} T ${size} ${fillHeight} L ${size} ${size} L 0 ${size} Z`}
            fill={theme.water}
            opacity={0.85}
          />
          <Path
            d={`M 0 ${fillHeight + 6} Q ${size * 0.25} ${fillHeight - 2}, ${size * 0.5} ${fillHeight + 6} T ${size} ${fillHeight + 6} L ${size} ${size} L 0 ${size} Z`}
            fill={theme.waterSoft}
            opacity={0.6}
          />
        </G>
      </Svg>
    </View>
  );
}
