import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoachPersonality, FastingProtocol, Profile } from '../types';
import { DEFAULT_COACH } from '../constants/coaches';
import { DEFAULT_PROTOCOL } from '../constants/protocols';

export interface FastSchedule {
  enabled: boolean;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  hour: number;   // 0-23, the hour to start
  protocol: string;
}

interface UserState {
  profile: Profile | null;
  isPro: boolean;
  isProLoading: boolean;
  hasSeenSuccessPaywall: boolean;
  fastSchedule: FastSchedule | null;
  // Actions
  setProfile: (profile: Profile | null) => void;
  updateProfile: (updates: Partial<Profile>) => void;
  setIsPro: (isPro: boolean) => void;
  setIsProLoading: (loading: boolean) => void;
  setHasSeenSuccessPaywall: (val: boolean) => void;
  setFastSchedule: (schedule: FastSchedule | null) => void;
  setCoachPersonality: (personality: CoachPersonality) => void;
  setPreferredProtocol: (protocol: FastingProtocol) => void;
  reset: () => void;
}

const initialState = {
  profile: null as Profile | null,
  isPro: false,
  isProLoading: true,
  hasSeenSuccessPaywall: false,
  fastSchedule: null as FastSchedule | null,
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...initialState,

      setProfile: (profile) => set({ profile }),

      updateProfile: (updates) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...updates } : null,
        })),

      setIsPro: (isPro) => set({ isPro }),

      setIsProLoading: (isProLoading) => set({ isProLoading }),

      setHasSeenSuccessPaywall: (val) => set({ hasSeenSuccessPaywall: val }),

      setFastSchedule: (schedule) => set({ fastSchedule: schedule }),

      setCoachPersonality: (personality) =>
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, coach_personality: personality }
            : null,
        })),

      setPreferredProtocol: (protocol) =>
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, preferred_protocol: protocol }
            : null,
        })),

      reset: () => set(initialState),
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist isProLoading — always recalculate on mount
      // isPro deliberately NOT persisted — always derived fresh from RevenueCat
      partialize: (state) => ({
        profile: state.profile,
        hasSeenSuccessPaywall: state.hasSeenSuccessPaywall,
        fastSchedule: state.fastSchedule,
      }),
    }
  )
);

export { DEFAULT_COACH, DEFAULT_PROTOCOL };
