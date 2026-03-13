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

const PHASE_DETAILS: Record<string, string> = {
  'Fed State':
    'Your body is digesting and absorbing nutrients from your last meal. Blood sugar and insulin levels are elevated as your body processes food.',
  'Early Fasting':
    'Insulin levels begin to drop and your body starts transitioning from using glucose to tapping into stored energy. Blood sugar stabilizes.',
  'Fat Burning Begins':
    'Glycogen stores in the liver are depleting. Your body increasingly switches to burning fat for fuel. Growth hormone levels start rising.',
  'Fat Burning Peak':
    'Ketone production ramps up as your body enters ketosis. Fat is now a primary energy source. Mental clarity often improves at this stage.',
  'Autophagy Zone':
    'Cellular cleanup accelerates. Your cells begin recycling damaged components and proteins. This is associated with anti-aging and disease prevention benefits.',
  'Deep Fast':
    'Maximum autophagy and fat oxidation. Your body is in a deep state of repair and regeneration. Inflammation markers typically decrease significantly.',
};

export function PhasesDrawer({ visible, onClose, currentPhase }: PhasesDrawerProps) {
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
          {FASTING_PHASES.map((phase, index) => {
            const isCurrent = currentPhase?.name === phase.name;
            const icon = PHASE_ICONS[phase.name] ?? '';
            const detail = PHASE_DETAILS[phase.name] ?? '';
            const hourLabel =
              phase.maxHours === Infinity
                ? `${phase.minHours}h+`
                : `${phase.minHours}–${phase.maxHours}h`;

            return (
              <View
                key={phase.name}
                className={`mb-4 p-4 rounded-2xl ${
                  isCurrent ? 'bg-primary/15 border border-primary' : 'bg-surface'
                }`}
              >
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
                <Text className="text-text-muted text-sm leading-5">{detail}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
