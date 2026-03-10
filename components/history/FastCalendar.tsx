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
export function FastCalendar({ sessions }: FastCalendarProps) {
  // Build a set of dates that had completed fasts
  const completedDates = new Set(
    sessions
      .filter((s) => s.completed)
      .map((s) => new Date(s.started_at).toDateString())
  );
  const partialDates = new Set(
    sessions
      .filter((s) => !s.completed && s.ended_at)
      .map((s) => new Date(s.started_at).toDateString())
  );

  // Build last 28 days
  const today = new Date();
  const days: Date[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }

  // Split into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

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
                      : 'bg-surface'
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
          <View className="w-3 h-3 rounded-sm bg-surface" />
          <Text className="text-text-muted text-xs">No fast</Text>
        </View>
      </View>
    </View>
  );
}
