import { useState, useEffect } from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useUserStore } from '../../stores/userStore';
import { CARD_SHADOW } from '../../constants/styles';
import { trackPaywallViewed } from '../../lib/posthog';
import { syncFastSchedule } from '../../lib/fastScheduler';
import type { FastSchedule } from '../../stores/userStore';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface FastScheduleCardProps {
  isPro: boolean;
}

export function FastScheduleCard({ isPro }: FastScheduleCardProps) {
  const router = useRouter();
  const schedule = useUserStore((s) => s.fastSchedule);
  const setSchedule = useUserStore((s) => s.setFastSchedule);
  const preferredProtocol = useUserStore((s) => s.profile?.preferred_protocol ?? '16:8');

  const [enabled, setEnabled] = useState(schedule?.enabled ?? false);
  const [days, setDays] = useState<number[]>(schedule?.days ?? [1, 2, 3, 4, 5]); // Mon-Fri default
  const [hour, setHour] = useState(schedule?.hour ?? 20); // 8pm default

  // Sync to store when settings change
  useEffect(() => {
    if (enabled && days.length > 0) {
      setSchedule({ enabled, days, hour, protocol: preferredProtocol });
    } else if (!enabled) {
      setSchedule(null);
    }
    syncFastSchedule();
  }, [enabled, days, hour, preferredProtocol, setSchedule]);

  function handleToggle(value: boolean) {
    if (!isPro && value) {
      trackPaywallViewed('fast_schedule');
      router.push('/paywall');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnabled(value);
  }

  function toggleDay(day: number) {
    Haptics.selectionAsync();
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function formatHour(h: number): string {
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  }

  return (
    <View className="bg-white rounded-2xl p-4 mb-3" style={CARD_SHADOW}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-text-muted text-xs uppercase tracking-wider">
            Fast Schedule
          </Text>
          {!isPro && <Text className="text-primary text-xs font-medium">Pro</Text>}
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: '#E5E7EB', true: '#2D6A4F' }}
          thumbColor="white"
        />
      </View>

      {enabled && isPro && (
        <View>
          {/* Day picker */}
          <Text className="text-text-muted text-xs mb-2">Repeat on</Text>
          <View className="flex-row gap-1.5 mb-4">
            {DAY_LABELS.map((label, i) => {
              const selected = days.includes(i);
              return (
                <Pressable
                  key={i}
                  className={`flex-1 h-9 rounded-lg items-center justify-center ${
                    selected ? 'bg-primary' : 'bg-background'
                  }`}
                  onPress={() => toggleDay(i)}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      selected ? 'text-white' : 'text-text-muted'
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Hour picker */}
          <Text className="text-text-muted text-xs mb-2">Start at</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {[6, 7, 8, 18, 19, 20, 21, 22].map((h) => {
              const selected = hour === h;
              return (
                <Pressable
                  key={h}
                  className={`px-3 py-2 rounded-lg ${
                    selected ? 'bg-primary' : 'bg-background'
                  }`}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHour(h);
                  }}
                >
                  <Text
                    className={`text-xs font-medium ${
                      selected ? 'text-white' : 'text-text-muted'
                    }`}
                  >
                    {formatHour(h)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="text-text-muted text-[10px] mt-3">
            Using {preferredProtocol} protocol
          </Text>
        </View>
      )}
    </View>
  );
}
