import PostHog from 'posthog-react-native';

let posthogInstance: PostHog | null = null;

/**
 * Initialize PostHog. Call once at app startup.
 */
export function initPostHog(): PostHog | null {
  if (posthogInstance) return posthogInstance;

  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    console.warn('[PostHog] No API key configured — skipping initialization');
    return null;
  }

  posthogInstance = new PostHog(apiKey, {
    host: 'https://app.posthog.com',
  });

  return posthogInstance;
}

export function getPostHog(): PostHog | null {
  return posthogInstance;
}

// ─── Typed event helpers ───────────────────────────────────────────────────

export function trackFastStarted(props: {
  protocol: string;
  targetHours: number;
}): void {
  posthogInstance?.capture('fast_started', props);
}

export function trackFastCompleted(props: {
  protocol: string;
  targetHours: number;
  actualHours: number;
}): void {
  posthogInstance?.capture('fast_completed', props);
}

export function trackFastAbandoned(props: {
  protocol: string;
  targetHours: number;
  hoursCompleted: number;
}): void {
  posthogInstance?.capture('fast_abandoned', props);
}

export function trackPaywallViewed(source: string): void {
  posthogInstance?.capture('paywall_viewed', { source });
}

export function trackProPurchased(props: {
  product: string;
  price: number;
}): void {
  posthogInstance?.capture('pro_purchased', props);
}

export function trackCheckinReceived(props: {
  fastingHour: number;
  personality: string;
}): void {
  posthogInstance?.capture('checkin_received', props);
}
