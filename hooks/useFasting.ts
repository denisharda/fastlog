import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFastingStore } from '../stores/fastingStore';
import { useUserStore } from '../stores/userStore';
import { getCurrentPhase, FastingPhase } from '../constants/phases';
import { supabase } from '../lib/supabase';
import * as Crypto from 'expo-crypto';
import {
  scheduleStartNotification,
  scheduleCompletionNotification,
  schedulePhaseNotifications,
  scheduleCheckinNotifications,
  cancelAllNotifications,
} from '../lib/notifications';
import {
  trackFastStarted,
  trackFastCompleted,
  trackFastAbandoned,
} from '../lib/posthog';
import { FastingProtocol } from '../types';

const TICK_INTERVAL_MS = 1000;

interface UseFastingReturn {
  isActive: boolean;
  elapsedSeconds: number;
  elapsedHours: number;
  progressRatio: number; // 0–1 clamped
  currentPhase: FastingPhase;
  targetHours: number;
  startFast: (protocol: FastingProtocol, targetHours: number) => Promise<void>;
  stopFast: (completed?: boolean) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Core fasting timer hook. The timer is entirely local-first — no network
 * calls block the UI. Supabase is written to in the background.
 */
export function useFasting(): UseFastingReturn {
  const queryClient = useQueryClient();
  const { activeFast, startFast: storeStart, stopFast: storeStop, setNotificationIds } = useFastingStore();
  const { profile, isPro } = useUserStore();

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync elapsed seconds from persisted start time on mount / activeFast change
  useEffect(() => {
    if (activeFast) {
      const updateElapsed = () => {
        const start = new Date(activeFast.startedAt).getTime();
        const now = Date.now();
        setElapsedSeconds(Math.floor((now - start) / 1000));
      };

      updateElapsed();
      intervalRef.current = setInterval(updateElapsed, TICK_INTERVAL_MS);
    } else {
      setElapsedSeconds(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeFast]);

  const elapsedHours = elapsedSeconds / 3600;
  const targetHours = activeFast?.targetHours ?? 0;
  const progressRatio = targetHours > 0 ? Math.min(elapsedHours / targetHours, 1) : 0;
  const currentPhase = getCurrentPhase(elapsedHours);

  const startFast = useCallback(
    async (protocol: FastingProtocol, hours: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const sessionId = Crypto.randomUUID();
        const startedAt = new Date().toISOString();

        // Optimistically update local state first — timer starts immediately
        storeStart({
          sessionId,
          protocol,
          targetHours: hours,
          startedAt,
          scheduledNotificationIds: [],
        });

        trackFastStarted({ protocol, targetHours: hours });

        // Background: write to Supabase (only if signed in)
        if (profile) {
          supabase
            .from('fasting_sessions')
            .insert({
              id: sessionId,
              user_id: profile.id,
              protocol,
              target_hours: hours,
              started_at: startedAt,
            })
            .then(({ error: dbError }) => {
              if (dbError) console.error('[useFasting] DB insert error:', dbError);
              else queryClient.invalidateQueries({ queryKey: ['fasting_sessions'] });
            });
        }

        // Schedule notifications
        const start = new Date(startedAt);
        const endTime = new Date(start.getTime() + hours * 3600 * 1000);

        // Free notifications for all users: start, phases, completion
        const freeNotifPromises = [
          scheduleStartNotification(),
          schedulePhaseNotifications(start, hours),
          scheduleCompletionNotification(endTime),
        ];

        // Pro-only: AI coach check-in notifications
        const proNotifPromise = isPro
          ? scheduleCheckinNotifications(start, hours)
          : Promise.resolve([]);

        const [, phaseIds, , checkinIds] = await Promise.all([
          ...freeNotifPromises,
          proNotifPromise,
        ]);

        setNotificationIds([...phaseIds, ...checkinIds]);
      } catch (err) {
        setError('Failed to start fast. Please try again.');
        console.error('[useFasting] startFast error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [profile, isPro, storeStart, setNotificationIds, queryClient]
  );

  const stopFast = useCallback(
    async (completed = false) => {
      if (!activeFast) return;
      setIsLoading(true);

      try {
        const endedAt = new Date().toISOString();
        const actualHours = elapsedHours;

        storeStop();
        await cancelAllNotifications();

        if (completed) {
          trackFastCompleted({
            protocol: activeFast.protocol,
            targetHours: activeFast.targetHours,
            actualHours,
          });
        } else {
          trackFastAbandoned({
            protocol: activeFast.protocol,
            targetHours: activeFast.targetHours,
            hoursCompleted: actualHours,
          });
        }

        // Background: update DB record (only if signed in)
        if (profile) {
          supabase
            .from('fasting_sessions')
            .update({ ended_at: endedAt, completed })
            .eq('id', activeFast.sessionId)
            .then(({ error: dbError }) => {
              if (dbError) console.error('[useFasting] DB update error:', dbError);
              else queryClient.invalidateQueries({ queryKey: ['fasting_sessions'] });
            });
        }
      } catch (err) {
        setError('Failed to stop fast.');
        console.error('[useFasting] stopFast error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeFast, profile, elapsedHours, storeStop, queryClient]
  );

  return {
    isActive: !!activeFast,
    elapsedSeconds,
    elapsedHours,
    progressRatio,
    currentPhase,
    targetHours,
    startFast,
    stopFast,
    isLoading,
    error,
  };
}
