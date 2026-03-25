import { useState, useCallback } from 'react';
import { View, Text, LayoutAnimation, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHydration } from '../../hooks/useHydration';
import { FullScreenWave } from '../../components/water/FullScreenWave';
import { WaterPercentCircle } from '../../components/water/WaterPercentCircle';
import { QuickTapRow } from '../../components/water/QuickTapRow';
import { InlineStepper } from '../../components/water/InlineStepper';
import { UndoSnackbar } from '../../components/water/UndoSnackbar';

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

  const remainingMl = Math.max(dailyGoalMl - todayTotalMl, 0);

  const handleToggleMore = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepperVisible((prev) => !prev);
  }, []);

  const handleCollapse = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepperVisible(false);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <FullScreenWave progress={progressRatio} width={width} height={height} />

      <View className="flex-1 justify-between py-8 px-6">
        {/* Header */}
        <Text className="text-text-primary text-2xl font-bold">Hydration</Text>

        {/* Center circle */}
        <View className="flex-1 justify-center items-center">
          <WaterPercentCircle
            progressRatio={progressRatio}
            remainingMl={remainingMl}
          />
        </View>

        {/* Status text */}
        <Text className="text-text-muted text-center text-sm mb-3">
          {todayTotalMl} <Text className="text-text-muted/40">/</Text> {dailyGoalMl} ml
        </Text>

        {/* Quick-tap row */}
        <QuickTapRow
          onQuickAdd={logWater}
          onToggleMore={handleToggleMore}
          moreExpanded={stepperVisible}
        />

        {/* Inline stepper */}
        <InlineStepper
          visible={stepperVisible}
          onAdd={logWater}
          onCollapse={handleCollapse}
        />
      </View>

      <UndoSnackbar
        message={snackbar.message}
        visible={snackbar.visible}
        onUndo={undoLastLog}
        onDismiss={dismissSnackbar}
      />
    </SafeAreaView>
  );
}
