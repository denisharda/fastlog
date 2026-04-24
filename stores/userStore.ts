import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FastingProtocol, Profile } from '../types';
import { DEFAULT_PROTOCOL } from '../constants/protocols';
import { supabase } from '../lib/supabase';

export interface FastSchedule {
  enabled: boolean;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  hour: number;   // 0-23, the hour to start
  protocol: string;
}

/** Preferences for which push notifications to schedule. */
export interface NotificationPrefs {
  phaseTransitions: boolean;
  hydration: boolean;
  halfway: boolean;
  complete: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  phaseTransitions: true,
  hydration: true,
  halfway: false,
  complete: true,
};

interface UserState {
  profile: Profile | null;
  isPro: boolean;
  isProLoading: boolean;
  hasSeenSuccessPaywall: boolean;
  hasSeenIntro: boolean;
  fastSchedule: FastSchedule | null;
  notificationPrefs: NotificationPrefs;
  // Actions
  setProfile: (profile: Profile | null) => void;
  updateProfile: (updates: Partial<Profile>) => void;
  setIsPro: (isPro: boolean) => void;
  setIsProLoading: (loading: boolean) => void;
  setHasSeenSuccessPaywall: (val: boolean) => void;
  setHasSeenIntro: (val: boolean) => void;
  setFastSchedule: (schedule: FastSchedule | null) => void;
  setPreferredProtocol: (protocol: FastingProtocol) => void;
  setNotificationPrefs: (prefs: Partial<NotificationPrefs>) => void;
  reset: () => void;
}

const initialState = {
  profile: null as Profile | null,
  isPro: false,
  isProLoading: true,
  hasSeenSuccessPaywall: false,
  hasSeenIntro: false,
  fastSchedule: null as FastSchedule | null,
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProfile: (profile) => set({ profile }),

      updateProfile: (updates) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...updates } : null,
        })),

      setIsPro: (isPro) => set({ isPro }),

      setIsProLoading: (isProLoading) => set({ isProLoading }),

      setHasSeenSuccessPaywall: (val) => set({ hasSeenSuccessPaywall: val }),

      setHasSeenIntro: (val) => set({ hasSeenIntro: val }),

      setFastSchedule: (schedule) => set({ fastSchedule: schedule }),

      setPreferredProtocol: (protocol) =>
        set((state) => ({
          profile: state.profile
            ? { ...state.profile, preferred_protocol: protocol }
            : null,
        })),

      setNotificationPrefs: (prefs) => {
        set((state) => ({
          notificationPrefs: { ...state.notificationPrefs, ...prefs },
        }));
        const profile = get().profile;
        if (profile) {
          const next = { ...get().notificationPrefs };
          supabase
            .from('profiles')
            .update({ notification_prefs: next })
            .eq('id', profile.id)
            .then(({ error }) => {
              if (error) console.warn('[userStore] sync notification_prefs failed:', error);
            });
        }
      },

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
        hasSeenIntro: state.hasSeenIntro,
        fastSchedule: state.fastSchedule,
        notificationPrefs: state.notificationPrefs,
      }),
    }
  )
);

export { DEFAULT_PROTOCOL };
