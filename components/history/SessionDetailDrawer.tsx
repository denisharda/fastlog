import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FastingSession } from '../../types';
import { getCurrentPhase, FastingPhase } from '../../constants/phases';

interface SessionDetailDrawerProps {
  visible: boolean;
  sessions: FastingSession[];
  onClose: () => void;
  onStopFast?: (completed: boolean) => void;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 3,
};

export function SessionDetailDrawer({ visible, sessions, onClose, onStopFast }: SessionDetailDrawerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [phaseExpanded, setPhaseExpanded] = useState(false);

  // Reset selection when sessions change
  useEffect(() => {
    setSelectedIndex(0);
    setPhaseExpanded(false);
  }, [sessions]);

  const session = sessions[selectedIndex];
  const isInProgress = session && !session.ended_at;

  // Live tick for in-progress sessions
  useEffect(() => {
    if (!visible || !isInProgress) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible, isInProgress]);

  if (!session) return null;

  const endTime = session.ended_at ? new Date(session.ended_at).getTime() : now;
  const elapsedMs = endTime - new Date(session.started_at).getTime();
  const elapsedHours = elapsedMs / 3600000;
  const progress = Math.min(elapsedMs / (session.target_hours * 3600000), 1);
  const phase = getCurrentPhase(elapsedHours);

  function handleSessionSwitch(index: number) {
    Haptics.selectionAsync();
    setSelectedIndex(index);
    setPhaseExpanded(false);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
          <Text className="text-text-primary text-xl font-bold">Session Details</Text>
          <Pressable onPress={onClose} className="p-2">
            <Text className="text-text-muted text-lg">Done</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Multi-session picker */}
          {sessions.length > 1 && (
            <View className="flex-row gap-2 mb-4">
              {sessions.map((s, i) => (
                <Pressable
                  key={s.id}
                  className={`px-4 py-2 rounded-full ${
                    i === selectedIndex ? 'bg-primary' : 'bg-white border border-gray-200'
                  }`}
                  onPress={() => handleSessionSwitch(i)}
                >
                  <Text
                    className={`text-sm font-medium ${
                      i === selectedIndex ? 'text-white' : 'text-text-primary'
                    }`}
                  >
                    Session {i + 1}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Date + Status */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-text-primary font-semibold text-lg">
              {formatDate(session.started_at)}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-text-muted text-sm">{session.protocol}</Text>
              {session.completed ? (
                <View className="bg-primary px-2 py-0.5 rounded-full">
                  <Text className="text-white text-xs">Complete</Text>
                </View>
              ) : isInProgress ? (
                <View className="bg-accent/20 px-2 py-0.5 rounded-full">
                  <Text className="text-accent text-xs font-medium">Live</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Duration */}
          <View className="bg-white rounded-2xl p-4 mb-3" style={cardShadow}>
            <Text className="text-accent font-bold text-3xl text-center mb-2">
              {formatDuration(elapsedMs)}
            </Text>
            {/* Progress bar */}
            <View className="w-full h-2 bg-background rounded-full overflow-hidden mb-2">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </View>
            <Text className="text-text-muted text-xs text-center">
              {Math.round(progress * 100)}% of {session.target_hours}h goal
            </Text>
          </View>

          {/* Time details */}
          <View className="bg-white rounded-2xl p-4 mb-3" style={cardShadow}>
            <View className="flex-row justify-between">
              <View>
                <Text className="text-text-muted text-xs mb-1">Started</Text>
                <Text className="text-text-primary text-base font-medium">
                  {formatTime(session.started_at)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-text-muted text-xs mb-1">Ended</Text>
                <Text className="text-text-primary text-base font-medium">
                  {isInProgress ? 'In progress' : formatTime(session.ended_at!)}
                </Text>
              </View>
            </View>
          </View>

          {/* Phase */}
          <Pressable
            className="bg-white rounded-2xl p-4 mb-3"
            style={cardShadow}
            onPress={() => setPhaseExpanded((p) => !p)}
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-text-muted text-xs mb-1">
                  {isInProgress ? 'Current Phase' : 'Phase Reached'}
                </Text>
                <Text className="text-accent text-base font-semibold">{phase.name}</Text>
                <Text className="text-text-muted text-xs mt-0.5">{phase.description}</Text>
              </View>
              <Text className="text-text-muted text-base">{phaseExpanded ? '▾' : '▸'}</Text>
            </View>

            {phaseExpanded && (
              <View className="mt-3 pt-3 border-t border-gray-100">
                <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Science</Text>
                <Text className="text-text-primary text-sm mb-3">{phase.science}</Text>

                <Text className="text-text-muted text-xs uppercase tracking-wider mb-2">Tips</Text>
                {phase.tips.map((tip, i) => (
                  <Text key={i} className="text-text-primary text-sm mb-1">• {tip}</Text>
                ))}

                <Text className="text-text-muted text-xs uppercase tracking-wider mt-3 mb-2">Metabolic Markers</Text>
                <Text className="text-text-primary text-sm">{phase.metabolicMarkers}</Text>
              </View>
            )}
          </Pressable>

          {/* Notes */}
          {session.notes && (
            <View className="bg-white rounded-2xl p-4 mb-3" style={cardShadow}>
              <Text className="text-text-muted text-xs mb-1">Notes</Text>
              <Text className="text-text-primary text-sm italic">{session.notes}</Text>
            </View>
          )}

          {/* Stop/Complete buttons for in-progress sessions */}
          {isInProgress && onStopFast && (
            <View className="gap-2 mt-2">
              {progress >= 0.9 && (
                <Pressable
                  className="bg-primary rounded-2xl py-4 items-center active:scale-[0.98]"
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    onStopFast(true);
                    onClose();
                  }}
                >
                  <Text className="text-white font-bold text-base">Complete Fast</Text>
                </Pressable>
              )}
              <Pressable
                className="bg-white border border-red-300 rounded-2xl py-4 items-center active:scale-[0.98]"
                style={cardShadow}
                onPress={() => {
                  Alert.alert(
                    'End Fast Early?',
                    'Are you sure you want to stop your fast?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'End Fast',
                        style: 'destructive',
                        onPress: () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          onStopFast(false);
                          onClose();
                        },
                      },
                    ]
                  );
                }}
              >
                <Text className="text-red-500 font-semibold text-base">
                  {progress >= 0.9 ? 'End Early' : 'Stop Fast'}
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
