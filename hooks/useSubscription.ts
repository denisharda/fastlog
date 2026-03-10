import { useEffect, useCallback } from 'react';
import { useUserStore } from '../stores/userStore';
import { getIsProUser } from '../lib/revenuecat';

/**
 * Syncs the user's Pro status from RevenueCat into the user store.
 * Call this hook once near the root of the authenticated app tree.
 */
export function useSubscription() {
  const { isPro, isProLoading, setIsPro, setIsProLoading } = useUserStore();

  const refresh = useCallback(async () => {
    setIsProLoading(true);
    try {
      const pro = await getIsProUser();
      setIsPro(pro);
    } catch (err) {
      console.error('[useSubscription] Failed to check Pro status:', err);
    } finally {
      setIsProLoading(false);
    }
  }, [setIsPro, setIsProLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { isPro, isProLoading, refresh };
}
