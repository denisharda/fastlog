// Supabase Edge Function: notify-fast-event
// Triggered by a Postgres trigger on INSERT into public.fasting_sessions.

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
  old_record?: unknown;
}

export interface DeviceTokenRow {
  device_id: string;
  push_token: string;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export function shouldNotify(payload: WebhookPayload): boolean {
  // Only fan out on a brand-new, still-active fast.
  return payload.type === 'INSERT' && !payload.record.ended_at;
}

export function buildExpoMessages(
  tokens: DeviceTokenRow[],
  args: { originDeviceId: string | null; protocol: string; sessionId: string }
): ExpoMessage[] {
  const recipients = args.originDeviceId
    ? tokens.filter((t) => t.device_id !== args.originDeviceId)
    : tokens;

  return recipients.map((t) => ({
    to: t.push_token,
    title: 'Fast started',
    body: `Your ${args.protocol} fast is running on another device.`,
    sound: 'default',
    data: { sessionId: args.sessionId, kind: 'fast_started_remote' },
  }));
}

async function sendToExpo(messages: ExpoMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[notify-fast-event] Expo push failed', res.status, body);
  }
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

  const messages = buildExpoMessages(tokens ?? [], {
    originDeviceId: payload.record.last_modified_by_device,
    protocol: payload.record.protocol,
    sessionId: payload.record.id,
  });

  await sendToExpo(messages);

  return new Response(JSON.stringify({ sent: messages.length }), { status: 200 });
}

if (import.meta.main) {
  serve(handleRequest);
}
