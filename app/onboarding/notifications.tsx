import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { useUserStore } from '../../stores/userStore';
import { Card, PrimaryButton, Toggle } from '../../components/ui';
import type { NotificationPrefs } from '../../stores/userStore';

type PrefKey = keyof NotificationPrefs;

interface Row {
  key: PrefKey;
  title: string;
  desc: string;
}

const ROWS: Row[] = [
  {
    key: 'phaseTransitions',
    title: 'Phase transitions',
    desc: 'A soft note when your body shifts to fat-burning, autophagy, or deep fast.',
  },
  {
    key: 'hydration',
    title: 'Hydration nudges',
    desc: 'Three gentle reminders during your fasting window.',
  },
  {
    key: 'halfway',
    title: 'Halfway cheer',
    desc: 'A quiet check-in at the midpoint.',
  },
  {
    key: 'complete',
    title: 'Fast complete',
    desc: "Celebrate when you've reached your target.",
  },
];

export default function OnboardingNotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = useUserStore(s => s.notificationPrefs);
  const setPrefs = useUserStore(s => s.setNotificationPrefs);

  async function handleEnable() {
    if (Platform.OS !== 'web') {
      try {
        await Notifications.requestPermissionsAsync();
      } catch (err) {
        console.warn('[Onboarding] Notification permission request failed:', err);
      }
    }
    router.replace('/(tabs)');
  }

  function handleSkip() {
    setPrefs({
      phaseTransitions: false,
      hydration: false,
      halfway: false,
      complete: false,
    });
    router.replace('/(tabs)');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 16 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
          {[1, 2, 3].map(s => (
            <View
              key={s}
              style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.primary }}
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
          Step 3 of 3
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
          A few gentle{'\n'}check-ins.
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
          Calm alerts. Never pushy — turn any off any time.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 22, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        <Card theme={theme} padding={0}>
          {ROWS.map((row, i) => (
            <View
              key={row.key}
              style={{
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                borderBottomWidth: i < ROWS.length - 1 ? 0.5 : 0,
                borderBottomColor: theme.hairline,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.text, letterSpacing: -0.2 }}>
                  {row.title}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 3, lineHeight: 17 }}>
                  {row.desc}
                </Text>
              </View>
              <Toggle
                theme={theme}
                on={prefs[row.key]}
                onChange={v => setPrefs({ [row.key]: v } as Partial<NotificationPrefs>)}
              />
            </View>
          ))}
        </Card>

        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: theme.textFaint,
              letterSpacing: 1,
              textTransform: 'uppercase',
              paddingHorizontal: 4,
              paddingBottom: 8,
            }}
          >
            Preview
          </Text>
          <View
            style={{
              borderRadius: 18,
              overflow: 'hidden',
              shadowColor: '#2A1F14',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: theme.isDark ? 0 : 0.12,
              shadowRadius: 24,
              elevation: 4,
            }}
          >
            <BlurView
              intensity={theme.isDark ? 60 : 40}
              tint={theme.isDark ? 'dark' : 'light'}
              style={{
                padding: 12,
                paddingHorizontal: 14,
                backgroundColor: theme.isDark ? 'rgba(60,50,35,0.55)' : 'rgba(255,255,255,0.65)',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <LinearGradient
                colors={[theme.primary, theme.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>F</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text, letterSpacing: -0.1 }}>
                    FASTLOG
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.textFaint }}>now</Text>
                </View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: theme.text,
                    marginTop: 1,
                    letterSpacing: -0.2,
                  }}
                >
                  You're in the autophagy zone
                </Text>
                <Text style={{ fontSize: 13, color: theme.textMuted, marginTop: 2, lineHeight: 18 }}>
                  Cellular cleanup is active. Stay hydrated — you've got this.
                </Text>
              </View>
            </BlurView>
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16,
          paddingBottom: insets.bottom + 16,
          backgroundColor: theme.bg,
        }}
      >
        <PrimaryButton theme={theme} onPress={handleEnable}>
          Enable notifications
        </PrimaryButton>
        <Pressable onPress={handleSkip} style={{ paddingVertical: 10, alignItems: 'center', marginTop: 2 }}>
          <Text style={{ fontSize: 13, color: theme.textMuted, fontWeight: '500' }}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}
