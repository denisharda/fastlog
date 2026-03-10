export type CoachPersonality = 'motivational' | 'calm' | 'brutal';
export type FastingProtocol = '16:8' | '18:6' | '24h' | 'custom';

export interface Profile {
  id: string;
  name: string | null;
  coach_personality: CoachPersonality;
  preferred_protocol: FastingProtocol;
  push_token: string | null;
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
  streakDays: number;
  personality: CoachPersonality;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface CheckinResponse {
  message: string;
}
