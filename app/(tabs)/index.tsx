import { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, Keyboard, TouchableWithoutFeedback, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useFasting } from '../../hooks/useFasting';
import { FastingRing } from '../../components/timer/FastingRing';
import { PhaseLabel } from '../../components/timer/PhaseLabel';
import { PhasesDrawer } from '../../components/timer/PhasesDrawer';
import { useUserStore } from '../../stores/userStore';
import { FastingProtocol } from '../../types';
import { CUSTOM_PROTOCOL_MIN_HOURS, CUSTOM_PROTOCOL_MAX_HOURS } from '../../constants/protocols';

const FASTING_OPTIONS = [
  { hours: 16, label: '16:8', protocol: '16:8' as FastingProtocol },
  { hours: 18, label: '18:6', protocol: '18:6' as FastingProtocol },
  { hours: 24, label: '24h', protocol: '24h' as FastingProtocol },
];

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TimerScreen() {
  const router = useRouter();
  const profile = useUserStore(s => s.profile);
  const isPro = useUserStore(s => s.isPro);
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

  const [selectedHours, setSelectedHours] = useState(16);
  const [isCustom, setIsCustom] = useState(false);
  const [customHours, setCustomHours] = useState(CUSTOM_PROTOCOL_MIN_HOURS);
  const [showPhases, setShowPhases] = useState(false);

  const handleStart = useCallback(async () => {
    if (isCustom) {
      await startFast('custom' as FastingProtocol, customHours);
    } else {
      const option = FASTING_OPTIONS.find((o) => o.hours === selectedHours) ?? FASTING_OPTIONS[0];
      await startFast(option.protocol, option.hours);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [isCustom, customHours, selectedHours, startFast]);

  const handleStop = useCallback(() => {
    if (progressRatio >= 0.9) {
      // Near complete — confirm completion
      Alert.alert(
        'Complete Fast?',
        'Great job! Ready to finish this fast?',
        [
          { text: 'Keep Going', style: 'cancel' },
          {
            text: 'Complete',
            onPress: () => {
              stopFast(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'End Fast Early?',
        'Are you sure you want to stop your fast? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Fast',
            style: 'destructive',
            onPress: () => {
              stopFast(false);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            },
          },
        ]
      );
    }
  }, [stopFast, progressRatio]);


  function handleCustomPress() {
    if (!isPro) {
      router.push('/paywall');
      return;
    }
    setIsCustom(true);
  }

  const handleProtocolSelect = useCallback((hours: number) => {
    setIsCustom(false);
    setSelectedHours(hours);
    Haptics.selectionAsync();
  }, []);

  const { top } = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: top + 16, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="w-full">
          <Text className="text-text-primary text-2xl font-bold">
            {isActive ? 'Fasting' : 'Ready to Fast'}
          </Text>
          {isActive && (
            <Text className="text-text-muted text-sm mt-1">
              Goal: {targetHours}h fast
            </Text>
          )}
        </View>

        {/* Ring + phase */}
        <View className="items-center my-6">
          <FastingRing
            progress={progressRatio}
            size={300}
            strokeWidth={16}
            onPress={isActive ? handleStop : handleStart}
          >
            <View className="items-center">
              <Text
                className="text-text-primary text-4xl font-bold"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatDuration(elapsedSeconds)}
              </Text>
              {isActive ? (
                <Text className="text-text-muted text-sm mt-2">
                  {elapsedHours.toFixed(1)}h / {targetHours}h
                </Text>
              ) : (
                <Text className="text-text-muted text-sm mt-2">
                  {isCustom ? customHours : selectedHours}h fast
                </Text>
              )}
              <Text className={`text-sm font-semibold mt-3 ${isActive ? 'text-red-500' : 'text-primary'}`}>
                {isActive ? (progressRatio >= 0.9 ? 'Tap to Complete' : 'Tap to Stop') : 'Tap to Start'}
              </Text>
            </View>
          </FastingRing>

          <PhaseLabel phase={currentPhase} visible={isActive} onPress={() => setShowPhases(true)} />
        </View>

        {/* Info cards when fasting */}
        {isActive && (
          <View className="flex-row gap-3 w-full mb-4">
            <View className="flex-1 bg-white rounded-2xl p-4" style={cardShadow}>
              <Text className="text-text-muted text-xs mb-1">Current Phase</Text>
              <Text className="text-text-primary text-lg font-bold">{currentPhase.name}</Text>
              <Text className="text-text-muted text-xs mt-1">{currentPhase.description}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4" style={cardShadow}>
              <Text className="text-text-muted text-xs mb-1">Progress</Text>
              <Text className="text-text-primary text-lg font-bold">{(progressRatio * 100).toFixed(0)}%</Text>
              <Text className="text-text-muted text-xs mt-1">{elapsedHours.toFixed(1)}h / {targetHours}h</Text>
            </View>
          </View>
        )}

        {/* Error */}
        {error ? (
          <Text className="text-red-500 text-sm text-center">{error}</Text>
        ) : null}

        {/* Duration picker + Controls */}
        {isLoading ? (
          <ActivityIndicator color="#2D6A4F" size="large" />
        ) : (
          <View className="w-full gap-4">
            {!isActive && (
              <View className="gap-2">
                <Text className="text-text-muted text-sm font-medium">Select duration</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {FASTING_OPTIONS.map((option) => {
                      const isSelected = !isCustom && selectedHours === option.hours;
                      return (
                        <Pressable
                          key={option.hours}
                          className={`px-5 py-3 rounded-xl ${
                            isSelected ? 'bg-primary' : 'bg-white border border-gray-200'
                          }`}
                          style={!isSelected ? cardShadow : undefined}
                          onPress={() => handleProtocolSelect(option.hours)}
                        >
                          <Text
                            className={`font-semibold text-base ${
                              isSelected ? 'text-white' : 'text-text-primary'
                            }`}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      className={`px-5 py-3 rounded-xl ${
                        isCustom ? 'bg-primary' : 'bg-white border border-gray-200'
                      }`}
                      style={!isCustom ? cardShadow : undefined}
                      onPress={handleCustomPress}
                    >
                      <Text
                        className={`font-semibold text-base ${
                          isCustom ? 'text-white' : 'text-text-primary'
                        }`}
                      >
                        {isPro ? 'Custom' : 'Custom (Pro)'}
                      </Text>
                    </Pressable>
                  </View>
                </ScrollView>
                {isCustom && (
                  <View className="flex-row items-center justify-center gap-4 mt-2">
                    <Pressable
                      className="w-12 h-12 rounded-full bg-white border border-gray-200 items-center justify-center"
                      style={cardShadow}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setCustomHours((h) => Math.max(CUSTOM_PROTOCOL_MIN_HOURS, h - 1));
                      }}
                    >
                      <Text className="text-text-primary text-2xl font-medium">−</Text>
                    </Pressable>
                    <View className="bg-white border border-gray-200 rounded-xl px-6 h-12 items-center justify-center" style={cardShadow}>
                      <Text className="text-text-primary text-xl font-semibold">{customHours}h</Text>
                    </View>
                    <Pressable
                      className="w-12 h-12 rounded-full bg-white border border-gray-200 items-center justify-center"
                      style={cardShadow}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setCustomHours((h) => Math.min(CUSTOM_PROTOCOL_MAX_HOURS, h + 1));
                      }}
                    >
                      <Text className="text-text-primary text-2xl font-medium">+</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </TouchableWithoutFeedback>
      <PhasesDrawer
        visible={showPhases}
        onClose={() => setShowPhases(false)}
        currentPhase={isActive ? currentPhase : null}
      />
    </View>
  );
}
