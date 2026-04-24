// Supabase Edge Function: reap-push-receipts
// Called on a pg_cron schedule (every 15 min). Polls Expo for delivery
// receipts for tickets we sent ≥15 min ago, prunes DeviceNotRegistered
// tokens, and deletes processed ticket rows.

import { serve } from 'std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');
const MAX_IDS_PER_CALL = 1000;
const AGE_MIN = 15;

export interface TicketRow {
  ticket_id: string;
  user_id: string;
  device_id: string;
}

export interface ReceiptEntry {
  status: 'ok' | 'error';
  details?: { error?: string };
}

export type ReceiptClassification =
  | 'ok'
  | 'device_not_registered'
  | 'other_error'
  | 'pending';

export function classify(entry: ReceiptEntry | undefined): ReceiptClassification {
  if (!entry) return 'pending';
  if (entry.status === 'ok') return 'ok';
  if (entry.details?.error === 'DeviceNotRegistered') return 'device_not_registered';
  return 'other_error';
}

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export async function handleRequest(req: Request): Promise<Response> {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  const provided = req.headers.get('x-webhook-secret');
  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'missing env' }), { status: 500 });
  }

  const supabase: SupabaseLike = createClient(supabaseUrl, serviceKey);
  const cutoff = new Date(Date.now() - AGE_MIN * 60 * 1000).toISOString();

  const { data: tickets, error } = await supabase
    .from('push_tickets')
    .select('ticket_id, user_id, device_id')
    .lte('sent_at', cutoff)
    .limit(MAX_IDS_PER_CALL);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!tickets || tickets.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  const ids = (tickets as TicketRow[]).map((t) => t.ticket_id);
  const receiptsRes = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify({ ids }),
  });
  if (!receiptsRes.ok) {
    const body = await receiptsRes.text();
    return new Response(JSON.stringify({ error: 'expo', details: body }), { status: 502 });
  }
  const payload = await receiptsRes.json();
  const receipts: Record<string, ReceiptEntry> = payload.data ?? {};

  let pruned = 0;
  let ok = 0;
  let other = 0;
  const ticketIdsToDelete: string[] = [];

  for (const t of tickets as TicketRow[]) {
    const outcome = classify(receipts[t.ticket_id]);
    if (outcome === 'pending') continue;
    ticketIdsToDelete.push(t.ticket_id);
    if (outcome === 'device_not_registered') {
      const { error: delErr } = await supabase
        .from('device_tokens')
        .delete()
        .eq('user_id', t.user_id)
        .eq('device_id', t.device_id);
      if (!delErr) pruned++;
    } else if (outcome === 'ok') {
      ok++;
    } else {
      other++;
    }
  }

  if (ticketIdsToDelete.length > 0) {
    await supabase.from('push_tickets').delete().in('ticket_id', ticketIdsToDelete);
  }

  return new Response(
    JSON.stringify({ processed: ticketIdsToDelete.length, ok, pruned, other }),
    { status: 200 },
  );
}

if (import.meta.main) {
  serve(handleRequest);
}
