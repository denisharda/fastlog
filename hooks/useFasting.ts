import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useFastingStore } from '../stores/fastingStore';
import { useUserStore } from '../stores/userStore';
import { getCurrentPhase, FastingPhase } from '../constants/phases';
import { supabase } from '../lib/supabase';
import * as Crypto from 'expo-crypto';
import {
  trackFastStarted,
  trackFastCompleted,
  trackFastAbandoned,
  trackFastPhaseEntered,
} from '../lib/posthog';
import { pushWidgetSnapshot } from '../lib/widget';
import {
  updateLiveActivity,
  restoreLiveActivity,
  hasLiveActivity,
} from '../lib/liveActivity';
import { endActiveFast, reconcileActiveFast } from '../lib/endFast';
import { applyActiveSession } from '../lib/sessionAdoption';
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
  const { activeFast } = useFastingStore();
  const profile = useUserStore(s => s.profile);
  const isPro = useUserStore(s => s.isPro);

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track previous phase for transition detection
  const prevPhaseRef = useRef<string | null>(null);
  const elapsedHoursRef = useRef(0);

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

  // Restore live activity on mount if fast is active but instance was lost (app restart).
  // Key only on sessionId so a new object reference (from Zustand rehydration) doesn't
  // re-fire this and duplicate the activity. restoreLiveActivity itself is idempotent
  // and coalesces concurrent calls from parallel hook consumers (Timer + Water tabs).
  const sessionId = activeFast?.sessionId ?? null;
  useEffect(() => {
    if (!activeFast) return;
    if (hasLiveActivity()) return;
    const elapsed = (Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000;
    const phase = getCurrentPhase(elapsed);
    restoreLiveActivity({
      startedAt: activeFast.startedAt,
      targetHours: activeFast.targetHours,
      phase: phase.name,
      phaseDescription: phase.description,
      protocol: activeFast.protocol,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Re-sync shared state when app returns to foreground
  useEffect(() => {
    function handleAppState(nextState: AppStateStatus) {
      if (nextState === 'active' && activeFast) {
        const elapsed = (Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000;
        const phase = getCurrentPhase(elapsed);
        pushWidgetSnapshot({
          isActive: true,
          startedAt: activeFast.startedAt,
          targetHours: activeFast.targetHours,
          phase: phase.name,
          protocol: activeFast.protocol,
        });
        // Check whether the session was ended from another device while we
        // were backgrounded. If so, endActiveFast runs and local teardown
        // (LA, notifications, widget) follows.
        reconcileActiveFast();
      }
    }

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [activeFast]);

  // Reconcile on mount too — covers cold-launch after another device ended
  // the session. Only runs once per active session (key on sessionId).
  useEffect(() => {
    if (!sessionId) return;
    reconcileActiveFast();
  }, [sessionId]);

  // Derived values — memoized to avoid unnecessary recalculations
  const elapsedHours = elapsedSeconds / 3600;
  const targetHours = activeFast?.targetHours ?? 0;
  const progressRatio = targetHours > 0 ? Math.min(elapsedHours / targetHours, 1) : 0;
  const currentPhase = useMemo(() => getCurrentPhase(elapsedHours), [elapsedHours]);
  elapsedHoursRef.current = elapsedHours;

  // Update Live Activity and shared state on phase change
  useEffect(() => {
    if (!activeFast) {
      prevPhaseRef.current = null;
      return;
    }

    if (prevPhaseRef.current !== currentPhase.name) {
      const isInitialSync = prevPhaseRef.current === null;
      prevPhaseRef.current = currentPhase.name;

      pushWidgetSnapshot({
        isActive: true,
        startedAt: activeFast.startedAt,
        targetHours: activeFast.targetHours,
        phase: currentPhase.name,
        protocol: activeFast.protocol,
      });

      updateLiveActivity({
        startedAt: activeFast.startedAt,
        targetHours: activeFast.targetHours,
        phase: currentPhase.name,
        phaseDescription: currentPhase.description,
        protocol: activeFast.protocol,
      });

      // Only report real transitions — skip the initial phase on mount.
      if (!isInitialSync) {
        trackFastPhaseEntered({
          phase: currentPhase.name,
          elapsed_h: elapsedHoursRef.current,
          protocol: activeFast.protocol,
          target_hours: activeFast.targetHours,
        });
      }
    }
  }, [activeFast, currentPhase.name]);

  const startFast = useCallback(
    async (protocol: FastingProtocol, hours: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const sessionId = Crypto.randomUUID();
        const startedAt = new Date().toISOString();

        // Analytics first so we track the intent even if bring-up fails partway.
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

        // Bring up Zustand store, notifications, Live Activity, widget — shared
        // with the adoption path so a fast started on another device looks
        // identical on this one.
        await applyActiveSession(
          { sessionId, protocol, targetHours: hours, startedAt },
          { isFreshStart: true }
        );
      } catch (err) {
        setError('Failed to start fast. Please try again.');
        console.error('[useFasting] startFast error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [profile, isPro, queryClient]
  );

  const stopFast = useCallback(
    async (completed = false) => {
      if (!activeFast) return;
      setIsLoading(true);

      try {
        const endedAt = new Date().toISOString();
        const actualHours = (Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000;

        await endActiveFast();

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

        if (profile) {
          const { error: dbError } = await supabase
            .from('fasting_sessions')
            .update({ ended_at: endedAt, completed })
            .eq('id', activeFast.sessionId);

          if (dbError) {
            console.error('[useFasting] DB update error:', dbError);
          } else {
            queryClient.invalidateQueries({ queryKey: ['fasting_sessions'] });
          }
        }
      } catch (err) {
        setError('Failed to stop fast.');
        console.error('[useFasting] stopFast error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [activeFast, profile, queryClient]
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
