import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_CHECKINS_PER_DAY = 5;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '', // No web origin allowed — mobile app only
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_PERSONALITIES = ['motivational', 'calm', 'brutal'] as const;
const VALID_PHASES = ['Fed State', 'Early Fasting', 'Fat Burning Begins', 'Fat Burning Peak', 'Autophagy Zone', 'Deep Fast'] as const;
const VALID_TIMES_OF_DAY = ['morning', 'afternoon', 'evening', 'night'] as const;

const PHASE_DATA: Record<string, { science: string; tips: string[]; markers: string }> = {
  'Fed State': {
    science: 'Insulin elevated, glucose absorbing, anabolic mode.',
    tips: ['Stay hydrated', 'Avoid snacking to let digestion complete'],
    markers: 'Insulin high, blood glucose elevated, mTOR active',
  },
  'Early Fasting': {
    science: 'Insulin levels begin to fall, blood sugar stabilizes.',
    tips: ['Drink water or herbal tea', 'Stay busy to manage hunger cues'],
    markers: 'Insulin falling, glucagon rising, blood glucose normalizing',
  },
  'Fat Burning Begins': {
    science: 'Hepatic glycogen depleting, fatty acid oxidation rising.',
    tips: ['Water with electrolytes helps', 'Light walking boosts fat oxidation'],
    markers: 'Glycogen dropping, free fatty acids rising, growth hormone increasing',
  },
  'Fat Burning Peak': {
    science: 'Ketone production ramps up as your body enters ketosis.',
    tips: ['Black coffee or green tea are fine', 'Expect a mental clarity boost'],
    markers: 'Ketones rising (BHB 0.5-1.0 mM), insulin at baseline, HGH elevated',
  },
  'Autophagy Zone': {
    science: 'AMPK activated, mTOR suppressed, cells recycling damaged proteins.',
    tips: ['Black coffee enhances autophagy', 'Rest if you feel low energy'],
    markers: 'AMPK up, mTOR suppressed, autophagy markers elevated',
  },
  'Deep Fast': {
    science: 'Maximum autophagy and fat oxidation, deep repair and regeneration.',
    tips: ['Listen to your body', 'Break fast gently with easily digestible food'],
    markers: 'Peak ketones (BHB 1.0-3.0 mM), inflammation markers low, deep autophagy',
  },
};

interface CheckinRequest {
  sessionId: string;
  fastingHour: number;
  phase: string;
  isPhaseTransition?: boolean;
  streakDays: number;
  personality: string;
  timeOfDay: string;
}

const SYSTEM_PROMPTS: Record<string, string> = {
  motivational: `You are an enthusiastic and warm intermittent fasting coach.
Your style is energetic, positive, and backed by science.
You celebrate every milestone with genuine excitement and use emojis naturally.
Keep responses to 2 sentences maximum.
Acknowledge the current fasting phase, provide encouragement, and mention a real physiological benefit.`,
  calm: `You are a calm and mindful intermittent fasting coach.
Your style is gentle, peaceful, and focused on the present moment.
You often reference breathing, hydration, and body awareness.
No emojis. Keep responses to 2 sentences maximum.
Acknowledge the current fasting phase and offer a grounding, mindful observation.`,
  brutal: `You are a no-nonsense, brutally honest intermittent fasting coach.
Your style is blunt, direct, and completely unsympathetic to excuses.
No emojis. Keep responses to 2 sentences maximum.
Acknowledge the current fasting phase with zero hand-holding and remind the user that discomfort is the point.`,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // --- JWT Authentication ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }
    const userId = user.id;

    // --- Service role client for DB operations ---
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: CheckinRequest = await req.json();
    const { sessionId, fastingHour, phase, isPhaseTransition, streakDays, personality, timeOfDay } = body;

    // --- Input Validation ---
    if (!VALID_PERSONALITIES.includes(personality as typeof VALID_PERSONALITIES[number])) {
      return new Response(
        JSON.stringify({ error: 'Invalid personality. Must be one of: motivational, calm, brutal.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof fastingHour !== 'number' || fastingHour < 0 || fastingHour > 72) {
      return new Response(
        JSON.stringify({ error: 'Invalid fastingHour. Must be a number between 0 and 72.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if (!VALID_PHASES.includes(phase as typeof VALID_PHASES[number])) {
      return new Response(
        JSON.stringify({ error: 'Invalid phase. Must be one of: Fed State, Early Fasting, Fat Burning Begins, Fat Burning Peak, Autophagy Zone, Deep Fast.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if (!VALID_TIMES_OF_DAY.includes(timeOfDay as typeof VALID_TIMES_OF_DAY[number])) {
      return new Response(
        JSON.stringify({ error: 'Invalid timeOfDay. Must be one of: morning, afternoon, evening, night.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof streakDays !== 'number' || !Number.isInteger(streakDays) || streakDays < 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid streakDays. Must be a non-negative integer.' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // --- Rate limiting: rolling 24-hour window ---
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('checkins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('delivered_at', twentyFourHoursAgo);

    if ((count ?? 0) >= MAX_CHECKINS_PER_DAY) {
      return new Response(
        JSON.stringify({ error: 'Daily check-in limit reached.' }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // --- Look up phase data server-side (ignore any client-sent phase data) ---
    const phaseInfo = PHASE_DATA[phase];

    // Build the user prompt with phase biology data
    let userPrompt = `The user is ${fastingHour} hours into their fast.
Current phase: ${phase}.`;

    if (phaseInfo.science) {
      userPrompt += `\nWhat's happening: ${phaseInfo.science}`;
    }
    if (phaseInfo.markers) {
      userPrompt += `\nMetabolic markers: ${phaseInfo.markers}`;
    }
    if (phaseInfo.tips && phaseInfo.tips.length > 0) {
      userPrompt += `\nTips: ${phaseInfo.tips.join(', ')}`;
    }
    if (isPhaseTransition) {
      userPrompt += `\nThe user just entered a new fasting phase — acknowledge this transition.`;
    }

    userPrompt += `\nStreak: ${streakDays} day(s).
Time of day: ${timeOfDay}.
Write a check-in message referencing the biology of their current phase. Max 2 sentences.`;

    // Call OpenAI
    const openAiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[personality] ?? SYSTEM_PROMPTS.motivational },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!openAiResponse.ok) {
      console.error('OpenAI error: status', openAiResponse.status);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable.' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const openAiData = await openAiResponse.json();
    const message: string = openAiData.choices?.[0]?.message?.content?.trim() ?? '';

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Empty response from AI.' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Store check-in in database
    const { error: insertError } = await supabase.from('checkins').insert({
      user_id: userId,
      session_id: sessionId,
      message,
      personality,
      fasting_hour: fastingHour,
    });

    if (insertError) {
      console.error('DB insert error:', insertError);
      // Still return the message even if DB write fails
    }

    return new Response(
      JSON.stringify({ message }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
