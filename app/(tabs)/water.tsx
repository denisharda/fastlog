import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useHydration } from '../../hooks/useHydration';
import { useFasting } from '../../hooks/useFasting';
import { WaterFillCircle } from '../../components/water/WaterFillCircle';
import { CustomAmountSheet } from '../../components/water/CustomAmountSheet';
import { PHASE_HYDRATION_TIPS } from '../../constants/hydration';

export default function WaterScreen() {
  const {
    todayTotalMl,
    dailyGoalMl,
    progressRatio,
    logWater,
    removeLog,
    undoLastLog,
    lastLoggedAt,
    todayLogs,
    snackbar,
    dismissSnackbar,
  } = useHydration();

  const { isActive, currentPhase } = useFasting();

  const remainingMl = Math.max(dailyGoalMl - todayTotalMl, 0);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Goal celebration: notification + haptic when crossing 100%
  const prevRatio = useRef(progressRatio);
  useEffect(() => {
    if (prevRatio.current < 1 && progressRatio >= 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Goal Reached!',
          body: `You've had ${todayTotalMl}ml today`,
        },
        trigger: null,
      });
    }
    prevRatio.current = progressRatio;
  }, [progressRatio, todayTotalMl]);

  // Auto-dismiss snackbar
  useEffect(() => {
    if (!snackbar.visible) return;
    const timer = setTimeout(dismissSnackbar, 4000);
    return () => clearTimeout(timer);
  }, [snackbar.visible, dismissSnackbar]);

  const handleQuickAdd = useCallback(
    (amount: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      logWater(amount);
    },
    [logWater]
  );

  const handleCustomAdd = useCallback(
    (amount: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      logWater(amount);
    },
    [logWater]
  );

  const phaseTip = isActive
    ? PHASE_HYDRATION_TIPS[currentPhase.name] ?? null
    : null;

  return (
    <SafeAreaView edges={{ top: true, bottom: true }} style={{ flex: 1 }} className="bg-background">
      <View className="flex-1 px-6 pb-2">
        {/* Header — top left */}
        <View className="pt-2">
          <Text className="text-text-primary text-2xl font-bold">Hydration</Text>
          {phaseTip && (
            <Text className="text-primary/80 text-xs font-medium mt-1">{phaseTip}</Text>
          )}
        </View>

        {/* Centered content */}
        <View className="flex-1 justify-center items-center">
          {/* Hero circle */}
          <WaterFillCircle
            progressRatio={progressRatio}
            todayTotalMl={todayTotalMl}
            dailyGoalMl={dailyGoalMl}
            remainingMl={remainingMl}
            lastLoggedAt={lastLoggedAt}
          />

          {/* Today's log */}
          {todayLogs.length > 0 && (
            <View className="w-full mt-4" style={{ maxHeight: 160 }}>
              <Text className="text-text-muted text-xs font-medium mb-2">Today</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {[...todayLogs].reverse().map((log) => (
                  <View
                    key={log.id}
                    className="flex-row items-center justify-between py-2 border-b border-gray-100"
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-text-primary text-sm font-semibold">
                        +{log.amount_ml}ml
                      </Text>
                      <Text className="text-text-muted text-xs">
                        {new Date(log.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeLog(log.id)}
                      className="px-2 py-1"
                      hitSlop={8}
                    >
                      <Text className="text-red-400 text-xs font-medium">Delete</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Snackbar */}
          <View className="h-6 mt-4 mb-3 justify-center">
            {snackbar.visible ? (
              <View className="flex-row items-center justify-center">
                <Text className="text-accent text-sm font-medium">{snackbar.message}</Text>
                {snackbar.lastLog && (
                  <Pressable
                    onPress={() => { undoLastLog(); dismissSnackbar(); }}
                    className="ml-2 px-2 py-0.5 rounded-md bg-primary/10"
                  >
                    <Text className="text-primary text-xs font-semibold">Undo</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text className="text-text-muted text-center text-sm">
                {progressRatio === 0 ? 'Tap below to start hydrating!' : `${Math.round(progressRatio * 100)}% of daily goal`}
              </Text>
            )}
          </View>

          {/* Pill buttons */}
          <View className="flex-row gap-3 mb-2">
            <Pressable
              className="h-12 px-8 rounded-full bg-primary items-center justify-center active:scale-95"
              style={{ shadowColor: '#2D6A4F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 }}
              onPress={() => handleQuickAdd(250)}
              onLongPress={() => setSheetVisible(true)}
              delayLongPress={400}
            >
              <Text className="text-white font-bold text-[15px]">+ 250ml</Text>
            </Pressable>
            <Pressable
              className="h-12 px-8 rounded-full bg-white border-[1.5px] border-gray-200 items-center justify-center active:scale-95"
              onPress={() => handleQuickAdd(500)}
              onLongPress={() => setSheetVisible(true)}
              delayLongPress={400}
            >
              <Text className="text-text-primary font-bold text-[15px]">+ 500ml</Text>
            </Pressable>
          </View>
          <Text className="text-text-muted text-[10px] text-center mt-2">Hold to add a custom amount</Text>
        </View>
      </View>

      <CustomAmountSheet
        visible={sheetVisible}
        onAdd={handleCustomAdd}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
}
