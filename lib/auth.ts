import { supabase } from './supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import { resetRevenueCatUser } from './revenuecat';
import { unregisterDeviceToken } from './deviceTokens';

/**
 * Sign in with Apple. Returns the Supabase session user ID.
 * Profile is auto-created by database trigger.
 */
export async function signInWithApple(): Promise<string> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('No identity token returned from Apple');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });

  if (error) throw error;
  if (!data.user) throw new Error('No user returned from Supabase');

  // Update name if Apple provided it (only on first sign-in)
  const fullName = credential.fullName;
  const name = fullName
    ? [fullName.givenName, fullName.familyName].filter(Boolean).join(' ')
    : null;

  if (name) {
    await supabase
      .from('profiles')
      .update({ name })
      .eq('id', data.user.id);
  }

  return data.user.id;
}

/**
 * Sign in with email + password.
 */
export async function signInWithEmail(email: string, password: string): Promise<string> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error('No user returned');

  return data.user.id;
}

/**
 * Sign up with email + password.
 * Profile is auto-created by database trigger using the name from user metadata.
 */
export async function signUpWithEmail(email: string, password: string, name: string): Promise<string> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name } },
  });

  if (error) throw error;
  if (!data.user) throw new Error('No user returned');

  return data.user.id;
}

/**
 * Send a 6-digit password reset code via email.
 * The Supabase "Reset Password" template must render `{{ .Token }}`.
 */
export async function requestPasswordOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) throw error;
}

/**
 * Exchange the emailed code for a recovery session.
 * After this succeeds, call `updatePassword` to set the new password.
 */
export async function verifyPasswordOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'recovery',
  });
  if (error) throw error;
}

/**
 * Update the signed-in user's password. Requires an active session
 * (including the recovery session produced by `verifyPasswordOtp`).
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  // Best-effort: remove this device's push registration so the user
  // doesn't keep getting notifications on a device they've signed out of.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await unregisterDeviceToken(user.id);
  } catch (e) {
    console.warn('[auth] device token cleanup failed:', e);
  }
  await resetRevenueCatUser();
  await supabase.auth.signOut();
}

/**
 * Fetch the current user's profile from the database.
 */
export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Auth] Failed to fetch profile:', error);
    return null;
  }

  return data;
}
