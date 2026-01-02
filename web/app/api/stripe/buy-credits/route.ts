import { NextResponse } from "next/server";
import { stripe, CREDIT_PACK_PRICE_ID } from "@/lib/stripe";
import {
  verifyChatToken,
  extractChatToken,
  type TokenVerificationError,
} from "@/lib/verifyChatToken";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { IS_SELF_HOSTING } from "@/lib/config";

/**
 * create a stripe checkout session for purchasing a credit pack.
 * requires an active subscription (membership model).
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
    // check if credit pack price is configured
    if (!CREDIT_PACK_PRICE_ID) {
      console.error("STRIPE_CREDIT_PACK_PRICE_ID not configured");
      return NextResponse.json(
        {
          error:
            "Credit pack purchases not configured. Please contact support.",
        },
        { status: 500 }
      );
    }

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
    if (!result.valid || result.userId === "anonymous") {
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

    // verify user has an active subscription (required to buy credit packs)
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const subscription = await convex.query(
      api.subscriptions.getSubscriptionByUserId,
      {
        userId: userId!,
      }
    );

    if (!subscription || subscription.status !== "active") {
      return NextResponse.json(
        { error: "Active subscription required to purchase credits" },
        { status: 403 }
      );
    }

    // create stripe checkout session for one-time payment
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: subscription.stripeCustomerId,
      line_items: [
        {
          price: CREDIT_PACK_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/?settings=billing&credits_purchased=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/?settings=billing`,
      metadata: {
        userId: userId!,
        type: "credit_pack",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Buy credits error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
