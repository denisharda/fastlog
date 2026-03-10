import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoachPersonality, FastingProtocol, Profile } from '../types';
import { DEFAULT_COACH } from '../constants/coaches';
import { DEFAULT_PROTOCOL } from '../constants/protocols';

interface UserState {
  profile: Profile | null;
  isPro: boolean;
  isProLoading: boolean;
  // Actions
  setProfile: (profile: Profile | null) => void;
  updateProfile: (updates: Partial<Profile>) => void;
  setIsPro: (isPro: boolean) => void;
  setIsProLoading: (loading: boolean) => void;
  setCoachPersonality: (personality: CoachPersonality) => void;
  setPreferredProtocol: (protocol: FastingProtocol) => void;
  reset: () => void;
}

const initialState = {
  profile: null as Profile | null,
  isPro: false,
  isProLoading: true,
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
      partialize: (state) => ({
        profile: state.profile,
        isPro: state.isPro,
      }),
    }
  )
);

export { DEFAULT_COACH, DEFAULT_PROTOCOL };
