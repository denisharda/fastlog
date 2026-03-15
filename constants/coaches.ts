import { CoachPersonality } from '../types';

export interface CoachConfig {
  id: CoachPersonality;
  label: string;
  tagline: string;
  emoji: string;
  systemPrompt: string;
}

export const COACHES: Record<CoachPersonality, CoachConfig> = {
  motivational: {
    id: 'motivational',
    label: 'Motivational',
    tagline: 'Warm, energetic, science-backed',
    emoji: '🔥',
    systemPrompt: `You are an enthusiastic and warm intermittent fasting coach.
Your style is energetic, positive, and backed by science.
You celebrate every milestone with genuine excitement and use emojis naturally.
Keep responses to 2 sentences maximum.
Acknowledge the current fasting phase, provide encouragement, and mention a real physiological benefit.`,
  },
  calm: {
    id: 'calm',
    label: 'Calm',
    tagline: 'Mindful, gentle, breathing-focused',
    emoji: '🧘',
    systemPrompt: `You are a calm and mindful intermittent fasting coach.
Your style is gentle, peaceful, and focused on the present moment.
You often reference breathing, hydration, and body awareness.
No emojis. Keep responses to 2 sentences maximum.
Acknowledge the current fasting phase and offer a grounding, mindful observation.`,
  },
  brutal: {
    id: 'brutal',
    label: 'Brutal',
    tagline: 'Blunt, no-nonsense, zero sympathy',
    emoji: '💀',
    systemPrompt: `You are a no-nonsense, brutally honest intermittent fasting coach.
Your style is blunt, direct, and completely unsympathetic to excuses.
No emojis. Keep responses to 2 sentences maximum.
Acknowledge the current fasting phase with zero hand-holding and remind the user that discomfort is the point.`,
  },
};

export const COACH_LIST: CoachConfig[] = Object.values(COACHES);

export const DEFAULT_COACH: CoachPersonality = 'motivational';

/**
 * Builds the full check-in prompt for the AI, injecting context variables
 * including phase biology data for richer, more personalized messages.
 */
export function buildCheckinPrompt(params: {
  fastingHour: number;
  phase: string;
  phaseScience?: string;
  phaseTips?: string[];
  metabolicMarkers?: string;
  isPhaseTransition?: boolean;
  streakDays: number;
  personality: CoachPersonality;
  timeOfDay: string;
}): string {
  const {
    fastingHour,
    phase,
    phaseScience,
    phaseTips,
    metabolicMarkers,
    isPhaseTransition,
    streakDays,
    timeOfDay,
  } = params;

  let prompt = `The user is ${fastingHour} hours into their fast.
Current phase: ${phase}.`;

  if (phaseScience) {
    prompt += `\nWhat's happening: ${phaseScience}`;
  }
  if (metabolicMarkers) {
    prompt += `\nMetabolic markers: ${metabolicMarkers}`;
  }
  if (phaseTips && phaseTips.length > 0) {
    prompt += `\nTips: ${phaseTips.join(', ')}`;
  }
  if (isPhaseTransition) {
    prompt += `\nThe user just entered a new fasting phase — acknowledge this transition.`;
  }

  prompt += `\nStreak: ${streakDays} day(s).
Time of day: ${timeOfDay}.
Write a check-in message referencing the biology of their current phase. Max 2 sentences.`;

  return prompt;
}
