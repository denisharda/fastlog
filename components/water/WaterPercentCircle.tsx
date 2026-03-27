import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface WaterPercentCircleProps {
  progressRatio: number;
  remainingMl: number;
  todayTotalMl: number;
  dailyGoalMl: number;
  lastLoggedAt: string | null;
}

function formatTimeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return 'Yesterday';
}

export const WaterPercentCircle = React.memo(function WaterPercentCircle({
  progressRatio,
  remainingMl,
  todayTotalMl,
  dailyGoalMl,
  lastLoggedAt,
}: WaterPercentCircleProps) {
  const goalReached = progressRatio >= 1;
  const animatedValue = useRef(new Animated.Value(0)).current;
  const prevTotal = useRef(0);

  useEffect(() => {
    animatedValue.setValue(prevTotal.current);
    Animated.timing(animatedValue, {
      toValue: todayTotalMl,
      duration: 400,
      useNativeDriver: false,
    }).start();
    prevTotal.current = todayTotalMl;
  }, [todayTotalMl, animatedValue]);

  const [displayedTotal, setDisplayedTotal] = React.useState(todayTotalMl);

  useEffect(() => {
    const id = animatedValue.addListener(({ value }) => {
      setDisplayedTotal(Math.round(value));
    });
    return () => animatedValue.removeListener(id);
  }, [animatedValue]);

  return (
    <View
      className="w-52 h-52 rounded-full bg-white items-center justify-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
      }}
    >
      {goalReached ? (
        <>
          <Text className="text-primary text-4xl font-bold">✓</Text>
          <Text className="text-primary text-base font-semibold mt-1">
            Goal reached!
          </Text>
          <Text className="text-text-muted text-xs mt-1">
            {todayTotalMl}ml today
          </Text>
        </>
      ) : (
        <>
          <Text
            className="text-text-primary text-[44px] font-bold"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {displayedTotal}
          </Text>
          <Text className="text-text-muted text-sm -mt-1">
            of {dailyGoalMl}ml
          </Text>
          <Text className="text-primary text-xs font-semibold mt-2">
            {remainingMl}ml to go
          </Text>
        </>
      )}
      {lastLoggedAt && (
        <Text className="text-text-muted/60 text-[10px] mt-1">
          Last drink: {formatTimeSince(lastLoggedAt)}
        </Text>
      )}
    </View>
  );
});
