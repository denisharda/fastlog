import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { PROTOCOL_LIST, DEFAULT_PROTOCOL } from '../../constants/protocols';
import { FastingProtocol } from '../../types';
import { useUserStore } from '../../stores/userStore';
import { supabase } from '../../lib/supabase';

export default function OnboardingProtocolScreen() {
  const router = useRouter();
  const { profile, setPreferredProtocol } = useUserStore();
  const [selected, setSelected] = useState<FastingProtocol>(DEFAULT_PROTOCOL);

  async function handleContinue() {
    if (profile) {
      setPreferredProtocol(selected);
      await supabase
        .from('profiles')
        .update({ preferred_protocol: selected })
        .eq('id', profile.id);
    }
    router.push('/onboarding/goal');
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        {/* Progress indicator */}
        <View className="flex-row gap-1 mb-8">
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              className={`h-1 flex-1 rounded-full ${step === 1 ? 'bg-primary' : 'bg-text-muted/20'}`}
            />
          ))}
        </View>

        <Text className="text-3xl font-bold text-text-primary mb-2">
          Choose your protocol
        </Text>
        <Text className="text-text-muted mb-8">
          Pick the fasting schedule that fits your lifestyle. You can always change this later.
        </Text>

        <View className="gap-3 mb-8">
          {PROTOCOL_LIST.filter((p) => p.id !== 'custom').map((protocol) => (
            <Pressable
              key={protocol.id}
              className={`p-4 rounded-2xl border-2 ${
                selected === protocol.id
                  ? 'border-primary bg-primary/10'
                  : 'border-text-muted/20 bg-white'
              }`}
              onPress={() => setSelected(protocol.id)}
            >
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-text-primary font-bold text-xl">{protocol.label}</Text>
                  <Text className="text-text-muted text-sm mt-1">{protocol.description}</Text>
                </View>
                {protocol.popular && (
                  <View className="bg-primary px-2 py-1 rounded-lg">
                    <Text className="text-white text-xs font-medium">Popular</Text>
                  </View>
                )}
                {selected === protocol.id && (
                  <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                    <Text className="text-white text-xs">✓</Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable
          className="bg-text-primary py-4 rounded-2xl items-center"
          onPress={handleContinue}
        >
          <Text className="text-white font-semibold text-lg">Continue</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
