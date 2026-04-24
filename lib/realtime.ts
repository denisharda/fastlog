// lib/realtime.ts
// Supabase Realtime subscription: delivers per-row events for this user's
// fasting_sessions + hydration_logs while the app is foregrounded. Handlers
// dispatch to the same helpers that syncWithRemote uses, so background
// fetch-on-open and live websocket events take identical code paths.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useUserStore } from '../stores/userStore';
import { useHydrationStore, LocalHydrationLog } from '../stores/hydrationStore';
import { applyActiveSession } from './sessionAdoption';
import { endActiveFast, syncWithRemote } from './endFast';
import { getDeviceId } from './deviceId';
import type { FastingProtocol } from '../types';

let channel: RealtimeChannel | null = null;
let ownDeviceId: string | null = null;
let stopPromise: Promise<void> | null = null;

async function ensureDeviceId(): Promise<string> {
  if (!ownDeviceId) ownDeviceId = await getDeviceId();
  return ownDeviceId;
}

interface FastingSessionRow {
  id: string;
  user_id: string;
  protocol: FastingProtocol;
  target_hours: number;
  started_at: string;
  ended_at: string | null;
  last_modified_by_device: string | null;
}

interface HydrationLogRow {
  id: string;
  user_id: string;
  amount_ml: number;
  logged_at: string;
}

async function handleFastingInsert(row: FastingSessionRow) {
  const deviceId = await ensureDeviceId();
  if (row.last_modified_by_device === deviceId) return; // own echo
  if (row.ended_at) return; // already-ended on insert — shouldn't happen but safe
  await applyActiveSession(
    {
      sessionId: row.id,
      protocol: row.protocol,
      targetHours: row.target_hours,
      startedAt: row.started_at,
    },
    { isFreshStart: false },
  );
}

async function handleFastingUpdate(row: FastingSessionRow) {
  const deviceId = await ensureDeviceId();
  if (row.last_modified_by_device === deviceId) return; // own echo
  if (!row.ended_at) return; // only act on end transitions
  await endActiveFast();
}

async function handleHydrationInsert(row: HydrationLogRow) {
  const { applyRemoteLog } = useHydrationStore.getState();
  applyRemoteLog({
    id: row.id,
    amount_ml: row.amount_ml,
    logged_at: row.logged_at,
  } satisfies LocalHydrationLog);
}

function handleHydrationDelete(row: Pick<HydrationLogRow, 'id'>) {
  const { removeLogById } = useHydrationStore.getState();
  removeLogById(row.id);
}

/**
 * Open a realtime channel subscribed to this user's fasting_sessions and
 * hydration_logs. Safe to call repeatedly — no-op if already subscribed.
 * On reconnect (after a transient network drop) we run a full reconcile
 * to close any gap that happened while the socket was down.
 *
 * If stopRealtime is in flight (e.g. during a user switch), we wait for it
 * to complete before opening a new channel to avoid a leaked subscription.
 */
export async function startRealtime(): Promise<void> {
  if (stopPromise) await stopPromise;
  if (channel) return;
  const userId = useUserStore.getState().profile?.id;
  if (!userId) return;
  await ensureDeviceId();

  channel = supabase
    .channel(`user:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'fasting_sessions', filter: `user_id=eq.${userId}` },
      (p) => void handleFastingInsert(p.new as FastingSessionRow),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'fasting_sessions', filter: `user_id=eq.${userId}` },
      (p) => void handleFastingUpdate(p.new as FastingSessionRow),
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'hydration_logs', filter: `user_id=eq.${userId}` },
      (p) => void handleHydrationInsert(p.new as HydrationLogRow),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'hydration_logs', filter: `user_id=eq.${userId}` },
      (p) => handleHydrationDelete(p.old as HydrationLogRow),
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Full reconcile on (re)connect — catches anything we missed.
        void syncWithRemote();
      }
    });
}

export function stopRealtime(): Promise<void> {
  if (stopPromise) return stopPromise;
  if (!channel) return Promise.resolve();
  const closing = channel;
  channel = null; // null eagerly so startRealtime idempotency check doesn't re-enter
  stopPromise = supabase.removeChannel(closing).then(() => {
    ownDeviceId = null;
  }).finally(() => {
    stopPromise = null;
  });
  return stopPromise;
}
