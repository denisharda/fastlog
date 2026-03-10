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

interface FastingState {
  activeFast: ActiveFast | null;
  // Actions
  startFast: (fast: ActiveFast) => void;
  stopFast: () => void;
  setNotificationIds: (ids: string[]) => void;
}

export const useFastingStore = create<FastingState>()(
  persist(
    (set) => ({
      activeFast: null,

      startFast: (fast) => set({ activeFast: fast }),

      stopFast: () => set({ activeFast: null }),

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
    }
  )
);
