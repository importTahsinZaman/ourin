/**
 * API Key Encryption Utilities
 *
 * Uses AES-GCM for symmetric encryption of user API keys.
 * Keys are encrypted before storing in the database and decrypted when needed for API calls.
 *
 * Environment variable required:
 * - API_KEY_ENCRYPTION_SECRET: A 32+ character secret for key derivation
 */

const SALT = "ourin-api-key-salt-v1";
const ITERATIONS = 100000;

/**
 * Derive an AES-256 key from the encryption secret.
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(SALT),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt an API key.
 * Returns a base64-encoded string containing the IV and encrypted data.
 */
export async function encryptApiKey(plainKey: string): Promise<string> {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET environment variable is not set"
    );
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(plainKey);
  const key = await deriveKey(secret);

  // Generate a random IV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an API key.
 * Takes a base64-encoded string and returns the original plaintext key.
 */
export async function decryptApiKey(encryptedKey: string): Promise<string> {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET environment variable is not set"
    );
  }

  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedKey), (c) => c.charCodeAt(0));

  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const key = await deriveKey(secret);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Get the hint (last 4 characters) from an API key.
 * Used for display purposes without exposing the full key.
 */
export function getKeyHint(apiKey: string): string {
  if (apiKey.length < 4) return "****";
  return apiKey.slice(-4);
}

/**
 * Validate that an API key looks valid for a given provider.
 * This is a basic format check, not a verification that the key works.
 */
export function validateKeyFormat(provider: string, apiKey: string): boolean {
  const trimmed = apiKey.trim();

  switch (provider) {
    case "openai":
      // OpenAI keys start with "sk-" and are typically 51+ characters
      return trimmed.startsWith("sk-") && trimmed.length >= 40;

    case "anthropic":
      // Anthropic keys start with "sk-ant-" and are typically 100+ characters
      return trimmed.startsWith("sk-ant-") && trimmed.length >= 40;

    case "google":
      // Google AI keys are typically 39 characters starting with "AIza"
      return trimmed.startsWith("AIza") && trimmed.length >= 30;

    default:
      return trimmed.length >= 20;
  }
}
