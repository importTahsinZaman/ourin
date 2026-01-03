import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock expo-secure-store before importing the module
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import * as SecureStore from "expo-secure-store";
import { secureTokenStorage, apiKeyStorage } from "@/lib/secureStorage";

describe("secureStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sanitizeKey (tested via secureTokenStorage)", () => {
    it("preserves alphanumeric characters", async () => {
      await secureTokenStorage.setItem("abc123", "value");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("abc123", "value");
    });

    it("preserves dots, dashes, and underscores", async () => {
      await secureTokenStorage.setItem("my-key.test_123", "value");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "my-key.test_123",
        "value"
      );
    });

    it("replaces special characters with underscores", async () => {
      await secureTokenStorage.setItem("key@#$%^&*()", "value");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "key_________",
        "value"
      );
    });

    it("replaces spaces with underscores", async () => {
      await secureTokenStorage.setItem("my key name", "value");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "my_key_name",
        "value"
      );
    });

    it("replaces unicode/emoji with underscores", async () => {
      await secureTokenStorage.setItem("key🔑emoji", "value");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "key__emoji",
        "value"
      );
    });

    it("handles empty string", async () => {
      await secureTokenStorage.setItem("", "value");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("", "value");
    });

    it("handles URLs (common in Convex storage namespace)", async () => {
      await secureTokenStorage.setItem("https://example.convex.cloud", "token");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "https___example.convex.cloud",
        "token"
      );
    });
  });

  describe("secureTokenStorage", () => {
    it("getItem returns value from SecureStore", async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValue("stored-value");

      const result = await secureTokenStorage.getItem("test-key");

      expect(result).toBe("stored-value");
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith("test-key");
    });

    it("getItem returns null on error", async () => {
      vi.mocked(SecureStore.getItemAsync).mockRejectedValue(
        new Error("Storage error")
      );

      const result = await secureTokenStorage.getItem("test-key");

      expect(result).toBeNull();
    });

    it("setItem calls SecureStore.setItemAsync", async () => {
      vi.mocked(SecureStore.setItemAsync).mockResolvedValue();

      await secureTokenStorage.setItem("key", "value");

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("key", "value");
    });

    it("setItem silently handles errors", async () => {
      vi.mocked(SecureStore.setItemAsync).mockRejectedValue(
        new Error("Storage full")
      );

      // Should not throw
      await expect(
        secureTokenStorage.setItem("key", "value")
      ).resolves.toBeUndefined();
    });

    it("removeItem calls SecureStore.deleteItemAsync", async () => {
      vi.mocked(SecureStore.deleteItemAsync).mockResolvedValue();

      await secureTokenStorage.removeItem("key");

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("key");
    });
  });

  describe("apiKeyStorage", () => {
    it("getKey formats key correctly", async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValue("sk-test-key");

      const result = await apiKeyStorage.getKey("openai");

      expect(result).toBe("sk-test-key");
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith(
        "ourin_api_key_openai"
      );
    });

    it("setKey formats key correctly", async () => {
      vi.mocked(SecureStore.setItemAsync).mockResolvedValue();

      await apiKeyStorage.setKey("anthropic", "sk-ant-key");

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        "ourin_api_key_anthropic",
        "sk-ant-key"
      );
    });

    it("removeKey formats key correctly", async () => {
      vi.mocked(SecureStore.deleteItemAsync).mockResolvedValue();

      await apiKeyStorage.removeKey("google");

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "ourin_api_key_google"
      );
    });

    it("getAllKeys returns all stored keys", async () => {
      vi.mocked(SecureStore.getItemAsync)
        .mockResolvedValueOnce("sk-openai") // openai
        .mockResolvedValueOnce(null) // anthropic
        .mockResolvedValueOnce("sk-google"); // google

      const result = await apiKeyStorage.getAllKeys();

      expect(result).toEqual({
        openai: "sk-openai",
        google: "sk-google",
      });
      // anthropic should not be in result since it was null
      expect(result.anthropic).toBeUndefined();
    });

    it("getAllKeys returns empty object when no keys stored", async () => {
      vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

      const result = await apiKeyStorage.getAllKeys();

      expect(result).toEqual({});
    });

    it("getAllKeys handles partial failures gracefully", async () => {
      vi.mocked(SecureStore.getItemAsync)
        .mockResolvedValueOnce("sk-openai") // openai succeeds
        .mockRejectedValueOnce(new Error("Failed")) // anthropic fails
        .mockResolvedValueOnce("sk-google"); // google succeeds

      const result = await apiKeyStorage.getAllKeys();

      // Should still return the keys that succeeded
      expect(result).toEqual({
        openai: "sk-openai",
        google: "sk-google",
      });
    });
  });
});
