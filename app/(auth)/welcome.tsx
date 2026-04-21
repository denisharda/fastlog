import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { useUserStore } from '../../stores/userStore';
import { AmbientGlow, PrimaryButton } from '../../components/ui';
import { PHASES, Theme, TABULAR } from '../../constants/theme';

interface Slide {
  key: string;
  title: string;
  body: string;
  illustration: (theme: Theme, width: number) => React.ReactNode;
}

function buildSlides(): Slide[] {
  return [
    {
      key: 'phases',
      title: 'Fasting, phase by phase',
      body: 'Watch your body shift from fed to fat-burning to autophagy — visualized around a single calm ring.',
      illustration: (theme) => <PhaseRingIllustration theme={theme} />,
    },
    {
      key: 'rhythm',
      title: 'See your rhythm',
      body: 'A gentle calendar reveals your patterns — without streak pressure. Every fast counts.',
      illustration: (theme, width) => <WeekIllustration theme={theme} width={width} />,
    },
    {
      key: 'kind',
      title: 'Kind, not pushy',
      body: 'Warm language, quiet alerts, and hydration tips tuned to where you are in your fast.',
      illustration: (theme, width) => <NotificationsIllustration theme={theme} width={width} />,
    },
  ];
}

export default function WelcomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const hasSeenIntro = useUserStore(s => s.hasSeenIntro);
  const setHasSeenIntro = useUserStore(s => s.setHasSeenIntro);

  const slides = useMemo(buildSlides, []);

  useEffect(() => {
    if (hasSeenIntro) router.replace('/(auth)/login');
  }, [hasSeenIntro, router]);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  }

  function next() {
    if (index < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      setHasSeenIntro(true);
      router.replace('/(auth)/login');
    }
  }

  function skip() {
    setHasSeenIntro(true);
    router.replace('/(auth)/register');
  }

  const glowColor = theme.phases[Math.min(index + 2, PHASES.length - 1)];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AmbientGlow
        color={glowColor}
        alpha={theme.isDark ? 0x55 : 0x44}
        width={520}
        height={420}
        top={-160}
      />

      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color: theme.primary,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          FastLog
        </Text>
        <Pressable onPress={skip} hitSlop={8}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textMuted, letterSpacing: -0.1 }}>
            Skip
          </Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={slides}
        keyExtractor={(item) => item.key}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 16,
                paddingTop: 40,
                width,
              }}
            >
              {item.illustration(theme, width - 32)}
            </View>
            <View style={{ paddingHorizontal: 32, paddingBottom: 16 }}>
              <Text
                style={{
                  fontSize: 32,
                  fontWeight: '700',
                  color: theme.text,
                  letterSpacing: -1,
                  lineHeight: 36,
                  textAlign: 'center',
                }}
              >
                {item.title}
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: theme.textMuted,
                  marginTop: 12,
                  lineHeight: 24,
                  letterSpacing: -0.1,
                  textAlign: 'center',
                  maxWidth: 320,
                }}
              >
                {item.body}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Pager dots */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 14,
        }}
      >
        {slides.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 22 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === index ? theme.primary : theme.hairline,
            }}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}>
        <PrimaryButton theme={theme} onPress={next}>
          {index < slides.length - 1 ? 'Continue' : 'Get started'}
        </PrimaryButton>
        {index === slides.length - 1 && (
          <Pressable
            onPress={() => {
              setHasSeenIntro(true);
              router.replace('/(auth)/login');
            }}
            style={{ marginTop: 12, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 14, color: theme.textMuted }}>
              Already have an account?{' '}
              <Text style={{ color: theme.primary, fontWeight: '600' }}>Log in</Text>
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// Illustrations — inline SVG per design spec
// ──────────────────────────────────────────────────────────────

function PhaseRingIllustration({ theme }: { theme: Theme }) {
  const size = 220;
  const r = (size - 20) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {PHASES.map((p, i) => {
          const s = (p.start / 24) * circ;
          const e = (p.end / 24) * circ;
          const len = Math.max(0, e - s - 3);
          return (
            <Circle
              key={i}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={theme.phases[i]}
              strokeWidth={20}
              strokeDasharray={`${len} ${circ}`}
              strokeDashoffset={-s - 1.5}
              transform={`rotate(-90 ${c} ${c})`}
            />
          );
        })}
      </Svg>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: theme.textFaint,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Now
        </Text>
        <Text
          style={{
            fontSize: 34,
            fontWeight: '300',
            color: theme.text,
            letterSpacing: -1,
            marginTop: 2,
            ...TABULAR,
          }}
        >
          14:23
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: theme.phases[3],
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginTop: 4,
          }}
        >
          Fat-burning peak
        </Text>
      </View>
    </View>
  );
}

function WeekIllustration({ theme, width }: { theme: Theme; width: number }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const rings = [1, 0.9, 0.75, 1, 1, 0.4, 0.85];
  return (
    <View
      style={{
        width,
        backgroundColor: theme.surface,
        borderRadius: 26,
        padding: 20,
        shadowColor: '#2A1F14',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: theme.isDark ? 0 : 0.08,
        shadowRadius: 30,
        borderWidth: theme.isDark ? 0.5 : 0,
        borderColor: theme.hairline,
        elevation: 8,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, letterSpacing: -0.2 }}>
          This week
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: theme.primary,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          6 / 7
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((d, i) => (
          <View key={i} style={{ alignItems: 'center', flex: 1 }}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: theme.textFaint,
                marginBottom: 6,
                letterSpacing: 0.5,
              }}
            >
              {d}
            </Text>
            <View style={{ width: 32, height: 32 }}>
              <Svg width={32} height={32} viewBox="0 0 32 32">
                <Circle cx={16} cy={16} r={13} fill="none" stroke={theme.hairline} strokeWidth={2.5} />
                <Circle
                  cx={16}
                  cy={16}
                  r={13}
                  fill="none"
                  stroke={rings[i] >= 1 ? theme.primary : theme.accent}
                  strokeWidth={2.5}
                  strokeDasharray={`${rings[i] * 82} 82`}
                  strokeLinecap="round"
                  transform="rotate(-90 16 16)"
                />
                {i === days.length - 1 && <Circle cx={16} cy={16} r={3} fill={theme.primary} />}
              </Svg>
            </View>
          </View>
        ))}
      </View>
      <View style={{ height: 0.5, backgroundColor: theme.hairline, marginVertical: 14 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {[
          { l: 'Avg fast', v: '15.8h' },
          { l: 'Longest', v: '22h' },
          { l: 'Streak', v: '6' },
        ].map(s => (
          <View key={s.l}>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: theme.textFaint,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              {s.l}
            </Text>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '600',
                color: theme.text,
                letterSpacing: -0.3,
                ...TABULAR,
              }}
            >
              {s.v}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function NotificationsIllustration({ theme, width }: { theme: Theme; width: number }) {
  const cards = [
    {
      t: "You're in deep fat-burn",
      b: 'Energy systems have switched. Feels like focus.',
      c: theme.phases[3],
    },
    {
      t: 'Autophagy zone engaged',
      b: 'Cellular cleanup is underway — stay hydrated.',
      c: theme.phases[4],
    },
    {
      t: 'Beautifully done',
      b: '16h 23m — every phase reached.',
      c: theme.primary,
    },
  ];
  return (
    <View style={{ width, gap: 10 }}>
      {cards.map((n, i) => (
        <View
          key={i}
          style={{
            alignSelf: 'stretch',
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 16,
            backgroundColor: theme.surface,
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: i === 1 ? 12 : 0,
            marginRight: 0,
            shadowColor: '#2A1F14',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: theme.isDark ? 0 : 0.05,
            shadowRadius: 8,
            elevation: 4,
            borderWidth: theme.isDark ? 0.5 : 0,
            borderColor: theme.hairline,
          }}
        >
          <View
            style={{
              width: 8,
              height: 40,
              borderRadius: 4,
              backgroundColor: n.c,
              marginRight: 12,
              flexShrink: 0,
            }}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: theme.text,
                letterSpacing: -0.2,
              }}
            >
              {n.t}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 11,
                color: theme.textMuted,
                marginTop: 2,
                lineHeight: 15,
              }}
            >
              {n.b}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
