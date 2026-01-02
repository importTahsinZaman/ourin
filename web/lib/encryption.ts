/**
 * aPI key encryption utilities
 *
 * uses aES-gCM for symmetric encryption of user aPI keys.
 * keys are encrypted before storing in the database and decrypted when needed for aPI calls.
 *
 * environment variable required:
 * - aPI_kEY_eNCRYPTION_sECRET: a 32+ character secret for key derivation
 */

const SALT = "ourin-api-key-salt-v1";
const ITERATIONS = 100000;

/**
 * derive an aES-256 key from the encryption secret.
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
 * encrypt an aPI key.
 * returns a base64-encoded string containing the iV and encrypted data.
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

  // generate a random iV for each encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  // combine iV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * decrypt an aPI key.
 * takes a base64-encoded string and returns the original plaintext key.
 */
export async function decryptApiKey(encryptedKey: string): Promise<string> {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET environment variable is not set"
    );
  }

  // decode from base64
  const combined = Uint8Array.from(atob(encryptedKey), (c) => c.charCodeAt(0));

  // extract iV and encrypted data
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
 * get the hint (last 4 characters) from an aPI key.
 * used for display purposes without exposing the full key.
 */
export function getKeyHint(apiKey: string): string {
  if (apiKey.length < 4) return "****";
  return apiKey.slice(-4);
}

/**
 * validate that an aPI key looks valid for a given provider.
 * this is a basic format check, not a verification that the key works.
 */
export function validateKeyFormat(provider: string, apiKey: string): boolean {
  const trimmed = apiKey.trim();

  switch (provider) {
    case "openai":
      // openAI keys start with "sk-" and are typically 51+ characters
      return trimmed.startsWith("sk-") && trimmed.length >= 40;

    case "anthropic":
      // anthropic keys start with "sk-ant-" and are typically 100+ characters
      return trimmed.startsWith("sk-ant-") && trimmed.length >= 40;

    case "google":
      // google aI keys are typically 39 characters starting with "aIza"
      return trimmed.startsWith("AIza") && trimmed.length >= 30;

    default:
      return trimmed.length >= 20;
  }
}
