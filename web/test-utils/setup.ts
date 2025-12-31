import { vi, beforeEach } from "vitest";

// Mock environment variables for tests
// Set SELF_HOSTING=false to enable production mode features (billing, Stripe, etc.)
// This ensures tests cover the full SaaS functionality
process.env.SELF_HOSTING = "false";
process.env.CHAT_AUTH_SECRET = "test-secret-key-for-testing-purposes";
process.env.COST_MARKUP = "1.0";
process.env.SUBSCRIPTION_CREDITS = "10000";
process.env.CREDIT_PACK_AMOUNT = "20000";

// Mock localStorage for browser-like tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
