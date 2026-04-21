import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

interface AmbientGlowProps {
  /** Hex color for the orb center. */
  color: string;
  /** Center-stop alpha 0-255; default 68 (0x44) light / 85 (0x55) dark. */
  alpha?: number;
  /** Width of the glow box. */
  width?: number;
  /** Height of the glow box. */
  height?: number;
  /** Absolute top position (can be negative). */
  top?: number;
  /** Absolute left position (pass 'center' or px). */
  left?: number | 'center';
  /** Pointer events — default 'none'. */
  pointerEvents?: 'none' | 'auto';
}

/**
 * Soft radial glow orb. SVG-based so it renders consistently on iOS.
 * Positioned absolutely — parent must have relative/overflow: hidden.
 */
export function AmbientGlow({
  color,
  alpha = 0x44,
  width = 520,
  height = 520,
  top = -120,
  left = 'center',
  pointerEvents = 'none',
}: AmbientGlowProps) {
  const rightEdge = width;
  const hexAlpha = alpha.toString(16).padStart(2, '0');
  const center = color + hexAlpha;

  return (
    <View
      pointerEvents={pointerEvents}
      style={{
        position: 'absolute',
        top,
        width,
        height,
        ...(left === 'center'
          ? { left: '50%', marginLeft: -width / 2 }
          : { left }),
      }}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <RadialGradient
            id="ambient-glow"
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
            fx="50%"
            fy="50%"
          >
            <Stop offset="0%" stopColor={center} stopOpacity={1} />
            <Stop offset="65%" stopColor={color} stopOpacity={0} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={rightEdge} height={height} fill="url(#ambient-glow)" />
      </Svg>
    </View>
  );
}
