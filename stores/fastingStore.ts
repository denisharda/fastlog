import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FastingProtocol } from '../types';

export interface ActiveFast {
  sessionId: string;
  protocol: FastingProtocol;
  targetHours: number;
  startedAt: string; // ISO string — persisted across app restarts
  scheduledNotificationIds: string[];
}

export interface PendingEnd {
  sessionId: string;
  endedAt: string;      // ISO
  completed: boolean;
  deviceId: string;     // the device id that initiated the end
  attempts: number;     // incremented by the retry path; diagnostic only
}

interface FastingState {
  activeFast: ActiveFast | null;
  pendingEnd: PendingEnd | null;
  startFast: (fast: ActiveFast) => void;
  stopFast: () => void;
  setNotificationIds: (ids: string[]) => void;
  setPendingEnd: (pending: PendingEnd | null) => void;
  incrementPendingEndAttempts: () => void;
}

export const useFastingStore = create<FastingState>()(
  persist(
    (set) => ({
      activeFast: null,
      pendingEnd: null,

      startFast: (fast) => {
        set({ activeFast: fast });
      },

      stopFast: () => {
        set({ activeFast: null });
      },

      setNotificationIds: (ids) =>
        set((state) => ({
          activeFast: state.activeFast
            ? { ...state.activeFast, scheduledNotificationIds: ids }
            : null,
        })),

      setPendingEnd: (pending) => set({ pendingEnd: pending }),
      incrementPendingEndAttempts: () =>
        set((state) => ({
          pendingEnd: state.pendingEnd
            ? { ...state.pendingEnd, attempts: state.pendingEnd.attempts + 1 }
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
        pendingEnd: state.pendingEnd,
      }),
    }
  )
);
