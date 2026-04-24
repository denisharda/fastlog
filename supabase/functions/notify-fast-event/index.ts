// Supabase Edge Function: notify-fast-event
// Triggered by a Postgres trigger on INSERT/UPDATE into public.fasting_sessions.

import { serve } from 'std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table?: string;
  record: {
    id: string;
    user_id: string;
    protocol: string;
    target_hours: number;
    started_at: string;
    ended_at: string | null;
    last_modified_by_device: string | null;
  };
  old_record?: { ended_at?: string | null };
}

export interface DeviceTokenRow {
  device_id: string;
  push_token: string;
}

export interface ExpoMessage {
  to: string;
  title?: string;
  body?: string;
  sound?: 'default' | null;
  priority?: 'default' | 'high';
  _contentAvailable?: boolean;
  data: Record<string, unknown>;
}

export interface MessageArgs {
  originDeviceId: string | null;
  protocol: string;
  sessionId: string;
  kind: 'start' | 'end';
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

export function shouldNotify(payload: WebhookPayload): boolean {
  if (payload.type === 'INSERT') {
    return !payload.record.ended_at;
  }
  if (payload.type === 'UPDATE') {
    const oldEnded = (payload.old_record as { ended_at?: string | null } | undefined)?.ended_at;
    return oldEnded == null && payload.record.ended_at != null;
  }
  return false;
}

export function buildExpoMessages(
  tokens: DeviceTokenRow[],
  args: MessageArgs,
): ExpoMessage[] {
  const recipients = args.originDeviceId
    ? tokens.filter((t) => t.device_id !== args.originDeviceId)
    : tokens;

  if (args.kind === 'end') {
    return recipients.map((t) => ({
      to: t.push_token,
      title: 'Fast ended',
      body: `Your ${args.protocol} fast ended on another device.`,
      sound: 'default',
      priority: 'high',
      data: { kind: 'fast_ended', sessionId: args.sessionId },
    }));
  }

  return recipients.map((t) => ({
    to: t.push_token,
    title: 'Fast started',
    body: `Your ${args.protocol} fast is running on another device.`,
    sound: 'default',
    data: { sessionId: args.sessionId, kind: 'fast_started_remote' },
  }));
}

async function sendToExpo(messages: ExpoMessage[]): Promise<Array<{ status: string; id?: string; details?: unknown }>> {
  if (messages.length === 0) return [];
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  };
  if (EXPO_ACCESS_TOKEN) headers['Authorization'] = `Bearer ${EXPO_ACCESS_TOKEN}`;

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[notify-fast-event] Expo push failed', res.status, body);
    return [];
  }
  const payload = await res.json();
  return Array.isArray(payload?.data) ? payload.data : [];
}

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

async function resolveOriginDeviceId(
  supabase: SupabaseLike,
  userId: string,
  claimed: string | null,
): Promise<string | null> {
  if (!claimed) return null;
  const { data } = await supabase
    .from('device_tokens')
    .select('device_id')
    .eq('user_id', userId)
    .eq('device_id', claimed)
    .maybeSingle();
  return data ? claimed : null;
}

async function persistTickets(
  supabase: SupabaseLike,
  tickets: Array<{ status: string; id?: string; details?: unknown }>,
  messages: ExpoMessage[],
  userId: string,
  tokenByAddress: Record<string, string>,
): Promise<void> {
  const rows = tickets
    .map((t, i) => {
      if (t.status !== 'ok' || !t.id) return null;
      const deviceId = tokenByAddress[messages[i].to];
      if (!deviceId) return null;
      return { ticket_id: t.id, user_id: userId, device_id: deviceId };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return;
  const { error } = await supabase.from('push_tickets').insert(rows);
  if (error) console.warn('[notify-fast-event] persistTickets failed:', error);
}

export async function handleRequest(req: Request): Promise<Response> {
  const expectedSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!expectedSecret) {
    console.error('[notify-fast-event] WEBHOOK_SECRET not configured');
    return new Response(JSON.stringify({ error: 'server not configured' }), { status: 500 });
  }
  const provided = req.headers.get('x-webhook-secret');
  if (provided !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  if (!shouldNotify(payload)) {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'missing env' }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: tokens, error } = await supabase
    .from('device_tokens')
    .select('device_id, push_token')
    .eq('user_id', payload.record.user_id);

  if (error) {
    console.error('[notify-fast-event] token query failed', error);
    return new Response(JSON.stringify({ error: 'token query failed' }), { status: 500 });
  }

  const origin = await resolveOriginDeviceId(
    supabase,
    payload.record.user_id,
    payload.record.last_modified_by_device,
  );

  const kind: 'start' | 'end' = payload.type === 'UPDATE' ? 'end' : 'start';

  const messages = buildExpoMessages(tokens ?? [], {
    originDeviceId: origin,
    protocol: payload.record.protocol,
    sessionId: payload.record.id,
    kind,
  });

  const tokenByAddress: Record<string, string> = {};
  for (const t of (tokens ?? [])) tokenByAddress[t.push_token] = t.device_id;

  const tickets = await sendToExpo(messages);
  await persistTickets(supabase, tickets, messages, payload.record.user_id, tokenByAddress);

  return new Response(JSON.stringify({ sent: messages.length }), { status: 200 });
}

if (import.meta.main) {
  serve(handleRequest);
}
