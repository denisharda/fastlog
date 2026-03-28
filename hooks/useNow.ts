import { useEffect, useState } from 'react';

/**
 * Shared hook that returns Date.now() updated every second.
 * Only ticks when `enabled` is true — pass false to skip the interval.
 * Multiple consumers share React's batched state updates.
 */
export function useNow(enabled: boolean): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);

  return now;
}
