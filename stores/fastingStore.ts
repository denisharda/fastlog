import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FastingProtocol } from '../types';
import { writeSharedState, SharedFastingState } from '../lib/sharedState';
import { getCurrentPhase } from '../constants/phases';

export interface ActiveFast {
  sessionId: string;
  protocol: FastingProtocol;
  targetHours: number;
  startedAt: string; // ISO string — persisted across app restarts
  scheduledNotificationIds: string[];
}

interface FastingState {
  activeFast: ActiveFast | null;
  // Actions
  startFast: (fast: ActiveFast) => void;
  stopFast: () => void;
  setNotificationIds: (ids: string[]) => void;
}

/** Sync current fasting state to App Groups for widget/Live Activity */
function syncSharedState(activeFast: ActiveFast | null): void {
  if (!activeFast) {
    writeSharedState({
      isActive: false,
      startedAt: null,
      targetHours: 0,
      phase: 'Fed State',
      protocol: '16:8',
      elapsedHours: 0,
    });
    return;
  }

  const elapsed = (Date.now() - new Date(activeFast.startedAt).getTime()) / 3600000;
  const phase = getCurrentPhase(elapsed);
  writeSharedState({
    isActive: true,
    startedAt: activeFast.startedAt,
    targetHours: activeFast.targetHours,
    phase: phase.name,
    protocol: activeFast.protocol,
    elapsedHours: elapsed,
  });
}

export const useFastingStore = create<FastingState>()(
  persist(
    (set) => ({
      activeFast: null,

      startFast: (fast) => {
        set({ activeFast: fast });
        syncSharedState(fast);
      },

      stopFast: () => {
        set({ activeFast: null });
        syncSharedState(null);
      },

      setNotificationIds: (ids) =>
        set((state) => ({
          activeFast: state.activeFast
            ? { ...state.activeFast, scheduledNotificationIds: ids }
            : null,
        })),
    }),
    {
      name: 'fasting-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeFast: state.activeFast ? {
          ...state.activeFast,
          scheduledNotificationIds: [], // Don't persist notification IDs — they are invalid after app restart
        } : null,
      }),
    }
  )
);
