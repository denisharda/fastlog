export type CoachPersonality = 'motivational' | 'calm' | 'brutal';
export type FastingProtocol = '16:8' | '18:6' | '24h' | 'custom';

export interface Profile {
  id: string;
  name: string | null;
  coach_personality: CoachPersonality;
  preferred_protocol: FastingProtocol;
  daily_water_goal_ml: number;
  push_token: string | null;
  goals?: string[]; // Local-only — for future AI personalization
  created_at: string;
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

export interface Checkin {
  id: string;
  user_id: string;
  session_id: string;
  message: string;
  personality: CoachPersonality;
  fasting_hour: number;
  delivered_at: string;
}

export interface CheckinRequest {
  userId: string;
  sessionId: string;
  fastingHour: number;
  phase: string;
  phaseScience: string;
  phaseTips: string[];
  metabolicMarkers: string;
  isPhaseTransition: boolean;
  streakDays: number;
  personality: CoachPersonality;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface CheckinResponse {
  message: string;
}

export interface HydrationLog {
  id: string;
  user_id: string;
  session_id: string | null;
  amount_ml: number;
  logged_at: string;
}
