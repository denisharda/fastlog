import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, LayoutAnimation, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';
import { useHydration } from '../../hooks/useHydration';
import { useFasting } from '../../hooks/useFasting';
import { FullScreenWave } from '../../components/water/FullScreenWave';
import { WaterPercentCircle } from '../../components/water/WaterPercentCircle';
import { QuickTapRow } from '../../components/water/QuickTapRow';
import { InlineStepper } from '../../components/water/InlineStepper';
import { GoalCelebration } from '../../components/water/GoalCelebration';
import { PHASE_HYDRATION_TIPS } from '../../constants/hydration';

export default function WaterScreen() {
  const { width, height } = useWindowDimensions();
  const [stepperVisible, setStepperVisible] = useState(false);

  const {
    todayTotalMl,
    dailyGoalMl,
    progressRatio,
    logWater,
    undoLastLog,
    lastLoggedAt,
    snackbar,
    dismissSnackbar,
  } = useHydration();

  const { isActive, currentPhase, elapsedHours } = useFasting();

  const remainingMl = Math.max(dailyGoalMl - todayTotalMl, 0);

  // Track goal celebration — only show once per crossing
  const [showCelebration, setShowCelebration] = useState(false);
  const prevRatio = useRef(progressRatio);
  useEffect(() => {
    if (prevRatio.current < 1 && progressRatio >= 1) {
      setShowCelebration(true);
    }
    prevRatio.current = progressRatio;
  }, [progressRatio]);

  const handleToggleMore = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepperVisible((prev) => !prev);
  }, []);

  const handleCollapse = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepperVisible(false);
  }, []);

  const phaseTip = isActive
    ? PHASE_HYDRATION_TIPS[currentPhase.name] ?? null
    : null;

  return (
    <SafeAreaView edges={{ bottom: true }} style={{ flex: 1 }} className="bg-background">
      <FullScreenWave progress={progressRatio} width={width} height={height} />

      <View className="flex-1 justify-between pt-6 px-6 pb-2">
        {/* Header */}
        <View>
          <Text className="text-text-primary text-2xl font-bold">Hydration</Text>
          {phaseTip && (
            <Text className="text-primary/80 text-xs font-medium mt-1">
              {phaseTip}
            </Text>
          )}
        </View>

        {/* Center circle */}
        <View className="items-center">
          <WaterPercentCircle
            progressRatio={progressRatio}
            remainingMl={remainingMl}
            todayTotalMl={todayTotalMl}
            dailyGoalMl={dailyGoalMl}
            lastLoggedAt={lastLoggedAt}
          />
        </View>

        {/* Bottom section */}
        <View>
          {/* Status text / inline undo feedback */}
          <View className="h-6 mb-3 justify-center">
            {snackbar.visible ? (
              <View className="flex-row items-center justify-center">
                <Text className="text-accent text-sm font-medium">
                  {snackbar.message}
                </Text>
                {snackbar.lastLog && (
                  <Pressable
                    onPress={() => {
                      undoLastLog();
                      dismissSnackbar();
                    }}
                    className="ml-2 px-2 py-0.5 rounded-md bg-white/10"
                    accessibilityLabel="Undo last water log"
                    accessibilityRole="button"
                  >
                    <Text className="text-text-muted text-xs font-semibold">Undo</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text className="text-text-muted text-center text-sm">
                {Math.round(progressRatio * 100)}% of daily goal
              </Text>
            )}
          </View>

          {/* Quick-tap row */}
          <QuickTapRow
            onQuickAdd={logWater}
            onToggleMore={handleToggleMore}
            moreExpanded={stepperVisible}
          />

          {/* Custom amount input */}
          <InlineStepper
            visible={stepperVisible}
            onAdd={logWater}
            onCollapse={handleCollapse}
          />
        </View>
      </View>

      <GoalCelebration visible={showCelebration} />
    </SafeAreaView>
  );
}
