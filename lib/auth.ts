import { supabase } from './supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import { resetRevenueCatUser } from './revenuecat';

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
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
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
