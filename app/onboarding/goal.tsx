import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../lib/supabase';
import { FastingGoal } from '../../types';
import { PrimaryButton, CircleIcon } from '../../components/ui';
import { hexAlpha, Theme } from '../../constants/theme';

interface GoalOption {
  key: FastingGoal;
  label: string;
  desc: string;
  iconPath: string;
  popular?: boolean;
}

const GOALS: GoalOption[] = [
  {
    key: 'weight',
    label: 'Weight management',
    desc: 'Gentle calorie deficit through a shorter eating window.',
    iconPath:
      'M9 3v3M4 6h10M5 6l-2 7h5l-2-7M13 6l-2 7h5l-2-7',
  },
  {
    key: 'energy',
    label: 'Steady energy',
    desc: 'Smooth out the afternoon slump and mental fog.',
    iconPath:
      'M9 1v4M9 13v4M1 9h4M13 9h4M3.5 3.5l2.8 2.8M11.7 11.7l2.8 2.8M3.5 14.5l2.8-2.8M11.7 6.3l2.8-2.8',
  },
  {
    key: 'longevity',
    label: 'Longevity & repair',
    desc: 'Tap into autophagy and cellular cleanup.',
    iconPath: 'M3 15c0-7 5-12 12-12 0 7-5 12-12 12z M3 15L9 9',
    popular: true,
  },
  {
    key: 'metabolic',
    label: 'Metabolic health',
    desc: 'Improve insulin sensitivity and markers over time.',
    iconPath: 'M9 15s-6-3.5-6-8a3.5 3.5 0 016-2.5A3.5 3.5 0 0115 7c0 4.5-6 8-6 8z',
  },
];

export default function OnboardingGoalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useUserStore(s => s.profile);
  const updateProfile = useUserStore(s => s.updateProfile);
  const [selected, setSelected] = useState<FastingGoal>('longevity');

  async function handleContinue() {
    updateProfile({ goal: selected });
    if (profile) {
      // Best-effort — column may not exist on every deployment.
      supabase
        .from('profiles')
        .update({ goal: selected })
        .eq('id', profile.id)
        .then(({ error }) => {
          if (error) console.warn('[Onboarding] Goal save skipped:', error.message);
        });
    }
    router.push('/onboarding/notifications');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 16 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
          {[1, 2, 3].map(s => (
            <View
              key={s}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: s <= 2 ? theme.primary : theme.hairline,
              }}
            />
          ))}
        </View>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: theme.textFaint,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          Step 2 of 3
        </Text>
        <Text
          style={{
            fontSize: 28,
            fontWeight: '700',
            color: theme.text,
            letterSpacing: -0.8,
            marginTop: 6,
            lineHeight: 32,
          }}
        >
          What brings you{'\n'}to fasting?
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: theme.textMuted,
            marginTop: 8,
            lineHeight: 21,
            letterSpacing: -0.1,
          }}
        >
          We'll tailor tips and language to fit.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 22, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {GOALS.map(g => {
          const isSel = g.key === selected;
          const iconColor = isSel ? theme.primary : theme.textMuted;
          return (
            <Pressable
              key={g.key}
              onPress={() => setSelected(g.key)}
              style={{
                padding: 14,
                paddingHorizontal: 16,
                marginBottom: 10,
                borderRadius: 20,
                backgroundColor: theme.surface,
                borderWidth: 2,
                borderColor: isSel ? theme.primary : theme.hairline,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isSel ? 0.13 : 0,
                shadowRadius: 24,
                elevation: isSel ? 6 : 0,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: isSel ? hexAlpha(theme.primary, 0x22) : theme.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                  <Path
                    d={g.iconPath}
                    stroke={iconColor}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text
                    style={{ fontSize: 15, fontWeight: '600', color: theme.text, letterSpacing: -0.2 }}
                  >
                    {g.label}
                  </Text>
                  {g.popular && (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 5,
                        backgroundColor: hexAlpha(theme.accent, 0x22),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: '700',
                          color: theme.isDark ? theme.accent : '#8A6520',
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        Common
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.textMuted,
                    marginTop: 3,
                    lineHeight: 17,
                  }}
                >
                  {g.desc}
                </Text>
              </View>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: isSel ? theme.primary : theme.hairline,
                  backgroundColor: isSel ? theme.primary : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isSel && (
                  <Svg width={10} height={10} viewBox="0 0 10 10">
                    <Path
                      d="M1 5l3 3 5-6"
                      stroke="#fff"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <LinearGradient
        colors={[hexAlpha(theme.bg, 0x00), hexAlpha(theme.bg, 0xee), theme.bg]}
        locations={[0, 0.4, 1]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16,
          paddingTop: 28,
          paddingBottom: insets.bottom + 16,
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: theme.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: theme.isDark ? 0.5 : 0,
            borderColor: theme.hairline,
          }}
        >
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Path
              d="M10 2L4 8l6 6"
              stroke={theme.textMuted}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <View style={{ flex: 1 }}>
          <PrimaryButton theme={theme} onPress={handleContinue}>
            Continue
          </PrimaryButton>
        </View>
      </LinearGradient>
    </View>
  );
}
