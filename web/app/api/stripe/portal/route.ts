import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { verifyChatToken, extractChatToken } from "@/lib/verifyChatToken";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { IS_SELF_HOSTING } from "@/lib/config";

/**
 * create a stripe customer portal session for managing subscription.
 */
export async function POST(req: Request) {
  // stripe is disabled in self-hosting mode
  if (IS_SELF_HOSTING) {
    return NextResponse.json(
      { error: "Billing features are disabled in self-hosting mode" },
      { status: 501 }
    );
  }

  try {
    const body = await req.json();

    // extract token from authorization header (preferred) or body (fallback)
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

    // get the user's stripe customer iD from convex
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const subscription = await convex.query(
      api.subscriptions.getSubscriptionByUserId,
      {
        userId,
      }
    );

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // create stripe customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/?settings=billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
