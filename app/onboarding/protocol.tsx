import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../lib/supabase';
import { DEFAULT_PROTOCOL } from '../../constants/protocols';
import { FastingProtocol } from '../../types';
import { PrimaryButton } from '../../components/ui';
import { hexAlpha, TABULAR } from '../../constants/theme';

interface ProtocolOption {
  key: FastingProtocol;
  label: string;
  fast: string;
  eat: string;
  desc: string;
  popular?: boolean;
  fastFlex: number;
  eatFlex: number;
}

const OPTIONS: ProtocolOption[] = [
  {
    key: '16:8',
    label: '16:8',
    fast: '16h fast',
    eat: '8h eating window',
    desc: 'The classic. Most people start here — skip breakfast, lunch at noon.',
    popular: true,
    fastFlex: 16,
    eatFlex: 8,
  },
  {
    key: '18:6',
    label: '18:6',
    fast: '18h fast',
    eat: '6h eating window',
    desc: "A bit deeper. You'll reach autophagy most days.",
    fastFlex: 18,
    eatFlex: 6,
  },
  {
    key: '24h',
    label: '24h · OMAD',
    fast: '23h fast',
    eat: '1h eating window',
    desc: 'One meal a day. Experienced fasters only.',
    fastFlex: 23,
    eatFlex: 1,
  },
];

export default function OnboardingProtocolScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useUserStore(s => s.profile);
  const setPreferredProtocol = useUserStore(s => s.setPreferredProtocol);
  const [selected, setSelected] = useState<FastingProtocol>(DEFAULT_PROTOCOL);

  async function handleContinue() {
    if (profile) {
      setPreferredProtocol(selected);
      supabase
        .from('profiles')
        .update({ preferred_protocol: selected })
        .eq('id', profile.id)
        .then(({ error }) => {
          if (error) console.error('[Onboarding] Protocol save failed:', error);
        });
    }
    router.push('/onboarding/goal');
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
                backgroundColor: s === 1 ? theme.primary : theme.hairline,
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
          Step 1 of 3
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
          Pick a fasting{'\n'}protocol
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
          You can change this any time.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 22, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {OPTIONS.map(option => {
          const isSel = option.key === selected;
          return (
            <Pressable
              key={option.key}
              onPress={() => setSelected(option.key)}
              style={{
                padding: 18,
                marginBottom: 10,
                borderRadius: 22,
                backgroundColor: theme.surface,
                borderWidth: 2,
                borderColor: isSel ? theme.primary : theme.hairline,
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isSel ? 0.13 : 0,
                shadowRadius: 24,
                elevation: isSel ? 6 : 0,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Text
                  style={{
                    fontSize: 26,
                    fontWeight: '700',
                    color: theme.text,
                    letterSpacing: -0.8,
                    ...TABULAR,
                  }}
                >
                  {option.label}
                </Text>
                {option.popular && (
                  <View
                    style={{
                      marginLeft: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor: hexAlpha(theme.primary, 0x22),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: theme.primary,
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                      }}
                    >
                      Popular
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }} />
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
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
              </View>

              {/* Split ratio visual */}
              <View
                style={{
                  flexDirection: 'row',
                  height: 8,
                  borderRadius: 4,
                  overflow: 'hidden',
                  backgroundColor: theme.hairline,
                  marginBottom: 10,
                }}
              >
                <View style={{ flex: option.fastFlex, backgroundColor: theme.primary }} />
                <View style={{ flex: option.eatFlex, backgroundColor: theme.accent }} />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary }} />
                  <Text
                    style={{ fontSize: 12, fontWeight: '600', color: theme.textMuted, letterSpacing: -0.1 }}
                  >
                    {option.fast}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent }} />
                  <Text
                    style={{ fontSize: 12, fontWeight: '600', color: theme.textMuted, letterSpacing: -0.1 }}
                  >
                    {option.eat}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  fontSize: 13,
                  color: theme.textMuted,
                  lineHeight: 19,
                  letterSpacing: -0.1,
                }}
              >
                {option.desc}
              </Text>
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
        }}
      >
        <PrimaryButton theme={theme} onPress={handleContinue}>
          Continue
        </PrimaryButton>
      </LinearGradient>
    </View>
  );
}
