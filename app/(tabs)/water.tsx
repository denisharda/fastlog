import { useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHydration } from '../../hooks/useHydration';
import { FullScreenWave } from '../../components/water/FullScreenWave';
import { WaterPercentCircle } from '../../components/water/WaterPercentCircle';
import { AddWaterFAB } from '../../components/water/AddWaterFAB';
import { AddWaterSheet } from '../../components/water/AddWaterSheet';
import { WaterStatusBar } from '../../components/water/WaterStatusBar';
import { UndoSnackbar } from '../../components/water/UndoSnackbar';

export default function WaterScreen() {
  const { width, height } = useWindowDimensions();
  const [sheetVisible, setSheetVisible] = useState(false);

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

        {/* Bottom status bar */}
        <WaterStatusBar currentMl={todayTotalMl} goalMl={dailyGoalMl} />
      </View>

      <AddWaterFAB onPress={() => setSheetVisible(true)} />
      <AddWaterSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onAdd={logWater}
      />
      <UndoSnackbar
        message={snackbar.message}
        visible={snackbar.visible}
        onUndo={undoLastLog}
        onDismiss={dismissSnackbar}
      />
    </SafeAreaView>
  );
}
