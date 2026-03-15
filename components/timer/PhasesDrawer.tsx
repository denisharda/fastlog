import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { FASTING_PHASES, FastingPhase } from '../../constants/phases';

interface PhasesDrawerProps {
  visible: boolean;
  onClose: () => void;
  currentPhase: FastingPhase | null;
}

const PHASE_ICONS: Record<string, string> = {
  'Fed State': '\u{1F37D}',
  'Early Fasting': '\u{1F4A7}',
  'Fat Burning Begins': '\u{1F525}',
  'Fat Burning Peak': '\u{26A1}',
  'Autophagy Zone': '\u{1F9EC}',
  'Deep Fast': '\u{1F48E}',
};

export function PhasesDrawer({ visible, onClose, currentPhase }: PhasesDrawerProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  function toggleExpand(phaseName: string) {
    setExpandedPhase((prev) => (prev === phaseName ? null : phaseName));
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
          <Text className="text-text-primary text-xl font-bold">Fasting Phases</Text>
          <Pressable onPress={onClose} className="p-2">
            <Text className="text-text-muted text-lg">Done</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
          {FASTING_PHASES.map((phase) => {
            const isCurrent = currentPhase?.name === phase.name;
            const icon = PHASE_ICONS[phase.name] ?? '';
            const isExpanded = expandedPhase === phase.name;
            const hourLabel =
              phase.maxHours === Infinity
                ? `${phase.minHours}h+`
                : `${phase.minHours}–${phase.maxHours}h`;

            return (
              <View
                key={phase.name}
                className={`mb-4 rounded-2xl ${
                  isCurrent ? 'bg-primary/15 border border-primary' : 'bg-surface'
                }`}
              >
                <View className="p-4">
                  <View className="flex-row items-center mb-2">
                    <Text className="text-2xl mr-3">{icon}</Text>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-text-primary font-bold text-base">
                          {phase.name}
                        </Text>
                        {isCurrent && (
                          <View className="bg-primary px-2 py-0.5 rounded-full">
                            <Text className="text-text-primary text-xs font-bold">Current</Text>
                          </View>
                        )}
                      </View>
                      <Text className="text-accent text-sm font-medium">{hourLabel}</Text>
                    </View>
                  </View>
                  <Text className="text-text-muted text-sm leading-5">{phase.description}</Text>
                </View>

                {/* Expandable "What's happening in my body?" section */}
                <Pressable
                  className="px-4 py-3 border-t border-white/5"
                  style={{ minHeight: 44 }}
                  onPress={() => toggleExpand(phase.name)}
                >
                  <Text className="text-accent text-sm font-medium">
                    {isExpanded ? '▾' : '▸'} What's happening in my body?
                  </Text>
                </Pressable>

                {isExpanded && (
                  <View className="px-4 pb-4">
                    {/* Science explanation */}
                    <Text className="text-text-primary text-sm leading-5 mb-3">
                      {phase.science}
                    </Text>

                    {/* Tips */}
                    {phase.tips.length > 0 && (
                      <View className="mb-3">
                        {phase.tips.map((tip, i) => (
                          <View key={i} className="flex-row items-start mb-1">
                            <Text className="text-accent text-xs mr-2 mt-0.5">•</Text>
                            <Text className="text-text-muted text-sm flex-1">{tip}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Metabolic markers */}
                    <Text className="text-text-muted text-xs italic">
                      {phase.metabolicMarkers}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
