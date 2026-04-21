import { useState, useCallback, useEffect, useRef } from 'react';
import { Animated, View, Text, Pressable, ScrollView } from 'react-native';
import type { Theme } from '../../constants/theme';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import Svg, { Path, Rect } from 'react-native-svg';
import { useHydration } from '../../hooks/useHydration';
import { useFasting } from '../../hooks/useFasting';
import { useTheme } from '../../hooks/useTheme';
import { Card, CircleIcon, ScreenHeader, WaterRing } from '../../components/ui';
import { CustomAmountSheet } from '../../components/water/CustomAmountSheet';
import { PHASE_HYDRATION_TIPS, labelForWaterAmount } from '../../constants/hydration';
import { TABULAR, hexAlpha } from '../../constants/theme';
import { TAB_BAR_HEIGHT } from '../../components/ui/TabBar';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function WaterScreen() {
  const theme = useTheme();
  const {
    todayTotalMl,
    dailyGoalMl,
    progressRatio,
    logWater,
    removeLog,
    todayLogs,
  } = useHydration();

  const { isActive, currentPhase } = useFasting();
  const [sheetVisible, setSheetVisible] = useState(false);

  // Goal celebration: fire once on crossing 100%.
  const prevRatio = useRef(progressRatio);
  useEffect(() => {
    if (prevRatio.current < 1 && progressRatio >= 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Notifications.scheduleNotificationAsync({
        content: { title: 'Goal Reached!', body: `You've had ${todayTotalMl}ml today` },
        trigger: null,
      });
    }
    prevRatio.current = progressRatio;
  }, [progressRatio, todayTotalMl]);

  const phaseTip = PHASE_HYDRATION_TIPS[currentPhase.name] ?? null;

  const handleQuickAdd = useCallback(
    (amount: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      logWater(amount);
    },
    [logWater],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScreenHeader
        theme={theme}
        title="Water"
        trailing={
          <CircleIcon theme={theme} size={36} onPress={() => setSheetVisible(true)}>
            <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Path d="M8 3v10M3 8h10" stroke={theme.textMuted} strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
          </CircleIcon>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Phase tip */}
        {phaseTip && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                paddingHorizontal: 14,
                borderRadius: 14,
                backgroundColor: hexAlpha(theme.water, theme.isDark ? 0x22 : 0x18),
                borderWidth: 0.5,
                borderColor: hexAlpha(theme.water, 0x33),
              }}
            >
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: theme.water,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                  <Path d="M6 2v5M6 9.5v0.5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text, letterSpacing: -0.2 }}>
                  {currentPhase.name} · {phaseTip.tip}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>
                  {phaseTip.subline}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Water ring */}
        <View style={{ alignItems: 'center', marginTop: 10 }}>
          <View style={{ width: 240, height: 240 }}>
            <WaterRing size={240} pct={progressRatio} theme={theme} />
            <View style={{ position: 'absolute', width: 240, height: 240, alignItems: 'center', justifyContent: 'center' }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: progressRatio > 0.5 ? '#fff' : theme.textMuted,
                }}
              >
                Today
              </Text>
              <Text
                style={{
                  fontSize: 44,
                  fontWeight: '300',
                  letterSpacing: -1,
                  lineHeight: 48,
                  color: progressRatio > 0.5 ? '#fff' : theme.text,
                  ...TABULAR,
                }}
              >
                {todayTotalMl.toLocaleString()}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '500',
                  color: progressRatio > 0.5 ? 'rgba(255,255,255,0.85)' : theme.textMuted,
                  marginTop: 2,
                  ...TABULAR,
                }}
              >
                of {dailyGoalMl.toLocaleString()} ml
              </Text>
            </View>
          </View>
        </View>

        {/* Quick-add */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, flexDirection: 'row', gap: 10 }}>
          {[
            { ml: 250, label: '+250ml', sub: 'Glass' },
            { ml: 500, label: '+500ml', sub: 'Bottle · hold for custom' },
          ].map(btn => (
            <QuickAddButton
              key={btn.ml}
              theme={theme}
              label={btn.label}
              sub={btn.sub}
              onPress={() => handleQuickAdd(btn.ml)}
              onLongPress={() => setSheetVisible(true)}
            />
          ))}
        </View>

        {/* Log */}
        <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: 1,
              color: theme.textFaint,
              textTransform: 'uppercase',
              paddingVertical: 8,
              paddingHorizontal: 4,
            }}
          >
            Today's Log
          </Text>
          {todayLogs.length === 0 ? (
            <Card theme={theme} padding={16}>
              <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
                No water logged yet today.
              </Text>
            </Card>
          ) : (
            <Card theme={theme} padding={0}>
              {[...todayLogs].reverse().map((log, i, arr) => (
                <View
                  key={log.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    paddingHorizontal: 14,
                    borderBottomWidth: i < arr.length - 1 ? 0.5 : 0,
                    borderBottomColor: theme.hairline,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.water, marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: theme.text,
                        letterSpacing: -0.2,
                      }}
                    >
                      <Text style={TABULAR}>{log.amount_ml} ml</Text>
                      <Text style={{ color: theme.textFaint, fontWeight: '500' }}>
                        {'  ·  '}
                        {labelForWaterAmount(log.amount_ml)}
                      </Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: theme.textFaint, marginTop: 1, ...TABULAR }}>
                      {formatTime(log.logged_at)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => removeLog(log.id)}
                    hitSlop={8}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: theme.surface2,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Svg width={12} height={2} viewBox="0 0 12 2">
                      <Rect width={12} height={2} rx={1} fill={theme.textFaint} />
                    </Svg>
                  </Pressable>
                </View>
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <CustomAmountSheet
        visible={sheetVisible}
        onAdd={(amount) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          logWater(amount);
        }}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

interface QuickAddButtonProps {
  theme: Theme;
  label: string;
  sub: string;
  onPress: () => void;
  onLongPress: () => void;
}

function QuickAddButton({ theme, label, sub, onPress, onLongPress }: QuickAddButtonProps) {
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
        flex: 1,
        transform: [{ scale }],
        borderRadius: 18,
        shadowColor: '#2A1F14',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: theme.isDark ? 0 : 0.04,
        shadowRadius: 8,
        elevation: theme.isDark ? 0 : 2,
      }}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={{
          padding: 14,
          borderRadius: 18,
          backgroundColor: theme.surface,
          borderWidth: theme.isDark ? 0.5 : 0,
          borderColor: theme.hairline,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '600', color: theme.water, letterSpacing: -0.3, ...TABULAR }}>
          {label}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '500',
            color: theme.textFaint,
            marginTop: 2,
            letterSpacing: 0.1,
          }}
        >
          {sub}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
