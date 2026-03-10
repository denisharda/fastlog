import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_CHECKINS_PER_DAY = 5;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckinRequest {
  userId: string;
  sessionId: string;
  fastingHour: number;
  phase: string;
  streakDays: number;
  personality: 'motivational' | 'calm' | 'brutal';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: CheckinRequest = await req.json();
    const { userId, sessionId, fastingHour, phase, streakDays, personality, timeOfDay } = body;

    // Rate limiting: max 5 check-ins per user per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('checkins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('delivered_at', today.toISOString());

    if ((count ?? 0) >= MAX_CHECKINS_PER_DAY) {
      return new Response(
        JSON.stringify({ error: 'Daily check-in limit reached.' }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Build the user prompt
    const userPrompt = `The user is ${fastingHour} hours into their fast.
Current phase: ${phase}.
Streak: ${streakDays} day(s).
Time of day: ${timeOfDay}.
Write a check-in message. Max 2 sentences.`;

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
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    if (!openAiResponse.ok) {
      const errText = await openAiResponse.text();
      console.error('OpenAI error:', errText);
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
