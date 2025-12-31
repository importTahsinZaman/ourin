/**
 * Test utilities and mock factories for testing.
 */

/**
 * Generate a valid chat token for testing.
 * Uses the same algorithm as the production code.
 */
export async function generateTestToken(
  userId: string,
  secret: string,
  timestamp?: number
): Promise<string> {
  const ts = timestamp ?? Date.now();
  const data = `${userId}:${ts}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return btoa(`${data}:${signatureHex}`);
}

/**
 * Generate a tampered token (wrong signature).
 */
export function generateTamperedToken(
  userId: string,
  timestamp: number
): string {
  const fakeSignature = "00".repeat(32); // 64 hex chars = 32 bytes
  return btoa(`${userId}:${timestamp}:${fakeSignature}`);
}

/**
 * Create a mock SSE stream for testing streaming responses.
 */
export function createMockSSEStream(
  events: Array<{ type: string; data: unknown }>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        const line = `${event.type}:${JSON.stringify(event.data)}\n`;
        controller.enqueue(encoder.encode(line));
      }
      controller.close();
    },
  });
}

/**
 * Create mock text-delta events for testing streaming.
 */
export function createTextDeltaEvents(
  text: string,
  chunkSize = 10
): Array<{ type: string; data: unknown }> {
  const events: Array<{ type: string; data: unknown }> = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    events.push({
      type: "text-delta",
      data: { textDelta: text.slice(i, i + chunkSize) },
    });
  }
  return events;
}

/**
 * Create mock reasoning events for testing.
 */
export function createReasoningEvents(
  text: string,
  id: string = "reasoning-1"
): Array<{ type: string; data: unknown }> {
  return [
    { type: "reasoning-start", data: { id } },
    { type: "reasoning-delta", data: { textDelta: text } },
    { type: "reasoning-end", data: { id } },
  ];
}

/**
 * Wait for a specific duration (for timing tests).
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
