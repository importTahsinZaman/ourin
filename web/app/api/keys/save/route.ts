import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  verifyChatToken,
  extractChatToken,
  type TokenVerificationError,
} from "@/lib/verifyChatToken";
import { encryptApiKey, getKeyHint, validateKeyFormat } from "@/lib/encryption";
import { IS_SELF_HOSTING } from "@/lib/config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Save an API key with server-side encryption.
 * The client sends the plain key, we encrypt it here where the secret is available.
 *
 * Disabled in self-hosting mode - all requests use server-side API keys.
 * Requires an active subscription - BYOK is a subscriber-only feature.
 */
export async function POST(req: Request) {
  // In self-hosting mode, BYOK is disabled
  if (IS_SELF_HOSTING) {
    return NextResponse.json(
      { error: "API key management is not available in self-hosting mode" },
      { status: 501 }
    );
  }

  try {
    const body = await req.json();
    const { provider, apiKey } = body;

    // Extract token from Authorization header (preferred) or body (fallback)
    const chatToken =
      extractChatToken(req) || (body.chatToken as string | undefined);

    if (!chatToken) {
      return NextResponse.json(
        { error: "Unauthorized - no token provided" },
        { status: 401 }
      );
    }

    const result = await verifyChatToken(chatToken);
    if (!result.valid || !result.userId || result.userId === "anonymous") {
      const errorMessage =
        result.error === "expired"
          ? "Unauthorized - token expired"
          : result.error === "invalid_signature"
            ? "Unauthorized - invalid token signature"
            : result.error === "malformed_token"
              ? "Unauthorized - malformed token"
              : "Unauthorized - please sign in";

      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }

    const userId = result.userId;

    // Verify user has an active subscription - BYOK is a subscriber-only feature
    const tierInfo = await convex.query(api.billing.getUserTierById, {
      userId,
    });
    if (tierInfo.tier !== "subscriber") {
      return NextResponse.json(
        {
          error: "Active subscription required to save API keys",
          code: "SUBSCRIPTION_REQUIRED",
          details:
            "BYOK (Bring Your Own Key) is a subscriber-only feature. Subscribe to unlock.",
        },
        { status: 403 }
      );
    }

    // Validate inputs
    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Missing provider or apiKey" },
        { status: 400 }
      );
    }

    // Validate key format
    if (!validateKeyFormat(provider, apiKey)) {
      return NextResponse.json(
        { error: "Invalid API key format for this provider" },
        { status: 400 }
      );
    }

    // Encrypt the key server-side (where API_KEY_ENCRYPTION_SECRET is available)
    const encryptedKey = await encryptApiKey(apiKey);
    const keyHint = getKeyHint(apiKey);

    // Save to Convex via server-only mutation
    // Note: We need to use a server-only endpoint since ConvexHttpClient can't use auth context
    // Instead, we use a mutation that accepts userId and validates via serverSecret
    await convex.mutation(api.apiKeys.saveApiKeyInternal, {
      userId,
      provider,
      encryptedKey,
      keyHint,
      serverSecret: process.env.CHAT_AUTH_SECRET!,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Save API key error:", error);
    return NextResponse.json(
      { error: "Failed to save API key" },
      { status: 500 }
    );
  }
}
