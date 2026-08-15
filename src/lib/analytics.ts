/**
 * Owner-facing analytics — the 5-event taxonomy.
 *
 * Every fleet project emits these five events — page_view, signup, activated,
 * core_action, returned — so a single PostHog project can build one
 * cross-fleet funnel and retention insights.
 *
 * Every event carries project_id: "calorie".
 */
const PROJECT = 'calorie' as const;
const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_KEY ?? 'phc_qgiAarw4Co4pw9fz3Fxj4UJaHmqzFetqs4JrXhGc35Nd';
const POSTHOG_HOST = 'https://us.i.posthog.com';

/** The product-specific action behind a core_action event. */
export type CoreAction = 'journal_saved' | 'food_logged' | 'weight_logged';

interface AnalyticsEventMap {
  page_view: { project_id: typeof PROJECT };
  signup: { project_id: typeof PROJECT };
  activated: { project_id: typeof PROJECT };
  core_action: { project_id: typeof PROJECT; action: CoreAction };
  returned: { project_id: typeof PROJECT };
}

async function capture(event: string, properties: Record<string, unknown>) {
  const { default: posthog } = await import('posthog-js');
  posthog.capture(event, properties);
}

export function trackEvent(event: string, properties: Record<string, unknown> = {}): void {
  try {
    if (typeof window === 'undefined') return;
    void capture(event, { project_id: PROJECT, ...properties });
  } catch {
    // Analytics must never break a user flow.
  }
}

function emit<K extends keyof AnalyticsEventMap>(
  event: K,
  props: Omit<AnalyticsEventMap[K], 'project_id'>
): void {
  trackEvent(event, props);
}

export function trackPageView(): void {
  emit('page_view', {});
}
export function trackSignup(): void {
  emit('signup', {});
}
export function trackActivated(): void {
  emit('activated', {});
}
export function trackCoreAction(action: CoreAction): void {
  emit('core_action', { action });
}
export function trackReturned(): void {
  emit('returned', {});
}

export function initPosthog(): () => void {
  if (typeof window === 'undefined') return () => {};
  void import('posthog-js').then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: 'always',
      capture_pageview: false,
      autocapture: false,
    });
  });
  return () => {};
}
