import { useRef } from 'react';
import { Animated, View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Theme, hexAlpha } from '../../constants/theme';

export interface PillItem<V extends string> {
  value: V;
  label: string;
  badge?: string;
}

interface PillRowProps<V extends string> {
  theme: Theme;
  items: PillItem<V>[];
  value: V;
  onChange: (value: V) => void;
}

/** Centered pill chip row (protocol selection). Fixed 4 items fit on every device. */
export function PillRow<V extends string>({ theme, items, value, onChange }: PillRowProps<V>) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
      }}
    >
      {items.map(it => (
        <Pill
          key={it.value}
          theme={theme}
          item={it}
          active={it.value === value}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(it.value);
          }}
        />
      ))}
    </View>
  );
}

interface PillProps<V extends string> {
  theme: Theme;
  item: PillItem<V>;
  active: boolean;
  onPress: () => void;
}

function Pill<V extends string>({ theme, item, active, onPress }: PillProps<V>) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) => {
    Animated.spring(scale, {
      toValue: to,
      speed: 30,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        borderRadius: 999,
        shadowColor: '#2A1F14',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: active ? 0 : theme.isDark ? 0 : 0.04,
        shadowRadius: 2,
        elevation: active ? 0 : 1,
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: active ? theme.text : theme.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          borderWidth: active ? 0 : theme.isDark ? 1 : 0,
          borderColor: theme.hairline,
        }}
      >
        <Text
          style={{
            color: active ? theme.bg : theme.textMuted,
            fontSize: 14,
            fontWeight: '600',
            letterSpacing: -0.1,
          }}
        >
          {item.label}
        </Text>
        {item.badge && (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: active ? hexAlpha(theme.bg, 0x33) : hexAlpha(theme.accent, 0x22),
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                letterSpacing: 0.3,
                color: active ? theme.bg : theme.accent,
              }}
            >
              {item.badge}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}
