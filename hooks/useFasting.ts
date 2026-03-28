import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  // scheduleCheckinNotifications, // Hidden: AI coach
  scheduleWaterReminders,
  cancelAllNotifications,
} from '../lib/notifications';
import {
  trackFastStarted,
  trackFastCompleted,
  trackFastAbandoned,
} from '../lib/posthog';
import { writeSharedState } from '../lib/sharedState';
import { startLiveActivity, updateLiveActivity, endLiveActivity } from '../lib/liveActivity';
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
  const profile = useUserStore(s => s.profile);
  const isPro = useUserStore(s => s.isPro);

  console.log('[useFasting] render — activeFast:', activeFast?.sessionId ?? 'null');

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track previous phase for transition detection
  const prevPhaseRef = useRef<string | null>(null);

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

  // Derived values — memoized to avoid unnecessary recalculations
  const elapsedHours = elapsedSeconds / 3600;
  const targetHours = activeFast?.targetHours ?? 0;
  const progressRatio = targetHours > 0 ? Math.min(elapsedHours / targetHours, 1) : 0;
  const currentPhase = useMemo(() => getCurrentPhase(elapsedHours), [elapsedHours]);

  // Update Live Activity and shared state on phase change
  useEffect(() => {
    if (!activeFast) {
      prevPhaseRef.current = null;
      return;
    }

    if (prevPhaseRef.current !== currentPhase.name) {
      prevPhaseRef.current = currentPhase.name;

      // Compute fresh elapsed hours to avoid stale value in dependency
      const elapsed = (Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000;

      // Update shared state for widget
      writeSharedState({
        isActive: true,
        startedAt: activeFast.startedAt,
        targetHours: activeFast.targetHours,
        phase: currentPhase.name,
        protocol: activeFast.protocol,
        elapsedHours: elapsed,
      });

      // Update Live Activity
      updateLiveActivity({
        phase: currentPhase.name,
        phaseDescription: currentPhase.description,
      });
    }
  }, [activeFast, currentPhase.name]);

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

        // AI coach check-in notifications hidden — re-enable when AI features return
        const proNotifPromise = Promise.resolve([] as string[]);

        const [startId, phaseIds, completionId, waterIds, checkinIds] = await Promise.all([
          scheduleStartNotification(),
          schedulePhaseNotifications(start, hours),
          scheduleCompletionNotification(endTime),
          scheduleWaterReminders(start, hours),
          proNotifPromise,
        ] as const);

        setNotificationIds([startId, ...phaseIds, completionId, ...waterIds, ...checkinIds]);

        // Start Live Activity (iOS only, no-op if native module unavailable)
        const phase = getCurrentPhase(0);
        startLiveActivity({
          startedAt,
          targetHours: hours,
          phase: phase.name,
          phaseDescription: phase.description,
          protocol,
        });
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
      console.log('[stopFast] called with completed:', completed);
      console.log('[stopFast] activeFast:', activeFast);
      console.log('[stopFast] profile:', profile?.id);

      if (!activeFast) {
        console.warn('[stopFast] NO activeFast — returning early');
        return;
      }

      setIsLoading(true);

      try {
        const endedAt = new Date().toISOString();
        const actualHours = (Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000;
        const sessionId = activeFast.sessionId;

        console.log('[stopFast] sessionId:', sessionId);
        console.log('[stopFast] endedAt:', endedAt);
        console.log('[stopFast] actualHours:', actualHours);

        storeStop();
        await cancelAllNotifications();
        endLiveActivity();

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

        // Update DB record
        if (profile) {
          console.log('[stopFast] updating DB for session:', sessionId);
          const { error: dbError, data: dbData, count } = await supabase
            .from('fasting_sessions')
            .update({ ended_at: endedAt, completed })
            .eq('id', sessionId)
            .select();

          console.log('[stopFast] DB result — error:', dbError, 'data:', dbData, 'count:', count);

          if (dbError) {
            console.error('[useFasting] DB update error:', dbError);
          } else {
            queryClient.invalidateQueries({ queryKey: ['fasting_sessions'] });
          }
        } else {
          console.warn('[stopFast] no profile — skipping DB update');
        }
      } catch (err) {
        setError('Failed to stop fast.');
        console.error('[useFasting] stopFast error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeFast, profile, storeStop, queryClient]
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
