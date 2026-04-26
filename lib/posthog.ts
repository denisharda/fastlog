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

export function trackFastMoodLogged(props: {
  mood: 'rough' | 'meh' | 'good' | 'great' | 'amazing';
  sessionId: string;
}): void {
  posthogInstance?.capture('fast_mood_logged', {
    mood: props.mood,
    session_id: props.sessionId,
  });
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

export function trackShareSession(props: {
  source: 'history' | 'fast_complete';
  protocol: string;
  completed: boolean;
  duration_h: number;
}): void {
  posthogInstance?.capture('share_session', props);
}

export function trackFastPhaseEntered(props: {
  phase: string;
  elapsed_h: number;
  protocol: string;
  target_hours: number;
}): void {
  posthogInstance?.capture('fast_phase_entered', props);
}

export function trackHistoryViewed(props: {
  total_sessions: number;
  is_pro: boolean;
}): void {
  posthogInstance?.capture('history_viewed', props);
}

export function trackHistorySessionOpened(props: {
  completed: boolean;
  duration_h: number;
  protocol: string;
}): void {
  posthogInstance?.capture('history_session_opened', props);
}

export function trackFastScheduleToggled(enabled: boolean): void {
  posthogInstance?.capture('fast_schedule_toggled', { enabled });
}

export function trackNotificationPrefToggled(props: {
  pref: string;
  enabled: boolean;
}): void {
  posthogInstance?.capture('notification_pref_toggled', props);
}

export function trackSubscriptionRestored(props: { is_pro: boolean }): void {
  posthogInstance?.capture('subscription_restored', props);
}

type UserProperties = Record<string, string | number | boolean | null>;

export function identifyUser(userId: string, properties?: UserProperties): void {
  posthogInstance?.identify(userId, properties);
}

export function updateUserProperties(properties: UserProperties): void {
  // PostHog's canonical "set person properties" pattern.
  posthogInstance?.capture('$set', { $set: properties });
}
