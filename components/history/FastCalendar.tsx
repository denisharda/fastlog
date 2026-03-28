import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FastingSession } from '../../types';

interface FastCalendarProps {
  sessions: FastingSession[];
  onDayPress?: (dateString: string) => void;
  hydrationByDay?: Record<string, number>;
  dailyGoalMl?: number;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * A simple calendar heatmap showing the last 28 days of fasting activity.
 * TODO: Replace with a proper calendar library for production.
 */
export const FastCalendar = React.memo(function FastCalendar({ sessions, onDayPress, hydrationByDay, dailyGoalMl = 2000 }: FastCalendarProps) {
  // Build sets of dates that had completed/partial fasts
  const { completedDates, partialDates } = useMemo(() => {
    const completed = new Set<string>();
    const partial = new Set<string>();
    for (const s of sessions) {
      const day = new Date(s.started_at).toDateString();
      if (s.completed) {
        completed.add(day);
      } else if (s.ended_at) {
        partial.add(day);
      }
    }
    return { completedDates: completed, partialDates: partial };
  }, [sessions]);

  // Build last 28 days and split into weeks
  const { days, weeks, today } = useMemo(() => {
    const t = new Date();
    const d: Date[] = [];
    for (let i = 27; i >= 0; i--) {
      const date = new Date(t);
      date.setDate(t.getDate() - i);
      d.push(date);
    }

    const w: Date[][] = [];
    for (let i = 0; i < d.length; i += 7) {
      w.push(d.slice(i, i + 7));
    }

    return { days: d, weeks: w, today: t };
  }, []);

  return (
    <View className="mb-4">
      {/* Day labels */}
      <View className="flex-row mb-1">
        {DAYS_OF_WEEK.map((d) => (
          <View key={d} className="flex-1 items-center">
            <Text className="text-text-muted text-xs">{d[0]}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View className="gap-1">
        {weeks.map((week, wi) => (
          <View key={wi} className="flex-row gap-1">
            {week.map((day, di) => {
              const dateStr = day.toDateString();
              const isCompleted = completedDates.has(dateStr);
              const isPartial = partialDates.has(dateStr);
              const isToday = dateStr === today.toDateString();
              const isFuture = day > today;

              const hasSession = isCompleted || isPartial;
              const dayHydration = hydrationByDay?.[dateStr] ?? 0;
              const hydrationGoalMet = dailyGoalMl && dayHydration >= dailyGoalMl;
              const hydrationPartial = dayHydration > 0 && !hydrationGoalMet;
              const hasActivity = hasSession || dayHydration > 0;
              const isTappable = hasActivity && !isFuture;
              const cellClass = `flex-1 aspect-square rounded-md items-center justify-center ${
                isFuture
                  ? 'bg-background'
                  : isCompleted
                  ? 'bg-primary'
                  : isPartial
                  ? 'bg-accent/40'
                  : 'bg-white border border-text-muted/10'
              } ${isToday ? 'border border-accent' : ''}`;
              const label = (
                <>
                  <Text
                    className={`text-[10px] font-medium ${
                      isCompleted ? 'text-white' : isFuture ? 'text-text-muted/30' : 'text-text-muted'
                    }`}
                  >
                    {day.getDate()}
                  </Text>
                  {(hydrationGoalMet || hydrationPartial) && (
                    <View
                      className={`w-1 h-1 rounded-full mt-0.5 ${
                        hydrationGoalMet ? 'bg-water' : 'bg-water/40'
                      }`}
                    />
                  )}
                </>
              );

              if (isTappable) {
                const fullDateLabel = day.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                });
                const statusLabel = isCompleted ? 'completed fast' : isPartial ? 'partial fast' : 'hydration logged';
                return (
                  <Pressable
                    key={di}
                    className={cellClass}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onDayPress?.(dateStr);
                    }}
                    accessibilityLabel={`${fullDateLabel}, ${statusLabel}`}
                  >
                    {label}
                  </Pressable>
                );
              }

              return (
                <View key={di} className={cellClass}>
                  {label}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View className="flex-row items-center gap-4 mt-3">
        <View className="flex-row items-center gap-1">
          <View className="w-3 h-3 rounded-sm bg-primary" />
          <Text className="text-text-muted text-xs">Complete</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-3 h-3 rounded-sm bg-accent/40" />
          <Text className="text-text-muted text-xs">Partial</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-3 h-3 rounded-sm bg-white border border-text-muted/20" />
          <Text className="text-text-muted text-xs">No fast</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-3 h-3 rounded-full bg-water items-center justify-center">
            <View className="w-1.5 h-1.5 rounded-full bg-water" />
          </View>
          <Text className="text-text-muted text-xs">Hydrated</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-3 h-3 rounded-full bg-water/40 items-center justify-center">
            <View className="w-1.5 h-1.5 rounded-full bg-water/40" />
          </View>
          <Text className="text-text-muted text-xs">Partial</Text>
        </View>
      </View>
    </View>
  );
});
