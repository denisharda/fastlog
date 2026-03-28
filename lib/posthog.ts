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
    host: 'https://eu.i.posthog.com',
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

export function trackWaterLogged(props: {
  amount_ml: number;
  total_today_ml: number;
}): void {
  posthogInstance?.capture('water_logged', props);
}

export function trackWaterGoalReached(props: {
  goal_ml: number;
}): void {
  posthogInstance?.capture('water_goal_reached', props);
}

export function trackCancellationLinkTapped(): void {
  posthogInstance?.capture('cancellation_link_tapped');
}

export function trackAppLaunched(): void {
  posthogInstance?.capture('app_launched');
}

export function trackPaywallDismissed(source: string): void {
  posthogInstance?.capture('paywall_dismissed', { source });
}

export function trackWaterGoalChanged(params: { old_goal_ml: number; new_goal_ml: number }): void {
  posthogInstance?.capture('water_goal_changed', params);
}

export function trackProtocolChanged(params: { old_protocol: string; new_protocol: string }): void {
  posthogInstance?.capture('protocol_changed', params);
}

export function trackShareSession(): void {
  posthogInstance?.capture('share_session');
}

export function trackHistoryExported(): void {
  posthogInstance?.capture('history_exported');
}
