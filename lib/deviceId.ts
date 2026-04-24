import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = 'fastlog.deviceId';

let cached: string | null = null;

/**
 * Returns a stable UUID identifying this app install. Generated once on
 * first launch and persisted in AsyncStorage. Reset by app reinstall.
 *
 * Used as the per-device key in the `device_tokens` table.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    cached = existing;
    return existing;
  }
  const fresh = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
  cached = fresh;
  return fresh;
}
