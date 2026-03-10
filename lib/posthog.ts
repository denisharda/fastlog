import PostHog from 'posthog-react-native';

let posthogInstance: PostHog | null = null;

/**
 * Initialize PostHog. Call once at app startup.
 */
export function initPostHog(): PostHog {
  if (posthogInstance) return posthogInstance;

  posthogInstance = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY!, {
    host: 'https://app.posthog.com',
    disabled: !process.env.EXPO_PUBLIC_POSTHOG_KEY,
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
