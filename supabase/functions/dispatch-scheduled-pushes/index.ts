// supabase/functions/dispatch-scheduled-pushes/index.ts
import { serve } from 'std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ScheduledRow {
  id: string;
  user_id: string;
  session_id: string;
  kind: string;
  fire_at: string;
  payload: { title: string; body: string; sessionId: string };
}

export interface DeviceToken {
  push_token: string;
  device_id: string;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  data: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');
const BATCH_LIMIT = 200;

/**
 * Collapse tokens that share the same push_token (different device_id from a
 * stale install) so a single physical device receives one push, not N.
 */
export function dedupTokensByPushToken(tokens: DeviceToken[]): DeviceToken[] {
  const byToken = new Map<string, DeviceToken>();
  for (const t of tokens) {
    if (!byToken.has(t.push_token)) byToken.set(t.push_token, t);
  }
  return Array.from(byToken.values());
}

export function buildMessagesForRow(
  row: ScheduledRow,
  tokens: DeviceToken[],
): ExpoMessage[] {
  return dedupTokensByPushToken(tokens).map((t) => ({
    to: t.push_token,
    title: row.payload.title,
    body: row.payload.body,
    sound: 'default',
    priority: 'high',
    data: { kind: row.kind, sessionId: row.payload.sessionId },
  }));
}

async function sendToExpo(messages: ExpoMessage[]) {
  if (messages.length === 0) return [];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  if (EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${EXPO_ACCESS_TOKEN}`;
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    console.error('[dispatch-scheduled-pushes] expo failed', res.status, await res.text());
    return [];
  }
  const j = await res.json();
  return Array.isArray(j?.data) ? j.data : [];
}

export async function handleRequest(req: Request): Promise<Response> {
  const expectedSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!expectedSecret) {
    return new Response(JSON.stringify({ error: 'server not configured' }), { status: 500 });
  }
  if (req.headers.get('x-webhook-secret') !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'missing env' }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // Grab a batch of due rows. Use `select ... for update skip locked` via
  // an RPC would be ideal, but for a per-minute cron with single worker,
  // a simple fetch + delete is fine and idempotent-enough.
  const { data: due, error } = await supabase
    .from('scheduled_pushes')
    .select('*')
    .lte('fire_at', new Date().toISOString())
    .order('fire_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error('[dispatch-scheduled-pushes] fetch failed', error);
    return new Response(JSON.stringify({ error: 'fetch failed' }), { status: 500 });
  }
  if (!due || due.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // Delete due rows immediately before any Expo call.
  // This is best-effort (pushes may be dropped on Expo failure) and
  // eliminates duplicate-send when a slow minute re-enters the cron window.
  const dueIds = (due as ScheduledRow[]).map((r) => r.id);
  const { error: delErr } = await supabase
    .from('scheduled_pushes')
    .delete()
    .in('id', dueIds);
  if (delErr) {
    console.error('[dispatch-scheduled-pushes] delete failed', delErr);
    return new Response(JSON.stringify({ error: 'delete failed' }), { status: 500 });
  }

  // Group rows by user to minimize token lookups.
  const byUser = new Map<string, ScheduledRow[]>();
  for (const r of due as ScheduledRow[]) {
    const arr = byUser.get(r.user_id) ?? [];
    arr.push(r);
    byUser.set(r.user_id, arr);
  }

  let totalSent = 0;

  for (const [userId, rows] of byUser) {
    const { data: tokens } = await supabase
      .from('device_tokens')
      .select('push_token, device_id')
      .eq('user_id', userId);
    const tokenList = (tokens ?? []) as DeviceToken[];

    for (const row of rows) {
      const messages = buildMessagesForRow(row, tokenList);
      if (messages.length > 0) {
        await sendToExpo(messages);
        totalSent += messages.length;
      }
    }
  }

  return new Response(
    JSON.stringify({ sent: totalSent, processed: dueIds.length }),
    { status: 200 },
  );
}

if (import.meta.main) {
  serve(handleRequest);
}
