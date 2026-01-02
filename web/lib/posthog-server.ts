import { PostHog } from "posthog-node";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!POSTHOG_KEY) return null;

  if (!client) {
    client = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return client;
}

/**
 * track an event from server-side code (aPI routes, webhooks).
 * no-op if postHog is not configured.
 */
export async function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  const posthog = getClient();
  if (!posthog) return;

  posthog.capture({ distinctId, event, properties });
  await posthog.flush();
}

/**
 * identify a user from server-side code.
 * no-op if postHog is not configured.
 */
export async function identifyServerUser(
  distinctId: string,
  properties?: Record<string, unknown>
) {
  const posthog = getClient();
  if (!posthog) return;

  posthog.identify({ distinctId, properties });
  await posthog.flush();
}

export async function shutdownPostHog() {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
