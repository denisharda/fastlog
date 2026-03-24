import { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView, TextInput, Keyboard, TouchableWithoutFeedback, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useFasting } from '../../hooks/useFasting';
import { FastingRing } from '../../components/timer/FastingRing';
import { PhaseLabel } from '../../components/timer/PhaseLabel';
import { PhasesDrawer } from '../../components/timer/PhasesDrawer';
import { TimerControls } from '../../components/timer/TimerControls';
import { useUserStore } from '../../stores/userStore';
import { FastingProtocol } from '../../types';
import { CUSTOM_PROTOCOL_MIN_HOURS, CUSTOM_PROTOCOL_MAX_HOURS } from '../../constants/protocols';

const FASTING_OPTIONS = [
  { hours: 16, label: '16:8', protocol: '16:8' as FastingProtocol },
  { hours: 18, label: '18:6', protocol: '18:6' as FastingProtocol },
  { hours: 24, label: '24h', protocol: '24h' as FastingProtocol },
];

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
  const [customHoursText, setCustomHoursText] = useState('');
  const [showPhases, setShowPhases] = useState(false);

  const handleStart = useCallback(async () => {
    if (isCustom) {
      const hours = parseInt(customHoursText, 10);
      if (!hours || hours < CUSTOM_PROTOCOL_MIN_HOURS || hours > CUSTOM_PROTOCOL_MAX_HOURS) return;
      await startFast('custom' as FastingProtocol, hours);
    } else {
      const option = FASTING_OPTIONS.find((o) => o.hours === selectedHours) ?? FASTING_OPTIONS[0];
      await startFast(option.protocol, option.hours);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [isCustom, customHoursText, selectedHours, startFast]);

  const handleStop = useCallback(() => {
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
  }, [stopFast]);

  const handleComplete = useCallback(() => {
    stopFast(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [stopFast]);

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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 32 }}
        showsVerticalScrollIndicator={false}
      >
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
        <View className="items-center my-4">
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

          <PhaseLabel phase={currentPhase} visible={isActive} onPress={() => setShowPhases(true)} />
        </View>

        {/* Error */}
        {error ? (
          <Text className="text-red-400 text-sm text-center">{error}</Text>
        ) : null}

        {/* Duration picker + Controls */}
        {isLoading ? (
          <ActivityIndicator color="#2D6A4F" size="large" />
        ) : (
          <View className="w-full gap-4">
            {!isActive && (
              <View className="gap-2">
                <Text className="text-text-muted text-sm">Select duration</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {FASTING_OPTIONS.map((option) => {
                      const isSelected = !isCustom && selectedHours === option.hours;
                      return (
                        <Pressable
                          key={option.hours}
                          className={`px-5 py-3 rounded-xl ${
                            isSelected ? 'bg-primary' : 'bg-surface'
                          }`}
                          onPress={() => handleProtocolSelect(option.hours)}
                        >
                          <Text
                            className={`font-semibold text-base ${
                              isSelected ? 'text-text-primary' : 'text-text-muted'
                            }`}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      className={`px-5 py-3 rounded-xl ${
                        isCustom ? 'bg-primary' : 'bg-surface'
                      }`}
                      onPress={handleCustomPress}
                    >
                      <Text
                        className={`font-semibold text-base ${
                          isCustom ? 'text-text-primary' : 'text-text-muted'
                        }`}
                      >
                        {isPro ? 'Custom' : 'Custom (Pro)'}
                      </Text>
                    </Pressable>
                  </View>
                </ScrollView>
                {isCustom && (
                  <View className="flex-row items-center gap-2 mt-2">
                    <TextInput
                      className="bg-surface text-text-primary rounded-xl px-4 py-3 flex-1 text-center text-lg"
                      placeholder={`Hours (${CUSTOM_PROTOCOL_MIN_HOURS}-${CUSTOM_PROTOCOL_MAX_HOURS})`}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      value={customHoursText}
                      onChangeText={setCustomHoursText}
                      maxLength={3}
                    />
                    <Text className="text-text-muted text-base">hours</Text>
                  </View>
                )}
              </View>
            )}
            <TimerControls
              isActive={isActive}
              onStart={handleStart}
              onStop={handleStop}
              onComplete={handleComplete}
              progressRatio={progressRatio}
            />
          </View>
        )}
      </ScrollView>
      </TouchableWithoutFeedback>
      <PhasesDrawer
        visible={showPhases}
        onClose={() => setShowPhases(false)}
        currentPhase={isActive ? currentPhase : null}
      />
    </SafeAreaView>
  );
}
