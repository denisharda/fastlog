import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { FastingSession } from '../../types';
import { CARD_SHADOW } from '../../constants/styles';

interface StatsRowProps {
  sessions: FastingSession[];
  hydrationTotals?: Record<string, number>;
}

interface Stats {
  streak: number;
  totalFasts: number;
  avgDuration: string;
  completionRate: number;
}

function computeStats(sessions: FastingSession[]): Stats {
  const totalFasts = sessions.length;
  if (totalFasts === 0) {
    return { streak: 0, totalFasts: 0, avgDuration: '0h', completionRate: 0 };
  }

  // Completion rate
  const completedCount = sessions.filter((s) => s.completed).length;
  const completionRate = Math.round((completedCount / totalFasts) * 100);

  // Average duration (only finished sessions)
  const finished = sessions.filter((s) => s.ended_at);
  let avgDuration = '0h';
  if (finished.length > 0) {
    const totalMs = finished.reduce((sum, s) => {
      return sum + (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime());
    }, 0);
    const avgHours = totalMs / finished.length / 3600000;
    avgDuration = avgHours >= 10 ? `${Math.round(avgHours)}h` : `${avgHours.toFixed(1)}h`;
  }

  // Current streak: walk backwards from today, count consecutive days with a completed session
  const completedDays = new Set<string>();
  for (const s of sessions) {
    if (s.completed) {
      completedDays.add(new Date(s.started_at).toDateString());
    }
  }

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (completedDays.has(d.toDateString())) {
      streak++;
    } else if (i > 0) {
      // Skip today if no fast yet — streak counts from yesterday
      break;
    }
  }

  return { streak, totalFasts, avgDuration, completionRate };
}

export const StatsRow = React.memo(function StatsRow({ sessions, hydrationTotals }: StatsRowProps) {
  const stats = useMemo(() => computeStats(sessions), [sessions]);

  const avgWater = useMemo(() => {
    if (!hydrationTotals) return '—';
    const values = Object.values(hydrationTotals).filter((v) => v > 0);
    if (values.length === 0) return '—';
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    if (avg >= 1000) return `${(avg / 1000).toFixed(1)}L`;
    return `${Math.round(avg)}ml`;
  }, [hydrationTotals]);

  return (
    <View className="bg-white rounded-2xl p-4 mb-4" style={CARD_SHADOW}>
      <View className="flex-row justify-around">
        <StatItem value={`${stats.streak}`} label="Streak" accent />
        <StatItem value={`${stats.totalFasts}`} label="Fasts" />
        <StatItem value={stats.avgDuration} label="Avg Time" />
        <StatItem value={`${stats.completionRate}%`} label="Complete" />
        <StatItem value={avgWater} label="Avg Water" />
      </View>
    </View>
  );
});

function StatItem({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View className="items-center">
      <Text
        className={`text-xl font-bold ${accent ? 'text-accent' : 'text-text-primary'}`}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
      <Text className="text-text-muted text-sm mt-0.5">{label}</Text>
    </View>
  );
}
