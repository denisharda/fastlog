const REQUIRED_ENV_VARS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_REVENUECAT_IOS_KEY',
  'EXPO_PUBLIC_POSTHOG_KEY',
] as const;

/**
 * Validates that all required EXPO_PUBLIC_* environment variables are set.
 * Logs warnings for missing vars instead of crashing.
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `[validateEnv] Missing environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n` +
      'Some features may not work correctly.'
    );
  }
}
