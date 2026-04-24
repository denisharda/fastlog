import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_DAILY_WATER_GOAL_ML } from '../constants/hydration';

export interface LocalHydrationLog {
  id: string;
  amount_ml: number;
  logged_at: string;
}

interface HydrationState {
  todayLogs: LocalHydrationLog[];
  dailyGoalMl: number;
  lastResetDate: string; // YYYY-MM-DD — for day-boundary detection
  // Actions
  logWater: (log: LocalHydrationLog) => void;
  removeLog: (logId: string) => void;
  setDailyGoal: (goalMl: number) => void;
  resetIfNewDay: () => void;
  applyRemoteLog: (log: LocalHydrationLog) => void;
  removeLogById: (logId: string) => void;
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export const useHydrationStore = create<HydrationState>()(
  persist(
    (set, get) => ({
      todayLogs: [],
      dailyGoalMl: DEFAULT_DAILY_WATER_GOAL_ML,
      lastResetDate: getTodayDate(),

      logWater: (log) => {
        get().resetIfNewDay();
        set((state) => ({
          todayLogs: [...state.todayLogs, log],
        }));
      },

      removeLog: (logId) =>
        set((state) => ({
          todayLogs: state.todayLogs.filter((l) => l.id !== logId),
        })),

      setDailyGoal: (goalMl) => set({ dailyGoalMl: goalMl }),

      resetIfNewDay: () => {
        const today = getTodayDate();
        if (get().lastResetDate !== today) {
          set({ todayLogs: [], lastResetDate: today });
        }
      },

      applyRemoteLog: (log) => {
        get().resetIfNewDay();
        set((state) => {
          if (state.todayLogs.some((l) => l.id === log.id)) return state;
          const loggedToday = log.logged_at.slice(0, 10) === getTodayDate();
          if (!loggedToday) return state;
          return { todayLogs: [...state.todayLogs, log] };
        });
      },

      removeLogById: (logId) =>
        set((state) => ({
          todayLogs: state.todayLogs.filter((l) => l.id !== logId),
        })),
    }),
    {
      name: 'hydration-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        todayLogs: state.todayLogs,
        dailyGoalMl: state.dailyGoalMl,
        lastResetDate: state.lastResetDate,
      }),
    }
  )
);
