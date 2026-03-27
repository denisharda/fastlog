import { useState, useCallback } from 'react';
import { View, Text, Pressable, LayoutAnimation, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHydration } from '../../hooks/useHydration';
import { useFasting } from '../../hooks/useFasting';
import { FullScreenWave } from '../../components/water/FullScreenWave';
import { WaterPercentCircle } from '../../components/water/WaterPercentCircle';
import { QuickTapRow } from '../../components/water/QuickTapRow';
import { InlineStepper } from '../../components/water/InlineStepper';

export default function WaterScreen() {
  const { width, height } = useWindowDimensions();
  const [stepperVisible, setStepperVisible] = useState(false);

  const {
    todayTotalMl,
    dailyGoalMl,
    progressRatio,
    logWater,
    undoLastLog,
    snackbar,
    dismissSnackbar,
  } = useHydration();

  const { isActive, currentPhase, elapsedHours } = useFasting();

  const remainingMl = Math.max(dailyGoalMl - todayTotalMl, 0);

  const handleToggleMore = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepperVisible((prev) => !prev);
  }, []);

  const handleCollapse = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepperVisible(false);
  }, []);

  const { top } = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: top }}>
      <FullScreenWave progress={progressRatio} width={width} height={height} />

      <View className="flex-1 justify-between pt-8 pb-36 px-6">
        {/* Header */}
        <Text className="text-text-primary text-2xl font-bold">Hydration</Text>

        {/* Center circle */}
        <View className="flex-1 justify-center items-center">
          <WaterPercentCircle
            progressRatio={progressRatio}
            remainingMl={remainingMl}
          />

          {/* Fasting phase context */}
          {isActive && (
            <Text className="text-text-muted text-xs text-center mt-4 px-8">
              Hour {Math.floor(elapsedHours)} — {currentPhase.name} — stay hydrated
            </Text>
          )}
        </View>

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
              {todayTotalMl} <Text className="text-text-muted/40">/</Text> {dailyGoalMl} ml
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
  );
}
