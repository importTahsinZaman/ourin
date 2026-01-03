import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AsyncStorage before importing the module
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  storage,
  draftStorage,
  themeStorage,
  modelStorage,
  STORAGE_KEYS,
} from "@/lib/storage";

describe("storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("storage.getJSON", () => {
    it("parses valid JSON", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        '{"name":"test","value":123}'
      );

      const result = await storage.getJSON<{ name: string; value: number }>(
        "key"
      );

      expect(result).toEqual({ name: "test", value: 123 });
    });

    it("returns null for null storage value", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await storage.getJSON("key");

      expect(result).toBeNull();
    });

    it("returns null for malformed JSON", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("{invalid json");

      const result = await storage.getJSON("key");

      expect(result).toBeNull();
    });

    it("returns null for empty string", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("");

      const result = await storage.getJSON("key");

      // Empty string is not valid JSON, should return null
      expect(result).toBeNull();
    });

    it("handles arrays correctly", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("[1, 2, 3]");

      const result = await storage.getJSON<number[]>("key");

      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe("storage.setJSON", () => {
    it("serializes objects to JSON", async () => {
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await storage.setJSON("key", { name: "test", value: 123 });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "key",
        '{"name":"test","value":123}'
      );
    });

    it("serializes arrays to JSON", async () => {
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await storage.setJSON("key", [1, 2, 3]);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("key", "[1,2,3]");
    });

    it("handles null values", async () => {
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await storage.setJSON("key", null);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith("key", "null");
    });

    it("silently handles errors", async () => {
      vi.mocked(AsyncStorage.setItem).mockRejectedValue(
        new Error("Storage full")
      );

      // Should not throw
      await expect(
        storage.setJSON("key", { data: "test" })
      ).resolves.toBeUndefined();
    });
  });
});

describe("draftStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getKey", () => {
    it("returns __new__ for null conversationId", () => {
      expect(draftStorage.getKey(null)).toBe("__new__");
    });

    it("returns __new__ for undefined conversationId", () => {
      expect(draftStorage.getKey(undefined)).toBe("__new__");
    });

    it("returns conversationId for valid string", () => {
      expect(draftStorage.getKey("conv-123")).toBe("conv-123");
    });

    it("returns conversationId for UUID", () => {
      const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      expect(draftStorage.getKey(uuid)).toBe(uuid);
    });
  });

  describe("load", () => {
    it("returns empty string when no drafts exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await draftStorage.load("conv-123");

      expect(result).toBe("");
    });

    it("returns empty string when draft key does not exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify({ "other-conv": "some text" })
      );

      const result = await draftStorage.load("conv-123");

      expect(result).toBe("");
    });

    it("returns draft text when it exists", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify({ "conv-123": "Hello, world!" })
      );

      const result = await draftStorage.load("conv-123");

      expect(result).toBe("Hello, world!");
    });

    it("uses __new__ key for null conversationId", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify({ __new__: "New chat draft" })
      );

      const result = await draftStorage.load(null);

      expect(result).toBe("New chat draft");
    });

    it("handles malformed JSON gracefully", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("{invalid");

      const result = await draftStorage.load("conv-123");

      expect(result).toBe("");
    });
  });

  describe("save", () => {
    it("saves draft text for conversation", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await draftStorage.save("conv-123", "Hello, world!");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.DRAFTS,
        JSON.stringify({ "conv-123": "Hello, world!" })
      );
    });

    it("preserves existing drafts when saving new one", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify({ "other-conv": "other draft" })
      );
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await draftStorage.save("conv-123", "New draft");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.DRAFTS,
        JSON.stringify({
          "other-conv": "other draft",
          "conv-123": "New draft",
        })
      );
    });

    it("deletes draft when text is empty", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify({ "conv-123": "existing draft" })
      );
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await draftStorage.save("conv-123", "");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.DRAFTS,
        JSON.stringify({})
      );
    });

    it("deletes draft when text is whitespace only", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify({ "conv-123": "existing draft" })
      );
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await draftStorage.save("conv-123", "   \n\t  ");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.DRAFTS,
        JSON.stringify({})
      );
    });

    it("uses __new__ key for null conversationId", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await draftStorage.save(null, "New chat message");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.DRAFTS,
        JSON.stringify({ __new__: "New chat message" })
      );
    });

    it("overwrites existing draft", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify({ "conv-123": "old draft" })
      );
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await draftStorage.save("conv-123", "new draft");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.DRAFTS,
        JSON.stringify({ "conv-123": "new draft" })
      );
    });
  });

  describe("clear", () => {
    it("removes draft for specific conversation", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify({
          "conv-123": "draft to delete",
          "conv-456": "keep this",
        })
      );
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await draftStorage.clear("conv-123");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.DRAFTS,
        JSON.stringify({ "conv-456": "keep this" })
      );
    });
  });
});

describe("themeStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTheme", () => {
    it('returns "light" for valid light theme', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("light");

      const result = await themeStorage.getTheme();

      expect(result).toBe("light");
    });

    it('returns "dark" for valid dark theme', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("dark");

      const result = await themeStorage.getTheme();

      expect(result).toBe("dark");
    });

    it('returns "system" for valid system theme', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("system");

      const result = await themeStorage.getTheme();

      expect(result).toBe("system");
    });

    it("returns null for null storage value", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const result = await themeStorage.getTheme();

      expect(result).toBeNull();
    });

    it("returns null for invalid theme string", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("invalid-theme");

      const result = await themeStorage.getTheme();

      expect(result).toBeNull();
    });

    it("returns null for empty string", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("");

      const result = await themeStorage.getTheme();

      expect(result).toBeNull();
    });

    it("returns null for typo in theme name", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("Light"); // capital L

      const result = await themeStorage.getTheme();

      expect(result).toBeNull();
    });
  });

  describe("setTheme", () => {
    it("stores theme value", async () => {
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await themeStorage.setTheme("dark");

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.THEME,
        "dark"
      );
    });
  });
});

describe("modelStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getSelectedModel returns stored model", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue("gpt-4o");

    const result = await modelStorage.getSelectedModel();

    expect(result).toBe("gpt-4o");
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(
      STORAGE_KEYS.SELECTED_MODEL
    );
  });

  it("setSelectedModel stores model", async () => {
    vi.mocked(AsyncStorage.setItem).mockResolvedValue();

    await modelStorage.setSelectedModel("claude-3-opus");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.SELECTED_MODEL,
      "claude-3-opus"
    );
  });
});
