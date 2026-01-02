import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * generate a short-lived token for users to call the chat aPI.
 * the token is an hMAC signature that proves the user's identity at generation time.
 * with anonymous auth, all users should have a real userId.
 */
export const generateChatToken = mutation({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    token: string;
    timestamp: number;
    isAuthenticated: boolean;
  }> => {
    const userId = await getAuthUserId(ctx);

    // due to anonymous auth, userId should always exist
    if (!userId) {
      throw new Error("Not authenticated - please sign in");
    }

    const timestamp = Date.now();
    const secret = process.env.CHAT_AUTH_SECRET;

    if (!secret) {
      throw new Error("CHAT_AUTH_SECRET environment variable is not set");
    }

    // create a simple token: base64(userId:timestamp:signature)
    const data = `${userId}:${timestamp}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(data)
    );
    const signatureHex = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const token = btoa(`${data}:${signatureHex}`);

    // all users are authenticated now (including anonymous)
    return { token, timestamp, isAuthenticated: true };
  },
});

/**
 * verify a chat token. this is exported for use in the aPI route.
 */
export async function verifyChatToken(
  token: string,
  secret: string
): Promise<{ valid: boolean; userId?: string }> {
  try {
    const decoded = atob(token);
    const [userId, timestampStr, signature] = decoded.split(":");
    const timestamp = parseInt(timestampStr, 10);

    // check token is not expired (5 minute validity)
    const now = Date.now();
    if (now - timestamp > 300000) {
      return { valid: false };
    }

    // verify signature
    const data = `${userId}:${timestamp}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expectedSignature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(data)
    );
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expectedHex) {
      return { valid: false };
    }

    return { valid: true, userId };
  } catch {
    return { valid: false };
  }
}
