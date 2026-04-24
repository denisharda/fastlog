// Supabase Edge Function: notify-fast-event
// Triggered by a Postgres trigger on INSERT into public.fasting_sessions.

import { serve } from 'std/http/server.ts';

serve(async (req) => {
  return new Response('ok', { status: 200 });
});
