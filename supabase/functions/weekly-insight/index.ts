import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '', // No web origin allowed — mobile app only
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Fetch profile for personalization
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, coach_personality, preferred_protocol')
      .eq('id', userId)
      .single();

    // Fetch last 7 days of fasting sessions
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: sessions } = await supabase
      .from('fasting_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', sevenDaysAgo.toISOString())
      .order('started_at', { ascending: false });

    const totalFasts = sessions?.length ?? 0;
    const completedFasts = sessions?.filter((s) => s.completed).length ?? 0;
    const totalHours = sessions?.reduce((acc, s) => {
      if (!s.ended_at) return acc;
      return acc + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000;
    }, 0) ?? 0;

    // Sanitize profile name: strip non-alphanumeric/space chars, truncate to 50
    const safeName = (profile?.name ?? 'User').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50);

    const prompt = `The user ${safeName} completed ${completedFasts} out of ${totalFasts} planned fasts this week, totaling ${totalHours.toFixed(1)} hours of fasting.
Their preferred protocol is ${profile?.preferred_protocol ?? '16:8'}.
Write a 2-3 sentence weekly summary and encouragement in a ${profile?.coach_personality ?? 'motivational'} tone.`;

    const openAiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a supportive fasting coach providing weekly progress summaries. Be concise (2-3 sentences).',
          },
          { role: 'user', content: prompt },
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
    const insight: string = openAiData.choices?.[0]?.message?.content?.trim() ?? '';

    return new Response(
      JSON.stringify({
        insight,
        stats: { totalFasts, completedFasts, totalHours: parseFloat(totalHours.toFixed(1)) },
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('weekly-insight error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error.' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
