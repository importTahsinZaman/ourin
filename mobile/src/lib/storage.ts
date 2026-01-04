import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Storage keys used throughout the app
 */
export const STORAGE_KEYS = {
  DRAFTS: "ourin-chat-drafts",
  ATTACHMENT_DRAFTS: "ourin-chat-attachment-drafts",
  LOCAL_CORES: "ourin-local-cores",
  SELECTED_MODEL: "ourin-selected-model",
  THEME: "ourin-theme",
  THEME_ID: "ourin-theme-id",
  CUSTOM_THEMES: "ourin-custom-themes",
  FONT_ID: "ourin-font-id",
  FIRST_VISIT: "ourin-first-visit-complete",
  ACTIVE_CORES_COUNT: "ourin-active-cores-count",
} as const;

/**
 * Async storage wrapper with JSON serialization and error handling.
 * Provides a consistent API for persisting data in React Native.
 */
export const storage = {
  /**
   * Get a string value from storage
   */
  async getString(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn(`[Storage] Failed to get "${key}":`, error);
      return null;
    }
  },

  /**
   * Set a string value in storage
   */
  async setString(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn(`[Storage] Failed to set "${key}":`, error);
    }
  },

  /**
   * Get a JSON value from storage
   */
  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn(`[Storage] Failed to parse "${key}":`, error);
      return null;
    }
  },

  /**
   * Set a JSON value in storage
   */
  async setJSON<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[Storage] Failed to stringify "${key}":`, error);
    }
  },

  /**
   * Remove a value from storage
   */
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn(`[Storage] Failed to remove "${key}":`, error);
    }
  },

  /**
   * Clear all app storage (use with caution)
   */
  async clear(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
    } catch (error) {
      console.warn("[Storage] Failed to clear storage:", error);
    }
  },
};

/**
 * Draft message storage utilities
 */
export const draftStorage = {
  /**
   * Get the draft key for a conversation (null = new chat)
   */
  getKey(conversationId: string | null | undefined): string {
    return conversationId || "__new__";
  },

  /**
   * Load a draft for a conversation
   */
  async load(conversationId: string | null | undefined): Promise<string> {
    const drafts = await storage.getJSON<Record<string, string>>(
      STORAGE_KEYS.DRAFTS
    );
    if (!drafts) return "";
    return drafts[this.getKey(conversationId)] || "";
  },

  /**
   * Save a draft for a conversation
   */
  async save(
    conversationId: string | null | undefined,
    text: string
  ): Promise<void> {
    const drafts =
      (await storage.getJSON<Record<string, string>>(STORAGE_KEYS.DRAFTS)) ||
      {};
    const key = this.getKey(conversationId);

    if (text.trim()) {
      drafts[key] = text;
    } else {
      delete drafts[key];
    }

    await storage.setJSON(STORAGE_KEYS.DRAFTS, drafts);
  },

  /**
   * Clear a draft for a conversation
   */
  async clear(conversationId: string | null | undefined): Promise<void> {
    await this.save(conversationId, "");
  },

  /**
   * Clear all drafts
   */
  async clearAll(): Promise<void> {
    await storage.remove(STORAGE_KEYS.DRAFTS);
  },
};

/**
 * Model selection storage utilities
 */
export const modelStorage = {
  async getSelectedModel(): Promise<string | null> {
    return storage.getString(STORAGE_KEYS.SELECTED_MODEL);
  },

  async setSelectedModel(modelId: string): Promise<void> {
    await storage.setString(STORAGE_KEYS.SELECTED_MODEL, modelId);
  },
};

/**
 * Theme storage utilities
 */
export const themeStorage = {
  async getTheme(): Promise<"light" | "dark" | "system" | null> {
    const theme = await storage.getString(STORAGE_KEYS.THEME);
    if (theme === "light" || theme === "dark" || theme === "system") {
      return theme;
    }
    return null;
  },

  async setTheme(theme: "light" | "dark" | "system"): Promise<void> {
    await storage.setString(STORAGE_KEYS.THEME, theme);
  },
};
