export type FastingProtocol = '16:8' | '18:6' | '24h' | 'custom';

export type FastingGoal = 'weight' | 'energy' | 'longevity' | 'metabolic';

export interface Profile {
  id: string;
  name: string | null;
  preferred_protocol: FastingProtocol;
  daily_water_goal_ml: number;
  goal?: FastingGoal | null;
  created_at: string;
  notification_prefs?: {
    phaseTransitions: boolean;
    hydration: boolean;
    halfway: boolean;
    complete: boolean;
  } | null;
}

export interface FastingSession {
  id: string;
  user_id: string;
  protocol: FastingProtocol;
  target_hours: number;
  started_at: string;
  ended_at: string | null;
  completed: boolean;
  notes: string | null;
  created_at: string;
}

export interface HydrationLog {
  id: string;
  user_id: string;
  session_id: string | null;
  amount_ml: number;
  logged_at: string;
}
