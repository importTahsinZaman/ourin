import * as SecureStore from "expo-secure-store";

/**
 * Token storage implementation using expo-secure-store.
 * Used by ConvexAuthProvider to securely store auth tokens.
 *
 * This is more secure than AsyncStorage for sensitive data like auth tokens,
 * as it uses the device's keychain (iOS) or keystore (Android).
 */
export const secureTokenStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(sanitizeKey(key));
    } catch (error) {
      console.warn(`[SecureStorage] Failed to get "${key}":`, error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(sanitizeKey(key), value);
    } catch (error) {
      console.warn(`[SecureStorage] Failed to set "${key}":`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(sanitizeKey(key));
    } catch (error) {
      console.warn(`[SecureStorage] Failed to remove "${key}":`, error);
    }
  },
};

/**
 * Sanitize key for expo-secure-store.
 * Keys can only contain alphanumeric characters, '.', '-', and '_'.
 */
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

/**
 * Secure storage for API keys (BYOK).
 * Uses expo-secure-store for secure key storage.
 */
export const apiKeyStorage = {
  async getKey(provider: string): Promise<string | null> {
    const key = `ourin_api_key_${provider}`;
    return secureTokenStorage.getItem(key);
  },

  async setKey(provider: string, apiKey: string): Promise<void> {
    const key = `ourin_api_key_${provider}`;
    await secureTokenStorage.setItem(key, apiKey);
  },

  async removeKey(provider: string): Promise<void> {
    const key = `ourin_api_key_${provider}`;
    await secureTokenStorage.removeItem(key);
  },

  async getAllKeys(): Promise<Record<string, string>> {
    const providers = ["openai", "anthropic", "google"];
    const keys: Record<string, string> = {};

    for (const provider of providers) {
      const apiKey = await this.getKey(provider);
      if (apiKey) {
        keys[provider] = apiKey;
      }
    }

    return keys;
  },

  async clearAllKeys(): Promise<void> {
    const providers = ["openai", "anthropic", "google"];
    for (const provider of providers) {
      await this.removeKey(provider);
    }
  },
};
