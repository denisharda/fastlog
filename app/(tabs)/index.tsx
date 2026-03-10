import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFasting } from '../../hooks/useFasting';
import { FastingRing } from '../../components/timer/FastingRing';
import { PhaseLabel } from '../../components/timer/PhaseLabel';
import { TimerControls } from '../../components/timer/TimerControls';
import { useUserStore } from '../../stores/userStore';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimerScreen() {
  const { profile } = useUserStore();
  const {
    isActive,
    elapsedSeconds,
    elapsedHours,
    progressRatio,
    currentPhase,
    targetHours,
    startFast,
    stopFast,
    isLoading,
    error,
  } = useFasting();

  const preferredProtocol = profile?.preferred_protocol ?? '16:8';

  async function handleStart() {
    const hours = preferredProtocol === '16:8' ? 16
      : preferredProtocol === '18:6' ? 18
      : preferredProtocol === '24h' ? 24
      : 16;
    await startFast(preferredProtocol as Parameters<typeof startFast>[0], hours);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-between py-8 px-6">
        {/* Header */}
        <View className="w-full">
          <Text className="text-text-primary text-xl font-bold">
            {isActive ? 'Fasting' : 'Ready to Fast'}
          </Text>
          {isActive && (
            <Text className="text-text-muted text-sm mt-1">
              Goal: {targetHours}h fast
            </Text>
          )}
        </View>

        {/* Ring + phase */}
        <View className="items-center">
          <FastingRing
            progress={progressRatio}
            size={280}
            strokeWidth={16}
          >
            <View className="items-center">
              <Text className="text-text-primary text-4xl font-bold tracking-wider">
                {formatDuration(elapsedSeconds)}
              </Text>
              {isActive && (
                <Text className="text-text-muted text-sm mt-1">
                  {(elapsedHours).toFixed(1)}h / {targetHours}h
                </Text>
              )}
            </View>
          </FastingRing>

          <PhaseLabel phase={currentPhase} visible={isActive} />
        </View>

        {/* Error */}
        {error ? (
          <Text className="text-red-400 text-sm text-center">{error}</Text>
        ) : null}

        {/* Controls */}
        {isLoading ? (
          <ActivityIndicator color="#2D6A4F" size="large" />
        ) : (
          <TimerControls
            isActive={isActive}
            onStart={handleStart}
            onStop={() => stopFast(false)}
            onComplete={() => stopFast(true)}
            progressRatio={progressRatio}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
