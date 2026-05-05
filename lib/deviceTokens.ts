import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { getDeviceId } from './deviceId';

/**
 * Upsert this device's push token row. Idempotent — call on every app
 * launch after the user is signed in. If the token hasn't changed, the
 * row is rewritten with a fresh updated_at; that's fine.
 */
export async function registerDeviceToken(
  userId: string,
  pushToken: string
): Promise<void> {
  const deviceId = await getDeviceId();
  const platform = Platform.OS === 'android' ? 'android' : 'ios';
  const appVersion = Constants.expoConfig?.version ?? null;

  const { error } = await supabase.from('device_tokens').upsert(
    {
      user_id: userId,
      device_id: deviceId,
      push_token: pushToken,
      platform,
      app_version: appVersion,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,device_id' }
  );

  if (error) {
    console.error('[deviceTokens] register failed:', error);
    throw error;
  }

  // Sweep stale rows that point at this same Expo push token under a
  // different device_id — they happen when AsyncStorage was wiped (reinstall,
  // "clear app data"), which rotates device_id while Expo keeps issuing the
  // same token. Without this sweep, server fan-out double-delivers.
  const { error: sweepErr } = await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('push_token', pushToken)
    .neq('device_id', deviceId);
  if (sweepErr) {
    console.warn('[deviceTokens] stale-row sweep failed:', sweepErr);
  }

  console.log('[deviceTokens] registered', { userId, deviceId, platform, appVersion });
}

/**
 * Delete this device's row for the given user. Call on sign-out so the
 * server stops fanning out pushes to this device.
 */
export async function unregisterDeviceToken(userId: string): Promise<void> {
  const deviceId = await getDeviceId();
  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('device_id', deviceId);

  if (error) {
    console.warn('[deviceTokens] unregister failed:', error);
  }
}
