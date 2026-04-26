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
  endedAt: string;
  completed: boolean;
  deviceId: string;
  attempts: number;
}

interface FastingState {
  activeFast: ActiveFast | null;
  pendingEnd: PendingEnd | null;
  /** Most recent session id this device has observed ending, from any
   *  source (local stop, Realtime UPDATE, syncWithRemote tear-down). */
  lastEndedSessionId: string | null;
  /** Most recent session id for which `/fast-complete` was surfaced.
   *  When `lastEndedSessionId !== lastSeenEndedSessionId`, the layout
   *  effect pushes the modal once and bumps `lastSeenEndedSessionId`. */
  lastSeenEndedSessionId: string | null;
  startFast: (fast: ActiveFast) => void;
  stopFast: () => void;
  setNotificationIds: (ids: string[]) => void;
  setPendingEnd: (pending: PendingEnd | null) => void;
  incrementPendingEndAttempts: () => void;
  setLastEndedSessionId: (id: string | null) => void;
  setLastSeenEndedSessionId: (id: string | null) => void;
}

export const useFastingStore = create<FastingState>()(
  persist(
    (set) => ({
      activeFast: null,
      pendingEnd: null,
      lastEndedSessionId: null,
      lastSeenEndedSessionId: null,

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

      setLastEndedSessionId: (id) => set({ lastEndedSessionId: id }),
      setLastSeenEndedSessionId: (id) => set({ lastSeenEndedSessionId: id }),
    }),
    {
      name: 'fasting-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeFast: state.activeFast ? {
          ...state.activeFast,
          scheduledNotificationIds: [],
        } : null,
        pendingEnd: state.pendingEnd,
        lastEndedSessionId: state.lastEndedSessionId,
        lastSeenEndedSessionId: state.lastSeenEndedSessionId,
      }),
    }
  )
);
