import { View, Text, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../hooks/useTheme';
import { Theme, hexAlpha } from '../../constants/theme';

type IconKey = 'timer' | 'drop' | 'calendar' | 'person';

const ROUTE_LABEL: Record<string, string> = {
  index: 'Timer',
  water: 'Water',
  history: 'History',
  profile: 'Profile',
};

const ROUTE_ICON: Record<string, IconKey> = {
  index: 'timer',
  water: 'drop',
  history: 'calendar',
  profile: 'person',
};

function Icon({ name, color, active }: { name: IconKey; color: string; active: boolean }) {
  const sw = 1.8;
  const fill = active ? hexAlpha(color, 0x22) : 'none';
  switch (name) {
    case 'timer':
      return (
        <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
          <Circle cx={13} cy={14} r={8.5} stroke={color} strokeWidth={sw} fill={fill} />
          <Path d="M13 9v5l3 2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M10 3h6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'drop':
      return (
        <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
          <Path
            d="M13 3.5c-2 3.5-6.5 8-6.5 12.5a6.5 6.5 0 0013 0C19.5 11.5 15 7 13 3.5z"
            stroke={color}
            strokeWidth={sw}
            fill={fill}
          />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
          <Rect x={4} y={5} width={18} height={17} rx={3} stroke={color} strokeWidth={sw} fill={fill} />
          <Path d="M4 10h18M9 3v4M17 3v4" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'person':
      return (
        <Svg width={26} height={26} viewBox="0 0 26 26" fill="none">
          <Circle cx={13} cy={9} r={4} stroke={color} strokeWidth={sw} fill={fill} />
          <Path
            d="M5 22c1-4 4-6 8-6s7 2 8 6"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            fill={fill}
          />
        </Svg>
      );
  }
}

/** Glass-pill floating tab bar — 68h, 30 radius, blurred translucent bg. */
export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Platform.OS === 'ios' ? 32 : 20,
        height: 68,
        borderRadius: 30,
        overflow: 'hidden',
        shadowColor: '#2A1F14',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: theme.isDark ? 0.4 : 0.08,
        shadowRadius: 32,
        elevation: 12,
      }}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 40 : 0}
        tint={theme.isDark ? 'dark' : 'light'}
        style={{
          flex: 1,
          backgroundColor: Platform.OS === 'ios'
            ? (theme.isDark ? 'rgba(34,26,16,0.55)' : 'rgba(255,255,255,0.55)')
            : (theme.isDark ? 'rgba(34,26,16,0.92)' : 'rgba(255,255,255,0.96)'),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 12,
          borderWidth: 0.5,
          borderColor: theme.hairline,
          borderRadius: 30,
        }}
      >
        {state.routes.map((route, idx) => {
          const focused = state.index === idx;
          const icon = ROUTE_ICON[route.name];
          const label = ROUTE_LABEL[route.name];
          if (!icon || !label) return null;

          const color = focused ? theme.primary : theme.textFaint;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  Haptics.selectionAsync();
                  navigation.navigate(route.name);
                }
              }}
              style={{ flex: 1, alignItems: 'center', gap: 2 }}
            >
              <Icon name={icon} color={color} active={focused} />
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color,
                  letterSpacing: 0.1,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

/** Fixed height used by screens for bottom-padding content beneath the floating bar. */
export const TAB_BAR_HEIGHT = 68 + 32 + 8; // bar + bottom inset + breathing room
