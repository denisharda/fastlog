import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { FastingSession } from '../../types';

interface FastCalendarProps {
  sessions: FastingSession[];
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * A simple calendar heatmap showing the last 28 days of fasting activity.
 * TODO: Replace with a proper calendar library for production.
 */
export const FastCalendar = React.memo(function FastCalendar({ sessions }: FastCalendarProps) {
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
      <Text className="text-text-primary font-bold text-lg mb-3">Last 28 Days</Text>

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

              return (
                <View
                  key={di}
                  className={`flex-1 aspect-square rounded-md ${
                    isFuture
                      ? 'bg-background'
                      : isCompleted
                      ? 'bg-primary'
                      : isPartial
                      ? 'bg-accent/40'
                      : 'bg-white border border-text-muted/10'
                  } ${isToday ? 'border border-accent' : ''}`}
                />
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
      </View>
    </View>
  );
});
