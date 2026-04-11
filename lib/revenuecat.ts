import { Platform } from 'react-native';

export const PRO_ENTITLEMENT = 'FastBuddy Pro';

export const PRODUCT_IDS = {
  monthly: 'monthly',
  annual: 'yearly',
} as const;

// Lazy-load Purchases only on iOS to avoid crash on Android/Huawei without GMS
function getPurchases() {
  if (Platform.OS !== 'ios') return null;
  try {
    return require('react-native-purchases').default;
  } catch {
    return null;
  }
}

function getLogLevel() {
  try {
    return require('react-native-purchases').LOG_LEVEL;
  } catch {
    return null;
  }
}

// Re-export the type for paywall usage
export type { PurchasesPackage } from 'react-native-purchases';

let configured = false;

/**
 * Whether RevenueCat has been configured. Guards calls that require the singleton.
 */
export function isRevenueCatConfigured(): boolean {
  return configured;
}

/**
 * Initialize RevenueCat SDK. Call once at app startup (before auth).
 */
export function initRevenueCat(): void {
  const Purchases = getPurchases();
  if (!Purchases) return;

  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  if (!apiKey) {
    console.warn('[RevenueCat] No API key configured — skipping initialization');
    return;
  }

  if (__DEV__) {
    const LOG_LEVEL = getLogLevel();
    if (LOG_LEVEL) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({ apiKey });
  configured = true;
}

/**
 * Identify the current user to RevenueCat after sign-in.
 */
export async function identifyRevenueCatUser(userId: string): Promise<void> {
  const Purchases = getPurchases();
  if (!Purchases) return;
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.error('[RevenueCat] Failed to identify user:', error);
  }
}

/**
 * Reset RevenueCat user on sign-out.
 */
export async function resetRevenueCatUser(): Promise<void> {
  const Purchases = getPurchases();
  if (!Purchases) return;
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('[RevenueCat] Failed to reset user:', error);
  }
}

/**
 * Check if the current user has an active Pro entitlement.
 */
export async function getIsProUser(): Promise<boolean> {
  if (!configured) return false;
  const Purchases = getPurchases();
  if (!Purchases) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
  } catch (error) {
    console.error('[RevenueCat] Failed to get customer info:', error);
    return false;
  }
}

/**
 * Fetch available packages from RevenueCat.
 */
export async function getOfferings(): Promise<any[]> {
  if (!configured) return [];
  const Purchases = getPurchases();
  if (!Purchases) return [];
  try {
    const offerings = await Purchases.getOfferings();
    if (__DEV__) {
      console.log('[RevenueCat] Offerings:', JSON.stringify(offerings.current, null, 2));
    }
    return offerings.current?.availablePackages ?? [];
  } catch (error) {
    console.error('[RevenueCat] Failed to get offerings:', error);
    return [];
  }
}

/**
 * Purchase a package and return whether the user is now Pro.
 */
export async function purchasePackage(
  pkg: any
): Promise<{ success: boolean; isPro: boolean }> {
  const Purchases = getPurchases();
  if (!Purchases) return { success: false, isPro: false };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const isPro = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
    return { success: true, isPro };
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'userCancelled' in error &&
      (error as { userCancelled: boolean }).userCancelled
    ) {
      return { success: false, isPro: false };
    }
    console.error('[RevenueCat] Purchase failed:', error);
    return { success: false, isPro: false };
  }
}

/**
 * Restore previous purchases and return whether the user is now Pro.
 */
export async function restorePurchases(): Promise<boolean> {
  const Purchases = getPurchases();
  if (!Purchases) return false;
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
  } catch (error) {
    console.error('[RevenueCat] Restore failed:', error);
    return false;
  }
}
